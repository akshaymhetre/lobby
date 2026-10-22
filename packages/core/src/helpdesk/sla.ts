/**
 * Business-hours maths for helpdesk SLAs. Pure functions, no database, no dependencies.
 *
 * A calendar says when a team is working: an IANA timezone, ISO weekdays (1 = Monday),
 * a daily window in minutes after local midnight, and holiday dates (YYYY-MM-DD, local).
 * When endMinute <= startMinute the window runs overnight into the next local day; the
 * shift belongs to the day it starts on (its workday and holiday status decide).
 *
 * All windows are converted to real instants before any arithmetic, so a DST change
 * inside a window counts the minutes that actually pass on the clock.
 */

export interface BusinessCalendar {
  timezone: string;
  workDays: number[];
  startMinute: number;
  endMinute: number;
  holidays: string[];
}

export type SlaPriority = "low" | "normal" | "high" | "urgent";
export type SlaTargets = Record<SlaPriority, { firstResponse: number; resolution: number }>;

const MINUTE = 60_000;
const DAY_LIMIT = 3 * 366; // never loop forever on a calendar with no reachable working time

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a timezone. */
export function zonedParts(date: Date, timeZone: string): LocalParts {
  const out: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    hour: out.hour === 24 ? 0 : out.hour!,
    minute: out.minute!,
    second: out.second!,
  };
}

/** Offset of the timezone from UTC at an instant, in milliseconds (London summer = +3_600_000). */
function offsetAt(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The instant at which a local wall-clock time occurs. `minuteOfDay` may be 1440 (next midnight).
 * Times skipped by a spring-forward gap are shifted forward by the gap length (01:30 becomes 02:30);
 * times repeated in a fall-back hour resolve to the first occurrence.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, minuteOfDay: number, timeZone: string): Date {
  const naive = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  // Two passes converge for every real-world zone; the second fixes guesses that straddle a transition.
  let guess = naive - offsetAt(new Date(naive), timeZone);
  const second = naive - offsetAt(new Date(guess), timeZone);
  if (second !== guess) {
    const third = naive - offsetAt(new Date(second), timeZone);
    // In a gap neither guess round-trips; take the later instant (just after the gap).
    guess = third === second ? second : Math.max(second, guess);
  }
  // Fall-back: prefer the earlier of the two instants that show this wall time.
  const earlier = guess - 3_600_000;
  const pe = zonedParts(new Date(earlier), timeZone);
  const pg = zonedParts(new Date(guess), timeZone);
  if (pe.hour === pg.hour && pe.minute === pg.minute && pe.day === pg.day) return new Date(earlier);
  return new Date(guess);
}

/** YYYY-MM-DD for a local calendar date. */
const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** ISO weekday (1 = Monday) of a local calendar date. */
const isoWeekday = (y: number, m: number, d: number) => ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;

/** Calendar date arithmetic that ignores timezones entirely. */
function addDays(y: number, m: number, d: number, n: number): [number, number, number] {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
}

export function isWorkingDate(cal: BusinessCalendar, y: number, m: number, d: number): boolean {
  return cal.workDays.includes(isoWeekday(y, m, d)) && !cal.holidays.includes(ymd(y, m, d));
}

/** The working window (as instants) for the shift that starts on a local date, or null if it is not a working day. */
function windowFor(cal: BusinessCalendar, y: number, m: number, d: number): { start: Date; end: Date } | null {
  if (!isWorkingDate(cal, y, m, d)) return null;
  const start = zonedTimeToUtc(y, m, d, cal.startMinute, cal.timezone);
  const overnight = cal.endMinute <= cal.startMinute;
  const [ey, em, ed] = overnight ? addDays(y, m, d, 1) : [y, m, d];
  const end = zonedTimeToUtc(ey, em, ed, cal.endMinute, cal.timezone);
  return end > start ? { start, end } : null;
}

function validate(cal: BusinessCalendar) {
  if (cal.startMinute < 0 || cal.startMinute > 1440 || cal.endMinute < 0 || cal.endMinute > 1440) {
    throw new RangeError("calendar minutes must be between 0 and 1440");
  }
  // Throws RangeError for an unknown timezone.
  formatter(cal.timezone);
}

/** True when the calendar has any working time at all. */
function hasWorkingTime(cal: BusinessCalendar) {
  return cal.workDays.some((w) => w >= 1 && w <= 7) && cal.startMinute !== cal.endMinute;
}

/**
 * The instant `minutes` business minutes after `from`. Zero minutes snaps forward to the
 * next working moment. A calendar with no working time falls back to wall-clock minutes.
 */
export function addBusinessMinutes(from: Date, minutes: number, cal: BusinessCalendar): Date {
  validate(cal);
  if (!hasWorkingTime(cal)) return new Date(from.getTime() + minutes * MINUTE);
  let remaining = Math.max(0, minutes) * MINUTE;
  const local = zonedParts(from, cal.timezone);
  // Start one day early so an overnight shift that began yesterday is considered.
  let [y, m, d] = addDays(local.year, local.month, local.day, -1);
  for (let i = 0; i < DAY_LIMIT; i++, [y, m, d] = addDays(y, m, d, 1)) {
    const w = windowFor(cal, y, m, d);
    if (!w || w.end <= from) continue;
    const cursor = Math.max(w.start.getTime(), from.getTime());
    const available = w.end.getTime() - cursor;
    if (remaining <= available) return new Date(cursor + remaining);
    remaining -= available;
  }
  return new Date(from.getTime() + minutes * MINUTE);
}

/** Business minutes elapsed between two instants (0 when b <= a). */
export function businessMinutesBetween(a: Date, b: Date, cal: BusinessCalendar): number {
  validate(cal);
  if (b <= a) return 0;
  if (!hasWorkingTime(cal)) return Math.floor((b.getTime() - a.getTime()) / MINUTE);
  let total = 0;
  const local = zonedParts(a, cal.timezone);
  let [y, m, d] = addDays(local.year, local.month, local.day, -1);
  for (let i = 0; i < DAY_LIMIT; i++, [y, m, d] = addDays(y, m, d, 1)) {
    const w = windowFor(cal, y, m, d);
    if (!w) continue;
    if (w.start >= b) break;
    const s = Math.max(w.start.getTime(), a.getTime());
    const e = Math.min(w.end.getTime(), b.getTime());
    if (e > s) total += e - s;
  }
  return Math.floor(total / MINUTE);
}

/** True when an instant falls inside working time. */
export function isBusinessTime(at: Date, cal: BusinessCalendar): boolean {
  validate(cal);
  if (!hasWorkingTime(cal)) return true;
  const local = zonedParts(at, cal.timezone);
  for (const offset of [-1, 0]) {
    const [y, m, d] = addDays(local.year, local.month, local.day, offset);
    const w = windowFor(cal, y, m, d);
    if (w && at >= w.start && at < w.end) return true;
  }
  return false;
}

export interface SlaDueDates {
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
}

/**
 * Due dates for a ticket that starts its SLA clock at `start`. With no calendar the
 * targets are wall-clock minutes (a 24x7 team).
 */
export function computeDueDates(
  start: Date,
  priority: SlaPriority,
  targets: SlaTargets,
  cal: BusinessCalendar | null,
): SlaDueDates | null {
  const t = targets[priority];
  if (!t) return null;
  const add = (mins: number) => (cal ? addBusinessMinutes(start, mins, cal) : new Date(start.getTime() + mins * MINUTE));
  return { firstResponseDueAt: add(t.firstResponse), resolutionDueAt: add(t.resolution) };
}

export type SlaState = "met" | "ok" | "soon" | "breached" | "none";

/**
 * Display state of one SLA clock. "soon" means less than `soonMinutes` of wall-clock time left.
 * `doneAt` is when the target was met (first response sent, ticket resolved).
 */
export function slaState(
  due: Date | null | undefined,
  doneAt: Date | null | undefined,
  now: Date = new Date(),
  soonMinutes = 120,
): SlaState {
  if (!due) return "none";
  if (doneAt) return doneAt <= due ? "met" : "breached";
  if (now >= due) return "breached";
  return due.getTime() - now.getTime() <= soonMinutes * MINUTE ? "soon" : "ok";
}

/** "2h 15m", "3d 4h", "45m": compact human duration for SLA displays. */
export function formatMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}
