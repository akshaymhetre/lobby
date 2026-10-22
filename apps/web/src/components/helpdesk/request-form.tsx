"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CircleAlert, Send, Sparkles } from "lucide-react";
import { isFieldVisible, validateFields, type FormFieldDef } from "@lobby/core/helpdesk/fields";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Section } from "@/components/ui/section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { BlurIn } from "@/components/ui/motion";
import { Orb } from "@/components/ui/effects/orb";
import { cn } from "@/lib/cn";
import { openAssistant } from "@/components/shell/shell-events";
import {
  createRequest,
  findPeople,
  suggestArticles,
  type DeflectionHit,
} from "@/app/(app)/help/_actions";
import { AppPicker, PersonPicker, type AppOption } from "./pickers";

/** Renders a snippet whose matches are wrapped in [[ and ]] by the search API. */
export function Highlighted({ text }: { text: string }) {
  const parts = text.split(/\[\[(.*?)\]\]/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-[2px] bg-accent-soft text-accent-text">
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

/** Search excerpts are cut from page source: drop the stray leading quote or bullet and run list items as sentences. */
function cleanSnippet(text: string) {
  return text
    .replace(/^[\s"'\-*:,.;)]+/, "")
    .replace(/\s+[-*]\s+/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function useDeflection(subject: string) {
  const [hits, setHits] = React.useState<DeflectionHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState("");
  React.useEffect(() => {
    const q = subject.trim();
    if (q.length < 3) {
      setHits([]);
      setSearched("");
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const r = await suggestArticles(q);
        if (!cancelled) {
          setHits(r);
          setSearched(q);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [subject]);
  return { hits, loading, searched };
}

/**
 * Knowledge pages that might answer the request, in the right rail under "What happens next"
 * (audit E2) rather than inside the form, so the form never jumps while someone types.
 * Rendered once: on phones it sits under the form.
 * v2: the panel materialises from blur when the first suggestions arrive, the screen's one
 * authored moment (the reference video's analysis panel building while the user types).
 */
function DeflectionPanel({
  subject,
  hits,
  loading,
  show,
}: {
  subject: string;
  hits: DeflectionHit[];
  loading: boolean;
  show: boolean;
}) {
  return (
    <div id="suggested-articles" aria-live="polite" className="scroll-mt-6">
      {loading && !show ? (
        <p className="flex items-center gap-2.5 text-small text-subtle">
          <Orb size={22} state="thinking" />
          Looking for answers...
        </p>
      ) : null}
      {show ? (
        <BlurIn className="rounded-panel panel p-4 sm:p-5 dark:glass">
          <Section
            tone="quiet"
            as="h3"
            title={
              <span className="inline-flex items-center gap-2">
                <Orb size={20} state={loading ? "thinking" : "done"} />
                These might answer it
              </span>
            }
            action={
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => openAssistant(subject.trim())}
              >
                <Sparkles />
                Ask the assistant
              </Button>
            }
          >
            <ul className="-mx-2 divide-y divide-border">
              {hits.map((h) => (
                <li key={h.url}>
                  <Link
                    href={h.url}
                    target="_blank"
                    className="focus-ring flex items-start gap-2.5 rounded-cell px-2 py-2.5 transition-colors duration-120 hover:bg-hover"
                  >
                    <BookOpen
                      className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-muted"
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-body font-medium text-fg">{h.title}</span>
                      <span className="line-clamp-2 text-small text-muted">
                        <Highlighted text={cleanSnippet(h.snippet)} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </BlurIn>
      ) : null}
    </div>
  );
}

export interface RequestFormProps {
  typeSlug: string;
  fields: FormFieldDef[];
  apps: AppOption[];
  submitLabel: string;
  /** The "What happens next" steps, rendered by the page; shown in the rail beside the form. */
  aside?: React.ReactNode;
}

/** Short controls (a number, a date, a dropdown) sit two-up when they follow one another (audit E3). */
const SHORT = new Set(["number", "date", "select"]);

export function RequestForm({ typeSlug, fields, apps, submitLabel, aside }: RequestFormProps) {
  const router = useRouter();
  const [subject, setSubject] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);
  const deflection = useDeflection(subject);
  const showDeflection = deflection.hits.length > 0 && deflection.searched.length >= 3;

  const set = (key: string, v: unknown) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const focusFirstError = (errs: Record<string, string>) => {
    const key = ["subject", "description", ...fields.map((f) => f.key)].find((k) => errs[k]);
    if (!key) return;
    window.requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>(`#rf-${key}`)?.focus(),
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs: Record<string, string> = {};
    if (!subject.trim()) errs.subject = "Add a short summary.";
    else if (subject.trim().length > 200) errs.subject = "Keep the summary under 200 characters.";
    const checked = validateFields(fields, values);
    if (!checked.ok) Object.assign(errs, checked.errors);
    setErrors(errs);
    if (Object.keys(errs).length) {
      focusFirstError(errs);
      return;
    }
    startTransition(async () => {
      const res = await createRequest({ typeSlug, subject, description, fields: checked.values });
      if (res.ok) {
        toast.success(`Request #${res.number} is on its way`);
        router.push(`/help/${res.number}`);
        return;
      }
      setFormError(res.error);
      if (res.fieldErrors) {
        setErrors(res.fieldErrors);
        focusFirstError(res.fieldErrors);
      }
    });
  };

  const renderField = (f: FormFieldDef) => {
    const id = `rf-${f.key}`;
    const err = errors[f.key];
    const v = values[f.key];
    switch (f.type) {
      case "checkbox":
        return (
          <div key={f.key} className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id={id}
                checked={v === true}
                onCheckedChange={(c) => set(f.key, c === true)}
                aria-invalid={err ? true : undefined}
                className="mt-0.5"
              />
              <label htmlFor={id} className="text-body text-fg">
                {f.label}
                {f.required ? (
                  <span className="ml-0.5 text-danger-text" aria-hidden>
                    *
                  </span>
                ) : null}
              </label>
            </div>
            {err ? (
              <p className="pl-6.5 text-small text-danger-text">{err}</p>
            ) : f.help ? (
              <p className="pl-6.5 text-small text-muted">{f.help}</p>
            ) : null}
          </div>
        );
      case "select":
        return (
          <Field
            key={f.key}
            label={f.label}
            required={f.required}
            help={f.help}
            error={err}
            controlId={id}
          >
            <Select value={typeof v === "string" ? v : ""} onValueChange={(nv) => set(f.key, nv)}>
              <SelectTrigger id={id} aria-invalid={err ? true : undefined}>
                <SelectValue placeholder="Choose one" />
              </SelectTrigger>
              <SelectContent>
                {(f.options ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        );
      case "user":
        return (
          <Field
            key={f.key}
            label={f.label}
            required={f.required}
            help={f.help}
            error={err}
            controlId={id}
          >
            <PersonPicker
              id={id}
              value={typeof v === "string" ? v : null}
              onChange={(nv) => set(f.key, nv)}
              search={findPeople}
              invalid={!!err}
            />
          </Field>
        );
      case "app":
        return (
          <Field
            key={f.key}
            label={f.label}
            required={f.required}
            help={f.help}
            error={err}
            controlId={id}
          >
            <AppPicker
              id={id}
              value={typeof v === "string" ? v : null}
              onChange={(nv) => set(f.key, nv)}
              apps={apps}
              invalid={!!err}
            />
          </Field>
        );
      case "textarea":
        return (
          <Field key={f.key} label={f.label} required={f.required} help={f.help} error={err}>
            <Textarea
              id={id}
              value={typeof v === "string" ? v : ""}
              onChange={(e) => set(f.key, e.target.value)}
              rows={3}
            />
          </Field>
        );
      case "date":
        return (
          <Field key={f.key} label={f.label} required={f.required} help={f.help} error={err}>
            <DateField
              id={id}
              name={f.key}
              value={typeof v === "string" ? v : ""}
              onValueChange={(iso) => set(f.key, iso)}
            />
          </Field>
        );
      case "number":
        return (
          <Field key={f.key} label={f.label} required={f.required} help={f.help} error={err}>
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              value={typeof v === "string" || typeof v === "number" ? String(v) : ""}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </Field>
        );
      default:
        return (
          <Field key={f.key} label={f.label} required={f.required} help={f.help} error={err}>
            <Input
              id={id}
              value={typeof v === "string" ? v : ""}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </Field>
        );
    }
  };

  const labelFor = (key: string) =>
    key === "subject" ? "Summary" : key === "description" ? "Details" : (fields.find((f) => f.key === key)?.label ?? key);
  const errorList = ["subject", "description", ...fields.map((f) => f.key)]
    .filter((k) => errors[k])
    .map((k) => [k, labelFor(k)] as const);

  // Group consecutive short fields so they share a row.
  const visible = fields.filter((f) => isFieldVisible(f, fields, values));
  const groups: FormFieldDef[][] = [];
  for (const f of visible) {
    const last = groups[groups.length - 1];
    if (last && SHORT.has(f.type) && last.every((g) => SHORT.has(g.type))) last.push(f);
    else groups.push([f]);
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-10">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-5 rounded-panel panel p-5 sm:p-6 lg:row-span-2"
      >
        {Object.values(errors).filter(Boolean).length > 1 ? (
          <div
            role="alert"
            className="flex flex-col gap-1.5 rounded-cell bg-danger-soft px-4 py-3 text-danger-text"
          >
            <p className="flex items-center gap-2 text-body font-medium">
              <CircleAlert className="size-4 stroke-[1.75]" aria-hidden />
              {Object.values(errors).filter(Boolean).length} things to fix before this can go
            </p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 pl-6 text-small">
              {errorList.map(([key, label]) => (
                <li key={key}>
                  <a
                    href={`#rf-${key}`}
                    onClick={(e) => {
                      e.preventDefault();
                      formRef.current?.querySelector<HTMLElement>(`#rf-${key}`)?.focus();
                    }}
                    className="focus-ring rounded-[4px] underline underline-offset-2 hover:no-underline"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Field
            label="Summary"
            required
            error={errors.subject}
            help="One line, like you'd say it to a colleague."
          >
            <Input
              id="rf-subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                if (errors.subject) setErrors((p) => ({ ...p, subject: "" }));
              }}
              maxLength={200}
              autoComplete="off"
              autoFocus
            />
          </Field>
          {showDeflection ? (
            <p className="text-small text-muted lg:hidden">
              {deflection.hits.length === 1 ? "An article" : `${deflection.hits.length} articles`}{" "}
              might answer this.{" "}
              <a
                href="#suggested-articles"
                className="focus-ring rounded-[4px] font-medium text-accent-text hover:underline"
              >
                Have a look
              </a>
            </p>
          ) : null}
        </div>

        {groups.map((group) =>
          SHORT.has(group[0]!.type) ? (
            <div
              key={group.map((g) => g.key).join("+")}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              {group.map(renderField)}
            </div>
          ) : (
            renderField(group[0]!)
          ),
        )}

        <Field
          label="Anything else we should know?"
          help="Steps you tried, error messages, deadlines. Attachments aren't supported yet, so paste text or a link."
          error={errors.description}
        >
          <Textarea
            id="rf-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
        </Field>

        {formError ? (
          <p
            role="alert"
            className="rounded-cell bg-danger-soft px-3 py-2 text-small text-danger-text"
          >
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="ghost" asChild>
            <Link href="/help">Cancel</Link>
          </Button>
          <Button type="submit" loading={pending}>
            <Send />
            {submitLabel}
          </Button>
        </div>
      </form>

      {aside ? (
        <div className="order-last lg:order-none lg:col-start-2 lg:row-start-1">{aside}</div>
      ) : null}
      <div
        className={cn(
          "lg:col-start-2 lg:row-start-2",
          !showDeflection && !deflection.loading && "hidden lg:block",
        )}
      >
        <DeflectionPanel
          subject={subject}
          hits={deflection.hits}
          loading={deflection.loading}
          show={showDeflection}
        />
      </div>
    </div>
  );
}
