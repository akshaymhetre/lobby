import { Clock, FilePen, TriangleAlert, Archive, CalendarOff } from "lucide-react";
import type { PageSummary } from "@lobby/core/knowledge";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CellMeta, RowCell } from "@/components/ui/cells";
import { cn } from "@/lib/cn";
import { formatDate, timeAgo } from "@/lib/time";
import { SpaceIcon } from "./space-icon";

/**
 * One page in a list (wave 3): a raised cell, never a hairline row. The leading plate says how far
 * to trust it. A verified page sits on a quiet plate with its space's icon; a page due for review
 * soon gets a filled amber block, a stale one a filled coral block, so the exceptions are the
 * only colour in the list. The meta line is the space, the owner as a face, and a real age.
 */
export function PageCell({
  page,
  showSpace = true,
  meta = "updated",
  spaceIcon = null,
  phoneHidden = false,
}: {
  /** Leave this cell out on phones (a long list keeps its first few there). */
  phoneHidden?: boolean;
  page: PageSummary;
  /** The page's space icon key, for the quiet plate of a verified page. */
  spaceIcon?: string | null;
  showSpace?: boolean;
  /** What the time shows: the last update, or the review date. */
  meta?: "updated" | "review";
}) {
  const href = `/knowledge/${page.spaceSlug}/${page.slug}`;
  const published = page.status === "published";
  const state = published ? page.freshness : null;
  const when =
    meta === "review" && page.reviewBy
      ? page.freshness === "stale"
        ? `Review was due ${formatDate(page.reviewBy, { day: "numeric", month: "short" })}`
        : `Review by ${formatDate(page.reviewBy, { day: "numeric", month: "short" })}`
      : `Updated ${timeAgo(page.updatedAt)}`;

  const plate =
    state === "stale" ? (
      <span className="cat-coral flex size-11 items-center justify-center rounded-[14px] shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]">
        <TriangleAlert className="size-5 stroke-[1.75]" aria-hidden />
      </span>
    ) : state === "due-soon" ? (
      <span className="cat-amber flex size-11 items-center justify-center rounded-[14px] shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]">
        <Clock className="size-5 stroke-[1.75]" aria-hidden />
      </span>
    ) : (
      <span className="flex size-11 items-center justify-center rounded-[14px] bg-sunken shadow-inset">
        {page.status === "draft" ? (
          <FilePen className="size-5 stroke-[1.5] text-info-text" aria-hidden />
        ) : page.status === "archived" ? (
          <Archive className="size-5 stroke-[1.5] text-muted" aria-hidden />
        ) : state === "unset" ? (
          <CalendarOff className="size-5 stroke-[1.5] text-muted" aria-hidden />
        ) : (
          <SpaceIcon name={spaceIcon} size="lg" className="text-muted" />
        )}
      </span>
    );

  const chip = !published ? (
    <Badge size="sm" tone={page.status === "draft" ? "info" : "neutral"} dot>
      {page.status === "draft" ? "Draft" : "Archived"}
    </Badge>
  ) : state === "stale" ? (
    <span className="cat-coral inline-flex h-7 items-center rounded-full px-2.5 text-caption font-medium">Stale</span>
  ) : state === "due-soon" ? (
    <span className="cat-amber inline-flex h-7 items-center rounded-full px-2.5 text-caption font-medium">Due soon</span>
  ) : state === "unset" ? (
    <Badge size="sm" tone="neutral">
      No review date
    </Badge>
  ) : null;

  return (
    <RowCell
      wrapperClassName={phoneHidden ? "hidden md:block" : undefined}
      href={href}
      leading={plate}
      title={page.title}
      meta={
        <CellMeta
          items={[
            showSpace ? <span className="truncate">{page.spaceName}</span> : null,
            page.ownerName ? (
              <span className="hidden items-center gap-1.5 sm:inline-flex">
                <Avatar name={page.ownerName} seed={page.ownerId} size="xs" />
                <span className="truncate">{page.ownerName}</span>
              </span>
            ) : null,
            <span className={cn("whitespace-nowrap", state === "stale" && meta === "review" && "font-medium text-cat-coral-text")}>{when}</span>,
          ]}
        />
      }
      trailing={chip ? <span className="hidden sm:inline-flex">{chip}</span> : undefined}
      aria-label={`${page.title}${state === "stale" ? ", stale" : state === "due-soon" ? ", due for review soon" : !published ? `, ${page.status}` : ""}`}
    />
  );
}

/** Kept for importers written before wave 3. */
export const PageRow = PageCell;
