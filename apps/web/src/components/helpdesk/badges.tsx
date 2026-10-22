"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUp, Clock3, Equal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/time";

export {
  statusLabel,
  STATUS_TONE,
  PRIORITY_OPTIONS,
  type TicketStatus,
  type Priority,
} from "./status";
import { statusLabel, STATUS_TONE, type Priority, type TicketStatus } from "./status";

export function StatusBadge({
  status,
  perspective = "requester",
  size,
  approvalProgress,
}: {
  status: TicketStatus;
  perspective?: "requester" | "agent";
  size?: "sm" | "md";
  /** A two-step approval part way through says "1 of 2 approved", never a bare "In approval". */
  approvalProgress?: { done: number; total: number } | null;
}) {
  // Waiting on an approver is not work the team can do yet: a quiet neutral chip with a clock,
  // so it never reads like the blue "in progress" states in a dense column.
  if (status === "pending_approval") {
    return (
      <Badge tone="neutral" size={size} className="gap-1 [&_svg]:size-3 [&_svg]:stroke-[2]">
        <Clock3 aria-hidden />
        {approvalProgress && approvalProgress.total > 1 && approvalProgress.done > 0
          ? `${approvalProgress.done} of ${approvalProgress.total} approved`
          : statusLabel(status, perspective)}
      </Badge>
    );
  }
  return (
    <Badge tone={STATUS_TONE[status]} dot size={size}>
      {statusLabel(status, perspective)}
    </Badge>
  );
}

const PRIORITY: Record<Priority, { label: string; icon: React.ReactNode; className: string }> = {
  urgent: { label: "Urgent", icon: <ChevronsUp aria-hidden />, className: "text-danger-text" },
  high: { label: "High", icon: <ArrowUp aria-hidden />, className: "text-warning-text" },
  normal: { label: "Normal", icon: <Equal aria-hidden />, className: "text-muted" },
  low: { label: "Low", icon: <ArrowDown aria-hidden />, className: "text-subtle" },
};

export function PriorityLabel({ priority, className }: { priority: Priority; className?: string }) {
  const p = PRIORITY[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-small font-medium [&_svg]:size-3.5 [&_svg]:stroke-[2]",
        p.className,
        className,
      )}
    >
      {p.icon}
      <span className={priority === "normal" || priority === "low" ? "text-muted" : undefined}>
        {p.label}
      </span>
    </span>
  );
}

export { compact } from "./track-data";
import { compact } from "./track-data";

/** Re-renders every 30s so SLA countdowns stay honest without a reload. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type SlaTone = "met" | "ok" | "soon" | "breached" | "none";

/**
 * SLA due time as relative text with a warning (under 2 hours) or danger (overdue) state.
 * `doneAt` marks the clock as met or missed.
 */
export function SlaDue({
  due,
  doneAt,
  breachedAt,
  variant = "inline",
  label,
}: {
  due: string | Date | null | undefined;
  doneAt?: string | Date | null;
  breachedAt?: string | Date | null;
  /** `block`: the queue's due cell. Overdue is a filled red-to-amber block, the last two hours a
   *  filled amber block, anything else stays quiet text, so the eye finds the late rows first. */
  variant?: "inline" | "badge" | "block";
  label?: string;
}) {
  const now = useNow();
  if (!due) return <span className="text-small text-muted">No target</span>;
  const dueMs = new Date(due).getTime();
  const done = doneAt ? new Date(doneAt).getTime() : null;
  // Server and first client render use their own clock; the text may differ by a minute, hence suppressHydrationWarning.
  const ref = now ?? Date.now();
  let tone: SlaTone;
  let text: string;
  if (done) {
    tone = done <= dueMs && !breachedAt ? "met" : "breached";
    text = tone === "met" ? "Met" : `Missed by ${compact(done - dueMs)}`;
  } else if (ref >= dueMs || breachedAt) {
    tone = "breached";
    text = `${compact(ref - dueMs)} overdue`;
  } else {
    tone = dueMs - ref <= 2 * 3600_000 ? "soon" : "ok";
    text = `in ${compact(dueMs - ref)}`;
  }
  const title = `${label ? `${label} ` : ""}due ${formatDateTime(due)}`;
  const content =
    variant === "block" && (tone === "breached" || tone === "soon") ? (
      <span
        className={cn(
          "tabular inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-cell pl-2 text-small font-medium shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]",
          tone === "breached"
            ? // White text sits over the coral half only; the amber tail is past the text.
              "pr-7 text-white [background:linear-gradient(90deg,var(--lb-cat-coral-to)_0%,var(--lb-cat-coral-from)_80%,var(--lb-cat-amber-to)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_6px_14px_-8px_var(--lb-cat-coral-from)]"
            : "cat-amber pr-2.5",
        )}
      >
        <span aria-hidden className={cn("size-1.5 rounded-full", tone === "breached" ? "bg-white" : "bg-[var(--lb-cat-amber-on)]")} />
        {/* "late" not "overdue": the block must fit the queue's Due column at 1440. */}
        <span suppressHydrationWarning>{tone === "breached" ? text.replace(/ overdue$/, " late") : text}</span>
      </span>
    ) : variant === "badge" ? (
      <Badge
        tone={
          tone === "breached"
            ? "danger"
            : tone === "soon"
              ? "warning"
              : tone === "met"
                ? "success"
                : "neutral"
        }
        dot
        size="sm"
        className="tabular"
      >
        <span suppressHydrationWarning>{text}</span>
      </Badge>
    ) : (
      <span
        className={cn(
          "tabular inline-flex items-center gap-1.5 whitespace-nowrap text-small",
          tone === "breached" && "font-medium text-danger-text",
          tone === "soon" && "font-medium text-warning-text",
          tone === "met" && "text-success-text",
          tone === "ok" && "text-muted",
        )}
      >
        {tone === "breached" || tone === "soon" ? (
          <span
            className={cn(
              "size-1.5 rounded-full",
              tone === "breached" ? "bg-danger" : "bg-warning",
            )}
            aria-hidden
          />
        ) : null}
        <span suppressHydrationWarning>{text}</span>
      </span>
    );
  return (
    <Tooltip label={title}>
      <span
        tabIndex={0}
        className="focus-ring -my-1 inline-flex min-h-6 items-center rounded-[4px]"
        aria-label={`${title}: ${text}`}
      >
        {content}
      </span>
    </Tooltip>
  );
}
