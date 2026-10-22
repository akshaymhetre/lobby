"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CircleCheck, History, Link2, MoreHorizontal, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/time";
import { markReviewedAction, setStatusAction } from "@/app/(app)/knowledge/_actions";
import { VersionHistory } from "./version-history";

export function PageActions({
  pageId,
  editHref,
  status,
  canEdit,
  canReview,
  showHistory,
}: {
  pageId: string;
  editHref: string;
  status: "draft" | "published" | "archived";
  canEdit: boolean;
  canReview: boolean;
  showHistory: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const review = () =>
    startTransition(async () => {
      const r = await markReviewedAction(pageId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Marked as reviewed", {
        description: r.reviewBy ? `Next review is due ${formatDate(r.reviewBy)}.` : undefined,
      });
      router.refresh();
    });

  const setStatus = (next: "archived" | "draft") =>
    startTransition(async () => {
      const r = await setStatusAction(pageId, next);
      if (!r.ok) return void toast.error(r.error);
      toast.success(next === "archived" ? "Page archived" : "Moved back to drafts", {
        description: next === "archived" ? "It no longer appears in search. You can restore it any time." : "Publish it again from the editor.",
      });
      router.refresh();
    });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href.split("#")[0]!);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  const showMenu = canEdit || showHistory;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canReview && status === "published" ? (
        <Button variant="primary" size="sm" onClick={review} loading={pending}>
          <CircleCheck aria-hidden />
          Mark as reviewed
        </Button>
      ) : null}
      {canEdit ? (
        <Button variant={canReview && status === "published" ? "secondary" : "primary"} size="sm" asChild>
          <Link href={editHref}>
            <Pencil aria-hidden />
            Edit
          </Link>
        </Button>
      ) : null}
      {showMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More page actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {showHistory ? (
              <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                <History aria-hidden />
                Version history
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={copyLink}>
              <Link2 aria-hidden />
              Copy link
            </DropdownMenuItem>
            {canEdit ? (
              <>
                <DropdownMenuSeparator />
                {status === "archived" ? (
                  <DropdownMenuItem onSelect={() => setStatus("draft")}>
                    <ArchiveRestore aria-hidden />
                    Restore as draft
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem destructive onSelect={() => setStatus("archived")}>
                    <Archive aria-hidden />
                    Archive page
                  </DropdownMenuItem>
                )}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {showHistory ? <VersionHistory pageId={pageId} open={historyOpen} onOpenChange={setHistoryOpen} canRestore={canEdit} /> : null}
    </div>
  );
}
