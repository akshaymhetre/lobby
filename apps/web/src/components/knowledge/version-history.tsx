"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, RotateCcw } from "lucide-react";
import type { DocNode } from "@lobby/core/knowledge/doc";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDateTime, timeAgo } from "@/lib/time";
import { getVersionAction, listVersionsAction, restoreVersionAction } from "@/app/(app)/knowledge/_actions";
import { DocRenderer } from "./doc-renderer";

type Version = { id: string; title: string; createdAt: string; authorName: string | null };

export function VersionHistory({
  pageId,
  open,
  onOpenChange,
  canRestore,
}: {
  pageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRestore: boolean;
}) {
  const router = useRouter();
  const [versions, setVersions] = React.useState<Version[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Version | null>(null);
  const [preview, setPreview] = React.useState<{ title: string; content: DocNode } | null>(null);
  const [restoring, startRestore] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setVersions(null);
    setError(null);
    setSelected(null);
    listVersionsAction(pageId).then((r) => {
      if (cancelled) return;
      if (r.ok) setVersions(r.versions);
      else setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [open, pageId]);

  React.useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setPreview(null);
    getVersionAction(selected.id).then((r) => {
      if (cancelled) return;
      if (r.ok) setPreview({ title: r.title, content: r.content });
      else setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const restore = () =>
    selected &&
    startRestore(async () => {
      const r = await restoreVersionAction(selected.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Version restored", { description: `The page now matches the version from ${formatDateTime(selected.createdAt)}.` });
      onOpenChange(false);
      router.refresh();
    });

  const latestId = versions?.[0]?.id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[560px]">
        <SheetHeader>
          <SheetTitle>{selected ? "Version preview" : "Version history"}</SheetTitle>
          <SheetDescription>
            {selected
              ? `Saved ${formatDateTime(selected.createdAt)}${selected.authorName ? ` by ${selected.authorName}` : ""}`
              : "A version is saved every time the page is published."}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="px-0 py-0">
          {error ? (
            <EmptyState compact variant="error" icon={<History />} title="Could not load the history" description={error} />
          ) : selected ? (
            <div className="px-5 py-4">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="-ml-2 mb-3">
                <ArrowLeft aria-hidden />
                All versions
              </Button>
              {preview ? (
                <article>
                  <h2 className="mb-4 text-h2 font-medium text-fg">{preview.title}</h2>
                  <DocRenderer doc={preview.content} className="text-body [&_h2]:text-h4" />
                </article>
              ) : (
                <div className="flex flex-col gap-3" aria-busy>
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              )}
            </div>
          ) : versions === null ? (
            <div className="flex flex-col gap-2 p-5" aria-busy>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : versions.length ? (
            <ol className="divide-y divide-border">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(v)}
                    className="focus-ring flex w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-120 hover:bg-hover"
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", v.id === latestId ? "bg-accent" : "bg-border-strong")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-fg">
                        {formatDateTime(v.createdAt)}
                        {v.id === latestId ? <span className="ml-2 text-small font-normal text-accent-text">Current</span> : null}
                      </span>
                      <span className="block truncate text-small text-muted">
                        {v.authorName ?? "Someone"} · {timeAgo(v.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState compact variant="filtered" icon={<History />} title="No versions yet" description="Versions are saved when the page is published." />
          )}
        </SheetBody>
        {selected && canRestore && selected.id !== latestId ? (
          <SheetFooter>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button onClick={restore} loading={restoring} disabled={!preview}>
              <RotateCcw aria-hidden />
              Restore this version
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
