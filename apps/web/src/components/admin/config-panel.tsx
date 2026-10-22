"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Download, FileUp, Minus, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlurIn, CountUp, Reveal, RevealItem } from "@/components/ui/motion";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { toast } from "@/components/ui/toast";
import { CategoryBlock } from "@/components/ui/category-block";
import { HeroLight } from "@/components/ui/hero-light";
import { cn } from "@/lib/cn";
import { applyConfigAction, planConfigAction } from "@/app/(app)/admin/_actions";
import type { ImportPlan } from "@lobby/config/diff";

const ACCEPT = /\.ya?ml$|^(application|text)\/(x-)?yaml$|^text\/plain$/i;

/**
 * Export the configuration, or import a YAML file with a dry-run diff before anything is written.
 * Import is the lead: a panel that accepts a drop as well as a pick, and whose diff builds section
 * by section once the plan arrives (the page's one authored moment).
 */
export function ConfigPanel({ aside }: { /** Extra content for the side column (the command-line disclosure). */ aside?: ReactNode }) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [applied, setApplied] = useState(false);
  const [over, setOver] = useState(false);
  const [planning, startPlan] = useTransition();
  const [applying, startApply] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const choose = async (f: File) => {
    setApplied(false);
    if (f.size > 2 * 1024 * 1024) {
      setFile(null);
      setPlan({ sections: [], errors: ["That file is larger than 2 MB."], hasChanges: false });
      return;
    }
    if (!ACCEPT.test(f.name) && !ACCEPT.test(f.type)) {
      setFile(null);
      setPlan({ sections: [], errors: [`${f.name} is not a YAML file.`], hasChanges: false });
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, text });
    startPlan(async () => setPlan(await planConfigAction(text)));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-8">
      {/* The hero: import, because it is the one thing here that can change the whole system. It is lit blue
          (information) until a plan arrives, and the diff builds section by section under it. */}
      <section
        aria-labelledby="config-import"
        className={cn("relative isolate flex flex-col gap-6 overflow-hidden rounded-panel panel p-6 transition-[box-shadow] duration-160 dark:glass sm:p-8", over && "ring-2 ring-accent-ring")}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void choose(f);
        }}
      >
        <HeroLight tone={plan?.errors.length ? "red" : applied ? "green" : "blue"} position="top-left" />
        <div className="flex flex-col gap-2">
          <h2 id="config-import" className="text-balance text-h2 font-medium text-fg md:text-hero">
            {applied ? "Applied. Lobby now matches the file." : "Review a change before it goes live"}
          </h2>
          <p className="max-w-xl text-row text-muted text-pretty">
            Drop a lobby.yaml here or choose one. Lobby shows exactly what would change and writes nothing until you apply. Items match by slug or name; only role mappings are ever removed.
          </p>
        </div>

        {!plan ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={cn(
              "focus-ring press group flex min-h-40 flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed px-6 py-8 text-center transition-colors duration-160",
              over ? "border-accent bg-accent-soft" : "border-border-strong bg-sunken/50 hover:border-accent hover:bg-accent-soft/50",
            )}
          >
            <span aria-hidden className="grid size-14 place-items-center rounded-full bg-raised text-accent-text shadow-cell transition-transform duration-200 group-hover:-translate-y-0.5">
              <FileUp className="size-6 stroke-[1.5]" />
            </span>
            <span className="text-row font-medium text-fg">{planning ? "Reading the file" : "Drop lobby.yaml here"}</span>
            <span className="text-small text-muted">or click to choose a YAML file, up to 2 MB</span>
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-body text-fg">
              <FileUp className="size-4 shrink-0 stroke-[1.75] text-muted" aria-hidden />
              <span className="truncate font-mono">{file?.name ?? "No file"}</span>
            </span>
            <Button type="button" variant="secondary" size="sm" loading={planning} onClick={() => input.current?.click()}>
              Choose another file
            </Button>
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept=".yaml,.yml,application/yaml,text/yaml,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-label="Configuration file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void choose(f);
            e.target.value = "";
          }}
        />

        {plan ? <PlanView key={`${file?.name ?? "none"}-${applied}`} plan={plan} fileName={file?.name} applied={applied} /> : null}

        {plan && file && !plan.errors.length && plan.hasChanges && !applied ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => { setPlan(null); setFile(null); }}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={applying}
              onClick={() =>
                startApply(async () => {
                  const r = await applyConfigAction(file.text);
                  setPlan(r);
                  if (r.applied) {
                    setApplied(true);
                    toast.success("Configuration applied.");
                  } else if (r.errors.length) toast.error("Nothing was written. Fix the errors and try again.");
                })
              }
            >
              Apply these changes
            </Button>
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-4">
        <section aria-labelledby="config-export" className="cell flex flex-col gap-4 rounded-panel p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full cat-teal">
              <Download className="size-5 stroke-[1.75]" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id="config-export" className="text-h3 font-medium text-fg">
                Export
              </h2>
              <p className="text-body text-muted text-pretty">
                One YAML file with branding, role mappings, groups, apps, knowledge spaces, helpdesk teams and request types, and journeys. Secrets are never included.
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" className="self-start">
            <a href="/admin/configuration/export" download>
              <Download aria-hidden />
              Download lobby.yaml
            </a>
          </Button>
        </section>
        {aside}
      </div>
    </div>
  );
}

function PlanView({ plan, fileName, applied }: { plan: ImportPlan; fileName?: string; applied: boolean }) {
  if (plan.errors.length) {
    return (
      <BlurIn role="alert" className="flex flex-col gap-2 rounded-card bg-danger-soft p-4 text-small text-danger-text">
        <p className="flex items-center gap-2 font-medium">
          <CircleAlert className="size-4 stroke-[1.5]" aria-hidden />
          {fileName ? `${fileName} cannot be applied` : "This file cannot be applied"}
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {plan.errors.map((e, i) => (
            <li key={i} className="break-words">{e}</li>
          ))}
        </ul>
      </BlurIn>
    );
  }
  const totals = plan.sections.reduce(
    (a, s) => ({ c: a.c + s.created.length, u: a.u + s.updated.length, r: a.r + s.removed.length, n: a.n + s.unchanged }),
    { c: 0, u: 0, r: 0, n: 0 },
  );
  const loud = plan.sections.filter((x) => x.created.length + x.updated.length + x.removed.length);
  const quiet = plan.sections.filter((x) => !(x.created.length + x.updated.length + x.removed.length));
  return (
    <Reveal stagger={0.05} className="flex flex-col gap-3">
      <RevealItem from="fade">
        <p role="status" className="flex flex-wrap items-center gap-2 text-small text-fg">
          {applied ? <CircleCheck className="size-4 stroke-[1.5] text-success-text" aria-hidden /> : null}
          <span className="font-medium">{applied ? "Applied" : plan.hasChanges ? "Dry run" : "Nothing to change"}</span>
          <span className="text-muted">
            {fileName ?? ""}
            <span className="sr-only">
              : {totals.c} to create, {totals.u} to update{totals.r ? `, ${totals.r} to remove` : ""}, {totals.n} unchanged
            </span>
          </span>
        </p>
      </RevealItem>
      <RevealItem>
        <div className="relative isolate grid gap-2.5 rounded-card sm:grid-cols-3">
          {plan.hasChanges && !applied ? <BorderBeam settle="none" tone="accent" loops={1} intensity="subtle" duration={1.8} delay={0.3} /> : null}
          {[
            { n: totals.c, label: "to create", tone: "green" as const, icon: <Plus /> },
            { n: totals.u, label: "to update", tone: "blue" as const, icon: <Pencil /> },
            { n: totals.r, label: "to remove", tone: "coral" as const, icon: <Minus /> },
          ].map((x, i) =>
            x.n ? (
              <CategoryBlock
                key={x.label}
                tone={x.tone}
                icon={x.icon}
                className="min-w-0"
                title={
                  <span className="flex items-baseline gap-2">
                    <CountUp value={x.n} duration={0.8} delay={0.1 + i * 0.08} className="text-h2 leading-none" />
                    <span>{x.label}</span>
                  </span>
                }
              />
            ) : (
              <div key={x.label} className="flex min-h-16 items-center gap-3 rounded-card bg-sunken/60 p-2.5 pr-3 shadow-inset">
                <span aria-hidden className="grid size-11 place-items-center rounded-full text-subtle [&>svg]:size-5 [&>svg]:stroke-[1.75]">{x.icon}</span>
                <span className="flex items-baseline gap-2 text-row text-subtle">
                  <span className="text-h2 leading-none">0</span>
                  {x.label}
                </span>
              </div>
            ),
          )}
        </div>
      </RevealItem>
      {/* Changes first, in full; sections the file leaves as they are fold into one quiet line. */}
      {quiet.length ? (
        <RevealItem from="fade">
          <p className="text-small text-muted">
            <span className="tabular text-fg">{totals.n} items stay as they are.</span> Nothing changes in {quiet.map((q) => (/^[A-Z][a-z]/.test(q.label) ? q.label[0]!.toLowerCase() + q.label.slice(1) : q.label)).join(", ")}.
          </p>
        </RevealItem>
      ) : null}
      <ul className={cn("flex flex-col gap-2.5", !loud.length && "hidden")}>
        {loud.map((s) => {
          const changed = s.created.length + s.updated.length + s.removed.length;
          return (
            <li key={s.section} className="cell rounded-card px-4 py-3.5">
              <RevealItem duration={0.4} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-row font-medium text-fg">{s.label}</span>
                <span className="flex flex-wrap gap-1.5">
                  {s.created.length ? <Badge tone="success" size="sm">{s.created.length} new</Badge> : null}
                  {s.updated.length ? <Badge tone="info" size="sm">{s.updated.length} changed</Badge> : null}
                  {s.removed.length ? <Badge tone="danger" size="sm">{s.removed.length} removed</Badge> : null}
                  {!changed ? <Badge size="sm">{s.unchanged ? `${s.unchanged} unchanged` : "None in file"}</Badge> : null}
                </span>
              </div>
              {changed ? (
                <ul className="flex flex-col gap-1 text-small">
                  {s.created.map((k) => (
                    <li key={`c${k}`} className="flex items-start gap-2 text-fg">
                      <Plus className="mt-0.5 size-3.5 shrink-0 stroke-[2] text-success-text" aria-label="Create" />
                      <span className="break-all font-mono">{k}</span>
                    </li>
                  ))}
                  {s.updated.map((u) => (
                    <li key={`u${u.key}`} className="flex items-start gap-2 text-fg">
                      <Pencil className="mt-0.5 size-3.5 shrink-0 stroke-[2] text-info-text" aria-label="Update" />
                      <span className="min-w-0">
                        <span className="break-all font-mono">{u.key}</span>
                        <span className="text-muted">: {u.changes.join(", ")}</span>
                      </span>
                    </li>
                  ))}
                  {s.removed.map((k) => (
                    <li key={`r${k}`} className="flex items-start gap-2 text-fg">
                      <Minus className="mt-0.5 size-3.5 shrink-0 stroke-[2] text-danger-text" aria-label="Remove" />
                      <span className="break-all font-mono">{k}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              </RevealItem>
            </li>
          );
        })}
      </ul>
    </Reveal>
  );
}
