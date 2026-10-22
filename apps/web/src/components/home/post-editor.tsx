"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageOff, Trash2 } from "lucide-react";
import { deletePostAction, savePostAction } from "@/app/(app)/(home)/news/_actions";
import { Badge, Chip } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { CategoryChip } from "@/components/ui/category-block";
import { FILL, newsTone } from "./news-tone";
import { RichTextEditor } from "./rich-text";

export interface PostDraft {
  id?: string;
  title: string;
  summary: string;
  category: string;
  coverImageUrl: string;
  bodyHtml: string;
  audienceGroupIds: string[];
  pinned: boolean;
  published: boolean;
}

export function PostEditor({
  initial,
  categories,
  groups,
}: {
  initial: PostDraft;
  categories: string[];
  groups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState<"draft" | "publish" | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, startDelete] = React.useTransition();
  const [coverBroken, setCoverBroken] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const listId = React.useId();
  const tone = newsTone(v.category.trim());
  const picks = categories.slice(0, 8);
  const [customCategory, setCustomCategory] = React.useState(() => !!initial.category && !categories.slice(0, 8).includes(initial.category));
  const CoverIcon = tone.icon;

  const set = <K extends keyof PostDraft>(k: K, val: PostDraft[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setDirty(true);
    if (errors[k as string]) setErrors(({ [k as string]: _gone, ...rest }) => rest);
  };

  // Warn before leaving with unsaved changes.
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = async (publish: boolean) => {
    setPending(publish ? "publish" : "draft");
    const res = await savePostAction({
      id: v.id,
      title: v.title,
      summary: v.summary,
      category: v.category,
      coverImageUrl: v.coverImageUrl,
      bodyHtml: v.bodyHtml,
      audienceGroupIds: v.audienceGroupIds,
      pinned: v.pinned,
      publish,
    });
    setPending(null);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    setDirty(false);
    if (publish) {
      toast.success(v.id && v.published ? "Post updated" : "Post published", {
        description: v.audienceGroupIds.length
          ? "It is on the home page for the groups you picked."
          : "It is on everyone's home page.",
      });
      router.push(`/news/${res.id}`);
    } else {
      toast.success(v.published ? "Moved back to drafts" : "Draft saved", {
        description: "Only editors can see drafts.",
      });
      setV((p) => ({ ...p, id: res.id, published: false }));
      if (!v.id) router.replace(`/news/${res.id}/edit`);
      else router.refresh();
    }
  };

  const remove = () =>
    startDelete(async () => {
      const res = await deletePostAction(v.id!);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDirty(false);
      toast.success("Post deleted");
      router.push("/");
    });

  const coverOk =
    /^https:\/\//.test(v.coverImageUrl) ||
    (v.coverImageUrl.startsWith("/") && !v.coverImageUrl.startsWith("//"));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(true);
      }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "News", href: "/#news" },
            { label: v.id ? "Edit post" : "New post" },
          ]}
        />
        <div className="flex items-center gap-2">
          <Badge tone={v.published ? "success" : "neutral"} dot>
            {v.published ? "Published" : "Draft"}
          </Badge>
          <Button
            type="button"
            variant="secondary"
            loading={pending === "draft"}
            disabled={!!pending}
            onClick={() => save(false)}
          >
            {v.published ? "Unpublish" : "Save draft"}
          </Button>
          <Button type="submit" loading={pending === "publish"} disabled={!!pending}>
            {v.published ? "Update post" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/*
            The headline and summary sit on the same ambient cover the published article uses, so
            the author writes into the page people will read. The light follows the category.
          */}
          <div className={cn("relative isolate -mx-1 flex flex-col gap-3 overflow-hidden rounded-panel px-5 pb-7 pt-10 transition-[background-image] duration-300 sm:mx-0 sm:px-8 sm:pb-9 sm:pt-16", FILL[tone.tone])}>
            {/* The same cover the published story gets: the category gradient and its oversized glyph. */}
            <CoverIcon aria-hidden className="pointer-events-none absolute -right-8 -top-12 -z-10 size-[280px] stroke-[1] opacity-[0.14]" />
            <span aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(80%_120%_at_0%_100%,rgb(0_0_0/0.2),transparent_60%),radial-gradient(60%_80%_at_100%_0%,rgb(255_255_255/0.18),transparent_60%)]" />
            <div aria-hidden className="flex">
              <CategoryChip tone={tone.tone}>{v.category.trim() || "Category"}</CategoryChip>
            </div>
          <div className="flex flex-col gap-1">
              <label htmlFor="post-title" className="sr-only">
                Headline
              </label>
              <textarea
                id="post-title"
                rows={1}
                value={v.title}
                onChange={(e) => set("title", e.target.value.replace(/\n/g, " "))}
                placeholder="Headline"
                maxLength={140}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "post-title-error" : undefined}
                className="field-sizing-content w-full resize-none rounded-[6px] border-0 bg-transparent p-0 text-title-sm font-medium text-current text-balance focus-ring placeholder:text-current placeholder:opacity-60 md:text-title"
              />
              {errors.title ? (
                <p id="post-title-error" className="inline-flex self-start rounded-full bg-white px-2.5 py-0.5 text-small font-medium text-danger-text">
                  {errors.title}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="post-summary" className="sr-only">
                Summary
              </label>
              <textarea
                id="post-summary"
                rows={1}
                value={v.summary}
                onChange={(e) => set("summary", e.target.value)}
                placeholder="One or two sentences that show in the feed"
                maxLength={280}
                aria-invalid={errors.summary ? true : undefined}
                className="field-sizing-content w-full resize-none rounded-[4px] border-0 bg-transparent p-0 text-h4 text-current opacity-90 focus-ring placeholder:text-current placeholder:opacity-60"
              />
              {errors.summary ? (
                <p className="inline-flex self-start rounded-full bg-white px-2.5 py-0.5 text-small font-medium text-danger-text">{errors.summary}</p>
              ) : null}
            </div>
          </div>
          {/* The body keeps a reading measure (about 75 characters) however wide the column is. */}
          {/* The body is set like the published story: a larger lede, 24px section heads and markers in the category colour. */}
          <div
            className="flex max-w-[760px] flex-col gap-1 [&_.ProseMirror>p:first-child]:text-h4 [&_.ProseMirror_h2]:!mt-10 [&_.ProseMirror_h2]:!text-h2 [&_.ProseMirror_li::marker]:text-[var(--story)]"
            style={{ "--story": `var(--lb-cat-${tone.tone}-to)` } as React.CSSProperties}
          >
            <RichTextEditor
              initialHtml={initial.bodyHtml}
              onChange={(html) => set("bodyHtml", html)}
              invalid={!!errors.body}
              describedBy={errors.body ? "post-body-error" : undefined}
            />
            {errors.body ? (
              <p id="post-body-error" className="text-small text-danger-text">
                {errors.body}
              </p>
            ) : null}
          </div>
        </div>

        <aside
          aria-label="Post settings"
          className="flex flex-col gap-5 lg:sticky lg:top-20 lg:self-start"
        >
          {/* The editor's one authored moment: the settings panel rises in after the headline. */}
          <Reveal delay={0.15}>
            <RevealItem className="panel flex flex-col gap-5 rounded-panel p-5">
              {/* Category: the picks in each category's colour (the same blocks the feed shows), and a
                  field only when the author wants one that does not exist yet. */}
              <div className="flex flex-col gap-2">
                <Label id="post-category-label">
                  Category
                  <span aria-hidden className="text-danger-text"> *</span>
                </Label>
                <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="post-category-label">
                  {picks.map((c) => {
                    const on = !customCategory && v.category.trim() === c;
                    const t = newsTone(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setCustomCategory(false);
                          set("category", c);
                        }}
                        className={cn(
                          "focus-ring press inline-flex h-8 items-center rounded-full px-3 text-small font-medium transition-[box-shadow,background-color]",
                          on ? cn(FILL[t.tone], "shadow-cell") : "bg-raised text-fg shadow-cell hover:shadow-cell-hover",
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={customCategory}
                    onClick={() => {
                      setCustomCategory(true);
                      if (picks.includes(v.category.trim())) set("category", "");
                    }}
                    className={cn(
                      "focus-ring press inline-flex h-8 items-center rounded-full px-3 text-small font-medium",
                      customCategory ? "bg-accent text-accent-fg shadow-cell" : "bg-sunken text-muted hover:text-fg",
                    )}
                  >
                    New category
                  </button>
                </div>
                {customCategory ? (
                  <Field label="New category name" error={errors.category} required>
                    <Input value={v.category} onChange={(e) => set("category", e.target.value)} list={listId} maxLength={40} autoFocus />
                  </Field>
                ) : errors.category ? (
                  <p className="text-small text-danger-text">{errors.category}</p>
                ) : null}
              </div>
              <datalist id={listId}>
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              <div className="flex flex-col gap-2">
                <Field
                  label="Cover image"
                  help="Optional. An https:// address, shown at 2:1."
                  error={errors.coverImageUrl}
                >
                  <Input
                    value={v.coverImageUrl}
                    onChange={(e) => {
                      set("coverImageUrl", e.target.value);
                      setCoverBroken(false);
                    }}
                    placeholder="https://"
                    inputMode="url"
                  />
                </Field>
                {v.coverImageUrl && coverOk ? (
                  coverBroken ? (
                    <div className="flex aspect-[2/1] items-center justify-center gap-2 rounded-cell border border-dashed border-border-strong text-small text-muted">
                      <ImageOff className="size-4 stroke-[1.5]" aria-hidden />
                      That image did not load
                    </div>
                  ) : (
                    <img
                      src={v.coverImageUrl}
                      alt="Cover preview"
                      onError={() => setCoverBroken(true)}
                      className="aspect-[2/1] w-full rounded-cell object-cover shadow-cell"
                    />
                  )
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label id="post-audience">Who sees it</Label>
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-labelledby="post-audience"
                >
                  <Chip
                    selected={v.audienceGroupIds.length === 0}
                    onClick={() => set("audienceGroupIds", [])}
                  >
                    Everyone
                  </Chip>
                  {groups.map((g) => {
                    const on = v.audienceGroupIds.includes(g.id);
                    return (
                      <Chip
                        key={g.id}
                        selected={on}
                        onClick={() =>
                          set(
                            "audienceGroupIds",
                            on
                              ? v.audienceGroupIds.filter((x) => x !== g.id)
                              : [...v.audienceGroupIds, g.id],
                          )
                        }
                      >
                        {g.name}
                      </Chip>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="post-pinned">Pin to the top</Label>
                  <p className="text-small text-muted">Pinned posts stay above newer news.</p>
                </div>
                <Switch
                  id="post-pinned"
                  checked={v.pinned}
                  onCheckedChange={(c) => set("pinned", c)}
                  className="mt-0.5"
                />
              </div>
            </RevealItem>
          </Reveal>

          {v.id ? (
            <div className="flex items-center justify-between gap-3 px-1">
              <Link
                href={v.published ? `/news/${v.id}` : "/?view=drafts#news"}
                className="focus-ring rounded-[4px] text-small font-medium text-muted hover:text-fg"
              >
                {v.published ? "View post" : "All drafts"}
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn("text-danger-text hover:text-danger-text")}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden />
                Delete post
              </Button>
            </div>
          ) : null}
        </aside>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              It disappears from the home page with its comments and likes. If you only want to hide
              it for now, unpublish it instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button type="button" variant="danger" loading={deleting} onClick={remove}>
              Delete post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
