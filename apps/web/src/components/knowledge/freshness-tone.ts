import type { FreshnessState } from "@lobby/core/knowledge/freshness";

/*
 * In Knowledge the category colours mean freshness and nothing else: green = verified,
 * amber = due for review soon, coral = stale, hatched grey = no review date. Every viz in this
 * area reads its fills from here so the three meanings never drift apart.
 */
export const FRESH: Record<FreshnessState, { fill: string; dot: string; text: string; soft: string; label: string; short: string }> = {
  verified: { fill: "cat-green", dot: "bg-cat-green", text: "text-cat-green-text", soft: "bg-cat-green-soft", label: "Verified", short: "Verified" },
  // Dark mode lifts amber to its bright text tone: the dark gradient reads as brown at dot size.
  "due-soon": { fill: "cat-amber dark:bg-none dark:bg-cat-amber-text dark:text-page", dot: "bg-cat-amber dark:bg-cat-amber-text", text: "text-cat-amber-text", soft: "bg-cat-amber-soft", label: "Review due soon", short: "Due soon" },
  stale: { fill: "cat-coral", dot: "bg-cat-coral", text: "text-cat-coral-text", soft: "bg-cat-coral-soft", label: "Stale", short: "Stale" },
  unset: { fill: "hatch", dot: "bg-border-strong", text: "text-muted", soft: "bg-sunken", label: "No review date", short: "No date" },
};

export const FRESH_ORDER: FreshnessState[] = ["verified", "due-soon", "stale", "unset"];

const DAY = 86_400_000;
export const toUtc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
export const isoAddDays = (d: string, n: number) => new Date(toUtc(d) + n * DAY).toISOString().slice(0, 10);
export const isoDaysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY);
export const isoFmt = (d: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(toUtc(d)));

/** "in 3 days", "today", "19 days overdue". */
export function dueWords(days: number): string {
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${-days} days overdue`;
  return `in ${days} days`;
}

/** First-of-month dates strictly inside (start, end], for axis ticks. */
export function monthTicks(start: string, end: string): string[] {
  const out: string[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  for (let i = 0; i < 36; i++) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const d = `${y}-${String(m).padStart(2, "0")}-01`;
    if (d > end) break;
    out.push(d);
  }
  return out;
}
