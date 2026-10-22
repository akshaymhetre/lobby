import type { FreshnessState } from "@lobby/core/knowledge/freshness";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { cn } from "@/lib/cn";
import { FreshnessBadge } from "./freshness-badge";
import { PageTimeline } from "./trust-timeline";

const DAY = 86_400_000;
const daysLeft = (today: string, d: string) => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY);

/**
 * A knowledge page's own dateline, v2: a raised cell under the title that answers "can I trust
 * this?" before the reader starts. It carries the freshness chip and one plain sentence, then the
 * page's span of trust drawn as a track from its last check to its next, with today marked in blue.
 * A stale page turns the cell coral, and a light makes one or two trips around it (more vivid when
 * the reader is the one who can fix it).
 */
export function PageDateline({
  state,
  verifiedAt,
  verifiedBy,
  reviewBy,
  today,
  attention = false,
  className,
}: {
  state: FreshnessState;
  verifiedAt: Date | string | null;
  verifiedBy: string | null;
  reviewBy: string | null;
  /** YYYY-MM-DD, from the server, so the track and the words agree. */
  today: string;
  /** The reader owns or can review this page, so a stale one is theirs to fix. */
  attention?: boolean;
  className?: string;
}) {
  const stale = state === "stale";
  const verifiedOn = verifiedAt ? new Date(verifiedAt).toISOString().slice(0, 10) : null;
  const left = reviewBy ? daysLeft(today, reviewBy) : null;
  const sentence =
    left === null
      ? "This page has no review date, so nobody is reminded to check it."
      : stale
        ? attention
          ? "Some details may be out of date. Check it is still right, then mark it as reviewed."
          : "Some details may be out of date. The owner has been reminded to check it."
        : state === "due-soon"
          ? `Checked and current. Its owner is due to look at it again ${left === 0 ? "today" : left === 1 ? "tomorrow" : `within ${left} days`}.`
          : "Checked and current. Its owner looks at it again on the date below.";

  return (
    <div
      className={cn("relative isolate flex flex-col gap-4 overflow-hidden rounded-card px-4 py-4 sm:px-5", stale ? "bg-cat-coral-soft/70 shadow-cell" : "cell", className)}
      data-page-dateline
      data-freshness={state}
    >
      {stale ? (
        <BorderBeam
          tone="danger"
          color="var(--lb-cat-coral-from)"
          intensity={attention ? "vivid" : "subtle"}
          loops={attention ? 2 : 1}
          duration={2.8}
          delay={1.2}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FreshnessBadge state={state} reviewBy={reviewBy} />
        <p className={cn("min-w-0 flex-1 basis-[240px] text-small", stale ? "font-medium text-cat-coral-text" : "text-muted")}>{sentence}</p>
      </div>
      {reviewBy ? <PageTimeline state={state} verifiedOn={verifiedOn} verifiedBy={verifiedBy} reviewBy={reviewBy} today={today} /> : null}
    </div>
  );
}
