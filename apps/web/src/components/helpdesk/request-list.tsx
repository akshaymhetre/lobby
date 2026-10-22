import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";
import { SlaDue, StatusBadge, type TicketStatus } from "./badges";

export interface RequestListRow {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  updatedAt: Date;
  requestTypeName: string | null;
  requestTypeIcon: string | null;
  teamName: string;
  assigneeName: string | null;
  resolutionDueAt: Date | null;
  resolvedAt: Date | null;
  /** Set by list pages for pending_approval requests (approvalProgressFor). */
  approvalProgress?: { done: number; total: number } | null;
}

const OPEN = new Set(["new", "open", "waiting_on_requester"]);

/**
 * The requester's view of their tickets (audit E4): 56px rows, the number in subtle tabular figures,
 * the subject at 500, the status chip and the due text right-aligned. No icon tile.
 * `compact` is the rail version: two lines, no type column.
 */
export function RequestList({
  rows,
  compact = false,
}: {
  rows: RequestListRow[];
  compact?: boolean;
}) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => {
        const when =
          OPEN.has(r.status) && r.resolutionDueAt ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="text-subtle">Due</span>
              <SlaDue due={r.resolutionDueAt} doneAt={r.resolvedAt} label="Resolution" />
            </span>
          ) : (
            <span className="whitespace-nowrap text-subtle" suppressHydrationWarning>
              Updated {timeAgo(r.updatedAt)}
            </span>
          );
        return (
          <li key={r.id}>
            <Link
              href={`/help/${r.number}`}
              className={cn(
                "focus-ring group flex items-center gap-3 transition-colors duration-120 ease-standard hover:bg-raised focus-visible:-outline-offset-2 dark:hover:bg-hover",
                compact ? "min-h-12 rounded-control px-2 py-2" : "min-h-14 px-4 py-2.5 sm:px-5",
              )}
            >
              <span className="tabular hidden w-12 shrink-0 text-small text-subtle sm:inline">
                #{r.number}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="tabular shrink-0 text-small text-subtle sm:hidden">
                    #{r.number}
                  </span>
                  <span className="truncate text-body font-medium text-fg">{r.subject}</span>
                </span>
                <span
                  className={cn(
                    "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted",
                    !compact && "sm:hidden",
                  )}
                >
                  <StatusBadge status={r.status} size="sm" />
                  {when}
                </span>
                {!compact ? (
                  <span className="hidden truncate text-small text-muted sm:block">
                    {r.requestTypeName ?? r.teamName}
                    {r.assigneeName ? ` · ${r.assigneeName}` : ""}
                  </span>
                ) : null}
              </span>
              {!compact ? (
                <span className="hidden shrink-0 items-center gap-3 text-small text-muted sm:flex">
                  {when}
                  <StatusBadge status={r.status} size="sm" />
                </span>
              ) : null}
              <ChevronRight
                className="size-4 shrink-0 stroke-[1.5] text-subtle transition-colors duration-120 group-hover:text-muted"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
