/**
 * The freshness engine's rules, as pure functions so the web app, the worker and the tests agree.
 * Every published page has an owner and a review-by date. Trust is visible on the page and
 * feeds search ranking: stale content sinks, and long-stale content is archived.
 */

/** Default gap between reviews when an owner marks a page as reviewed. */
export const REVIEW_INTERVAL_DAYS = 180;
/** Owners are reminded this many days before the review date. */
export const DUE_SOON_DAYS = 14;
/** Pages this many days past their review date are archived automatically. */
export const ARCHIVE_AFTER_STALE_DAYS = 60;

export type FreshnessState = "verified" | "due-soon" | "stale" | "unset";

/** Search rank multiplier per state. */
export const FRESHNESS_FACTOR: Record<FreshnessState, number> = {
  verified: 1,
  "due-soon": 0.7,
  stale: 0.4,
  unset: 0.7,
};

/** Today's date as YYYY-MM-DD (UTC). */
export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). Positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export function freshnessState(reviewBy: string | null | undefined, today = todayIso()): FreshnessState {
  if (!reviewBy) return "unset";
  const left = daysBetween(today, reviewBy);
  if (left < 0) return "stale";
  if (left <= DUE_SOON_DAYS) return "due-soon";
  return "verified";
}

export function freshnessFactor(reviewBy: string | null | undefined, today = todayIso()): number {
  return FRESHNESS_FACTOR[freshnessState(reviewBy, today)];
}

/** Human label for the badge. Never colour alone: the word carries the meaning. */
export function freshnessLabel(state: FreshnessState): string {
  return { verified: "Verified", "due-soon": "Review due soon", stale: "Stale", unset: "No review date" }[state];
}

export type ReminderKind = "soon" | "due";

/**
 * Which reminder (if any) the daily tick should send for a page. Each one goes out once per
 * review date: `lastReminder` records "<reviewBy>:<kind>". Robust to missed days, because it
 * compares windows rather than exact dates.
 */
export function reminderToSend(
  page: { reviewBy: string | null; lastReminder: string | null },
  today = todayIso(),
): ReminderKind | null {
  if (!page.reviewBy) return null;
  const left = daysBetween(today, page.reviewBy);
  const sent = page.lastReminder ?? "";
  if (left <= 0) return sent === `${page.reviewBy}:due` ? null : "due";
  if (left <= DUE_SOON_DAYS) return sent.startsWith(`${page.reviewBy}:`) ? null : "soon";
  return null;
}

/** True when a page has been stale long enough to archive. */
export function shouldArchive(reviewBy: string | null, today = todayIso(), graceDays = ARCHIVE_AFTER_STALE_DAYS): boolean {
  if (!reviewBy) return false;
  return daysBetween(reviewBy, today) > graceDays;
}
