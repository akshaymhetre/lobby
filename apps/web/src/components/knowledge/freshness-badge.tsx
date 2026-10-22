import { Badge, type BadgeTone } from "@/components/ui/badge";
import { freshnessLabel, type FreshnessState } from "@lobby/core/knowledge/freshness";
import { formatDate } from "@/lib/time";

/*
 * In Knowledge the category colours belong to freshness: green = verified, amber = due for
 * review soon, coral = stale. The chip carries a dot and a word, so colour is never the only signal.
 */
export const FRESHNESS_TONE: Record<FreshnessState, BadgeTone> = {
  verified: "green",
  "due-soon": "amber",
  stale: "coral",
  unset: "neutral",
};

/** Verified / Review due soon / Stale. */
export function FreshnessBadge({
  state,
  reviewBy,
  size = "md",
  className,
}: {
  state: FreshnessState;
  reviewBy?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const title =
    reviewBy && state !== "unset"
      ? state === "stale"
        ? `Review was due ${formatDate(reviewBy)}`
        : `Next review ${formatDate(reviewBy)}`
      : undefined;
  return (
    <Badge tone={FRESHNESS_TONE[state]} dot size={size} title={title} className={className}>
      {freshnessLabel(state)}
    </Badge>
  );
}
