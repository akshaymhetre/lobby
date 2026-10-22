/**
 * Pure date maths for journeys. No database access, safe to import from client components
 * (`@lobby/core/journeys/dates`). Dates are YYYY-MM-DD strings, compared as UTC calendar days.
 */

export type JourneyKind = "onboarding" | "offboarding";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

function toUtc(date: string): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUtc(value)) && fromUtc(toUtc(value)) === value;
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Whole calendar days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** ISO weekday, 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const d = new Date(toUtc(date)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Today's calendar date in a time zone, e.g. the company's. */
export function todayIn(timeZone = "UTC", now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * The due date of a step: anchor + offset calendar days. Day 1 itself is never moved, but a
 * step that would land on a non-working day moves to a working day: forward for steps after
 * the anchor, backward for preparation steps before it (so prep is never late by design).
 */
export function dueDateFor(anchorDate: string, dayOffset: number, workingDays: number[] = DEFAULT_WORKING_DAYS): string {
  let d = addDays(anchorDate, dayOffset);
  if (dayOffset === 0 || workingDays.length === 0) return d;
  const step = dayOffset > 0 ? 1 : -1;
  for (let i = 0; i < 7 && !workingDays.includes(isoWeekday(d)); i++) d = addDays(d, step);
  return d;
}

export interface Phase {
  key: string;
  label: string;
  /** Sort order of the phase in a timeline. */
  order: number;
}

/** The day-marker group a step belongs to in the navigator timeline. */
export function phaseFor(dayOffset: number, kind: JourneyKind = "onboarding"): Phase {
  if (kind === "offboarding") {
    if (dayOffset <= -7) return { key: "before-last-week", label: "Before the last week", order: 0 };
    if (dayOffset < 0) return { key: "last-week", label: "Last week", order: 1 };
    if (dayOffset === 0) return { key: "last-day", label: "Last day", order: 2 };
    return { key: "after", label: "After leaving", order: 3 };
  }
  if (dayOffset < 0) return { key: "before", label: "Before day 1", order: 0 };
  if (dayOffset === 0) return { key: "day-1", label: "Day 1", order: 1 };
  if (dayOffset < 7) return { key: "week-1", label: "Week 1", order: 2 };
  if (dayOffset < 14) return { key: "week-2", label: "Week 2", order: 3 };
  if (dayOffset < 30) return { key: "month-1", label: "Month 1", order: 4 };
  if (dayOffset < 60) return { key: "month-2", label: "Month 2", order: 5 };
  if (dayOffset < 90) return { key: "month-3", label: "Month 3", order: 6 };
  return { key: "later", label: "Later", order: 7 };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Human description of an offset: "3 days before start", "On day 1", "Day 3", "Start of week 2". */
export function describeOffset(dayOffset: number, kind: JourneyKind = "onboarding"): string {
  const n = Math.abs(dayOffset);
  if (kind === "offboarding") {
    if (dayOffset === 0) return "On the last day";
    if (dayOffset < 0) return n % 7 === 0 ? `${plural(n / 7, "week")} before the last day` : `${plural(n, "day")} before the last day`;
    return `${plural(n, "day")} after leaving`;
  }
  if (dayOffset === 0) return "On day 1";
  if (dayOffset < 0) return n % 7 === 0 ? `${plural(n / 7, "week")} before start` : `${plural(n, "day")} before start`;
  if (dayOffset % 7 === 0) return `Start of week ${dayOffset / 7 + 1}`;
  return `Day ${dayOffset + 1}`;
}

/**
 * Splits an offset into the builder's "amount, unit, direction" input and back.
 * Weeks are used when the offset is a whole number of weeks.
 */
export interface OffsetParts {
  amount: number;
  unit: "days" | "weeks";
  direction: "before" | "on" | "after";
}

export function offsetToParts(dayOffset: number): OffsetParts {
  if (dayOffset === 0) return { amount: 0, unit: "days", direction: "on" };
  const n = Math.abs(dayOffset);
  const direction = dayOffset < 0 ? "before" : "after";
  return n % 7 === 0 ? { amount: n / 7, unit: "weeks", direction } : { amount: n, unit: "days", direction };
}

export function partsToOffset(p: OffsetParts): number {
  if (p.direction === "on") return 0;
  const days = Math.max(0, Math.round(p.amount)) * (p.unit === "weeks" ? 7 : 1);
  return p.direction === "before" ? -days : days;
}

/** "Day 3 of your first month", "You start tomorrow", "Week 7". `today` and `anchor` are YYYY-MM-DD. */
export function journeyDayLabel(anchorDate: string, today: string, kind: JourneyKind = "onboarding"): string {
  const diff = daysBetween(anchorDate, today);
  if (kind === "offboarding") {
    if (diff < -1) return `${plural(-diff, "day")} until your last day`;
    if (diff === -1) return "Your last day is tomorrow";
    if (diff === 0) return "Today is your last day";
    return "Your last day has passed";
  }
  if (diff === -1) return "You start tomorrow";
  if (diff < -1) return `${plural(-diff, "day")} until your first day`;
  const day = diff + 1;
  if (day <= 30) return `Day ${day} of your first month`;
  if (day <= 60) return `Day ${day}, your second month`;
  return `Week ${Math.ceil(day / 7)}`;
}

/** Whole days a due date is late by (0 when not late). */
export function daysOverdue(dueDate: string, today: string): number {
  return Math.max(0, daysBetween(dueDate, today));
}

/** Third-person timing for lists: "Starts tomorrow", "Day 8", "Leaves in 5 days". */
export function runTimingLabel(anchorDate: string, today: string, kind: JourneyKind = "onboarding"): string {
  const diff = daysBetween(anchorDate, today);
  if (kind === "offboarding") {
    if (diff < -1) return `Leaves in ${plural(-diff, "day")}`;
    if (diff === -1) return "Leaves tomorrow";
    if (diff === 0) return "Last day today";
    return `Left ${plural(diff, "day")} ago`;
  }
  if (diff < -1) return `Starts in ${plural(-diff, "day")}`;
  if (diff === -1) return "Starts tomorrow";
  if (diff === 0) return "Day 1 today";
  return `Day ${diff + 1}`;
}

const shortDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "Fri 16 Oct". */
export function formatDay(date: string): string {
  return shortDate.format(new Date(`${date}T12:00:00Z`));
}

/** "Today", "Tomorrow", "Yesterday", "Fri 16 Oct". */
export function relativeDay(date: string, today: string): string {
  const d = daysBetween(today, date);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return formatDay(date);
}

/** Due line for a pending step: "Due today", "Overdue by 2 days", "Due Fri 16 Oct". */
export function dueLabel(dueDate: string, today: string): string {
  const d = daysBetween(today, dueDate);
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d < 0) return `Overdue by ${plural(-d, "day")}`;
  return `Due ${formatDay(dueDate)}`;
}
