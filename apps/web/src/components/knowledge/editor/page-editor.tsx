"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { ArrowLeft, Check, FileText, Globe, Lock } from "lucide-react";
import type { DocNode } from "@lobby/core/knowledge/doc";
import { freshnessState } from "@lobby/core/knowledge/freshness";
import { TEMPLATES, templateDoc, type PageTemplate } from "@lobby/core/knowledge/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { DateField } from "@/components/ui/date-field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { savePageAction } from "@/app/(app)/knowledge/_actions";
import { PageTimeline } from "../trust-timeline";
import { Callout } from "./callout";
import { EditorToolbar, normaliseHref } from "./toolbar";
import "./editor.css";

export interface EditorSpace {
  id: string;
  slug: string;
  name: string;
  restricted: boolean;
  pages: { id: string; title: string }[];
}

export interface PageEditorProps {
  mode: "new" | "edit";
  page: {
    id?: string;
    title: string;
    content: DocNode | null;
    template: PageTemplate;
    spaceId: string;
    parentId: string | null;
    ownerId: string | null;
    reviewBy: string | null;
    /** YYYY-MM-DD of the last check, so the preview draws the same cycle the reader sees. */
    verifiedOn?: string | null;
    visibilityGroupIds: string[];
    status: "draft" | "published" | "archived";
  };
  spaces: EditorSpace[];
  people: { id: string; name: string; title: string | null }[];
  groups: { id: string; displayName: string }[];
  today: string;
  cancelHref: string;
}

const NO_PARENT = "__none__";

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function PageEditor({ mode, page, spaces, people, groups, today, cancelHref }: PageEditorProps) {
  const router = useRouter();
  const [title, setTitle] = React.useState(page.title);
  const [template, setTemplate] = React.useState<PageTemplate>(page.template);
  const [spaceId, setSpaceId] = React.useState(page.spaceId);
  const [parentId, setParentId] = React.useState<string | null>(page.parentId);
  const [ownerId, setOwnerId] = React.useState<string | null>(page.ownerId);
  const [reviewBy, setReviewBy] = React.useState<string>(page.reviewBy ?? addDays(today, TEMPLATES.find((t) => t.key === page.template)?.reviewDays ?? 180));
  const [restrict, setRestrict] = React.useState(page.visibilityGroupIds.length > 0);
  const [groupIds, setGroupIds] = React.useState<string[]>(page.visibilityGroupIds);
  const [dirty, setDirty] = React.useState(false);
  const [contentTouched, setContentTouched] = React.useState(mode === "edit");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pendingTemplate, setPendingTemplate] = React.useState<PageTemplate | null>(null);
  const [saving, setSaving] = React.useState<"save" | "publish" | null>(null);
  const titleRef = React.useRef<HTMLTextAreaElement>(null);
  const applyingTemplate = React.useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (url) => !!normaliseHref(url),
          HTMLAttributes: { rel: "noopener noreferrer", target: null },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === "heading" ? "Heading" : "Write something, or pick a template above"),
      }),
      Callout,
    ],
    content: page.content ?? templateDoc(page.template),
    editorProps: {
      attributes: { class: "focus:outline-none", "aria-label": "Page content", role: "textbox", "aria-multiline": "true" },
    },
    onUpdate: () => {
      if (applyingTemplate.current) return;
      setDirty(true);
      setContentTouched(true);
    },
  });

  // Warn before leaving with unsaved changes.
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Auto-size the title.
  React.useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  const space = spaces.find((s) => s.id === spaceId);
  const parentOptions = (space?.pages ?? []).filter((p) => p.id !== page.id);

  const touch = () => setDirty(true);

  const applyTemplate = (key: PageTemplate) => {
    if (!editor) return;
    applyingTemplate.current = true;
    editor.commands.setContent(templateDoc(key));
    applyingTemplate.current = false;
    setTemplate(key);
    setContentTouched(false);
    const days = TEMPLATES.find((t) => t.key === key)?.reviewDays ?? 180;
    setReviewBy(addDays(today, days));
    setDirty(true);
  };

  const chooseTemplate = (key: PageTemplate) => {
    if (key === template) return;
    if (contentTouched) setPendingTemplate(key);
    else applyTemplate(key);
  };

  const validate = (action: "save" | "publish") => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Give the page a title.";
    if (!spaceId) e.space = "Choose a space.";
    if (action === "publish" || page.status === "published") {
      if (!ownerId) e.owner = "Published pages need an owner.";
      if (!reviewBy) e.reviewBy = "Choose when this page should be reviewed.";
      else if (reviewBy < today) e.reviewBy = "The review date must be today or later.";
    }
    if (restrict && !groupIds.length) e.visibility = "Pick at least one group, or make it visible to everyone in the space.";
    setErrors(e);
    if (e.title) titleRef.current?.focus();
    return Object.keys(e).length === 0;
  };

  const submit = async (action: "save" | "publish") => {
    if (!editor || saving) return;
    if (!validate(action)) {
      toast.error("Some details need attention");
      return;
    }
    setSaving(action);
    const r = await savePageAction({
      id: page.id,
      spaceId,
      parentId,
      title,
      // ProseMirror builds attrs with Object.create(null); the server action transport drops such
      // objects silently (links lost their href). A JSON round trip makes every object plain.
      content: JSON.parse(JSON.stringify(editor.getJSON())) as DocNode,
      template,
      ownerId,
      reviewBy,
      visibilityGroupIds: restrict ? groupIds : [],
      action,
    });
    setSaving(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setDirty(false);
    toast.success(
      action === "publish" ? (page.status === "published" ? "Changes published" : "Page published") : r.status === "published" ? "Changes published" : "Draft saved",
    );
    router.push(r.url);
    router.refresh();
  };

  // Cmd/Ctrl-S saves (publishes changes on a published page, saves a draft otherwise).
  const submitRef = React.useRef(submit);
  React.useEffect(() => {
    submitRef.current = submit;
  });
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void submitRef.current("save");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isPublished = page.status === "published";
  const statusBadge =
    mode === "new" ? (
      <Badge tone="info" dot>
        New page
      </Badge>
    ) : page.status === "published" ? (
      <Badge tone="success" dot>
        Published
      </Badge>
    ) : page.status === "draft" ? (
      <Badge tone="info" dot>
        Draft
      </Badge>
    ) : (
      <Badge dot>Archived</Badge>
    );

  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col">
      {/* Action bar */}
      <div className="sticky top-14 z-20 bg-page/92 shadow-[0_1px_0_var(--lb-border)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-(--container-page-wide) items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={cancelHref} aria-label="Back without saving">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="hidden truncate text-small text-muted sm:inline">
              {mode === "new" ? "New page in" : "Editing in"} <span className="font-medium text-fg">{space?.name ?? "a space"}</span>
            </span>
            {statusBadge}
            {dirty ? <span className="hidden text-caption text-subtle md:inline">Unsaved changes</span> : null}
          </div>
          {!isPublished ? (
            <Button variant="secondary" onClick={() => submit("save")} loading={saving === "save"} disabled={!!saving && saving !== "save"}>
              Save draft
            </Button>
          ) : null}
          <Button onClick={() => submit("publish")} loading={saving === "publish"} disabled={!!saving && saving !== "publish"}>
            <Check aria-hidden />
            {isPublished ? "Publish changes" : "Publish"}
          </Button>
        </div>
        {editor ? (
          <div className="mx-auto max-w-(--container-page-wide) border-t border-border px-2 sm:px-4 lg:px-6">
            <EditorToolbar editor={editor} />
          </div>
        ) : null}
      </div>

      <div className="mx-auto grid w-full max-w-(--container-page-wide) flex-1 grid-cols-1 gap-8 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10 lg:px-8">
        <div className="panel mx-auto w-full min-w-0 max-w-[800px] self-start rounded-panel px-5 py-7 sm:px-10 sm:py-10">
          {mode === "new" ? (
            <div className="mb-6">
              <p className="mb-2 text-small font-medium text-muted" id="template-label">
                Start from
              </p>
              <div role="radiogroup" aria-labelledby="template-label" className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={template === t.key}
                    onClick={() => chooseTemplate(t.key)}
                    title={t.description}
                    className={cn(
                      "focus-ring touch-target inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-small font-medium transition-[background-color,color,box-shadow,transform] duration-160 ease-standard",
                      template === t.key
                        ? "bg-accent-soft text-accent-text shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--lb-accent)_30%,transparent)]"
                        : "cell press text-fg",
                    )}
                  >
                    {template === t.key ? <Check className="size-3.5 stroke-[2]" aria-hidden /> : <FileText className="size-3.5 stroke-[1.5] text-subtle" aria-hidden />}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label htmlFor="page-title" className="sr-only">
            Title
          </label>
          <textarea
            id="page-title"
            ref={titleRef}
            rows={1}
            value={title}
            maxLength={200}
            placeholder="Untitled page"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? "title-error" : undefined}
            onChange={(e) => {
              setTitle(e.target.value.replace(/\n/g, ""));
              touch();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor?.commands.focus("start");
              }
            }}
            className="w-full resize-none overflow-hidden bg-transparent text-[32px] font-medium leading-[40px] tracking-[-0.02em] text-fg outline-none placeholder:text-subtle sm:text-[36px] sm:leading-[44px]"
          />
          {errors.title ? (
            <p id="title-error" className="mt-1 text-small text-danger-text">
              {errors.title}
            </p>
          ) : null}

          <div className="lobby-editor mt-6 max-w-[68ch]">
            {editor ? (
              <EditorContent editor={editor} />
            ) : (
              <div className="h-[360px] animate-shimmer rounded-cell bg-sunken" aria-label="Loading editor" />
            )}
          </div>
        </div>

        {/* Settings */}
        <aside aria-label="Page settings" className="panel self-start rounded-panel p-5 lg:sticky lg:top-[136px]">
          <div className="flex flex-col gap-5">
            <h2 className="text-h4 font-medium text-fg">Page settings</h2>

            <Field label="Space" required controlId="space-select" error={errors.space}>
              <Select
                value={spaceId}
                onValueChange={(v) => {
                  setSpaceId(v);
                  setParentId(null);
                  touch();
                }}
              >
                <SelectTrigger id="space-select">
                  <SelectValue placeholder="Choose a space" />
                </SelectTrigger>
                <SelectContent>
                  {spaces.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Parent page" controlId="parent-select" help="Nests this page under another in the space.">
              <Select
                value={parentId ?? NO_PARENT}
                onValueChange={(v) => {
                  setParentId(v === NO_PARENT ? null : v);
                  touch();
                }}
              >
                <SelectTrigger id="parent-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>None (top level)</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Owner" required controlId="owner-select" error={errors.owner} help="Keeps the page accurate and gets the review reminders.">
              <Select
                value={ownerId ?? undefined}
                onValueChange={(v) => {
                  setOwnerId(v);
                  touch();
                }}
              >
                <SelectTrigger id="owner-select">
                  <SelectValue placeholder="Choose an owner" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Review by"
              required
              error={errors.reviewBy}
              help="The owner is reminded 14 days before. After this date readers see the page as stale."
            >
              <DateField
                name="reviewBy"
                value={reviewBy}
                min={today}
                clearable={false}
                onValueChange={(v) => {
                  setReviewBy(v);
                  touch();
                }}
              />
            </Field>
            {reviewBy ? (
              // Publishing counts as a check, so a future date is the span readers will see; a past
              // date is what they see now, until a new one is chosen.
              <div className="-mt-2 flex flex-col gap-2 rounded-cell bg-sunken/70 px-3.5 pb-3 pt-2.5 shadow-inset">
                <p className={cn("text-caption font-medium", reviewBy < today ? "text-cat-coral-text" : "text-muted")}>
                  {reviewBy < today ? "Readers see this page as stale. Pick a later date to publish." : "Readers see, if you publish today"}
                </p>
                <PageTimeline
                  state={freshnessState(reviewBy, today)}
                  verifiedOn={reviewBy < today ? (page.verifiedOn ?? null) : today}
                  verifiedBy={null}
                  reviewBy={reviewBy}
                  today={today}
                  compact
                />
              </div>
            ) : null}

            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-1.5 text-small font-medium text-fg">Who can read it</legend>
              <RadioGroup
                value={restrict ? "groups" : "space"}
                onValueChange={(v) => {
                  setRestrict(v === "groups");
                  touch();
                }}
                className="gap-2.5"
              >
                <label className="flex cursor-pointer items-start gap-2.5 text-small">
                  <RadioGroupItem value="space" className="mt-0.5" />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-fg">
                      {space?.restricted ? <Lock className="size-3.5 stroke-[1.75]" aria-hidden /> : <Globe className="size-3.5 stroke-[1.75]" aria-hidden />}
                      Same as the space
                    </span>
                    <span className="text-muted">{space?.restricted ? "Only the groups that can see this space." : "Everyone at the company."}</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 text-small">
                  <RadioGroupItem value="groups" className="mt-0.5" />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-fg">
                      <Lock className="size-3.5 stroke-[1.75]" aria-hidden />
                      Specific groups
                    </span>
                    <span className="text-muted">Hidden from everyone else, including search and the assistant.</span>
                  </span>
                </label>
              </RadioGroup>
              {restrict ? (
                <div className="mt-1 max-h-[220px] overflow-y-auto rounded-cell bg-sunken p-1 shadow-inset">
                  {groups.map((g) => {
                    const checked = groupIds.includes(g.id);
                    return (
                      <label key={g.id} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-control px-2 text-small text-fg hover:bg-hover">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            setGroupIds((cur) => (c ? [...cur, g.id] : cur.filter((x) => x !== g.id)));
                            touch();
                          }}
                        />
                        {g.displayName}
                      </label>
                    );
                  })}
                </div>
              ) : null}
              {errors.visibility ? <p className="text-small text-danger-text">{errors.visibility}</p> : null}
            </fieldset>
          </div>
        </aside>
      </div>

      <Dialog open={!!pendingTemplate} onOpenChange={(o) => !o && setPendingTemplate(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Replace what you have written?</DialogTitle>
            <DialogDescription>
              Starting from the {TEMPLATES.find((t) => t.key === pendingTemplate)?.label.toLowerCase()} template replaces the page content. Your title and settings stay.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingTemplate(null)}>
              Keep my content
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pendingTemplate) applyTemplate(pendingTemplate);
                setPendingTemplate(null);
              }}
            >
              Replace content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
