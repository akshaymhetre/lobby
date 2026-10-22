/**
 * Pure people helpers with no database access, safe to import from client components
 * (`@lobby/core/people/format`).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days from `today` to a YYYY-MM-DD date (positive = future). Compares calendar days in UTC. */
export function daysUntil(date: string, today: Date = new Date()): number {
  const target = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target - base) / DAY_MS);
}

/** Joined in the last 30 days (today included), not in the future. */
export function isNewJoiner(startDate: string | null | undefined, today: Date = new Date()): boolean {
  if (!startDate) return false;
  const d = daysUntil(startDate, today);
  return d <= 0 && d > -30;
}

/** Start date is in the future. */
export function isUpcomingStarter(startDate: string | null | undefined, today: Date = new Date()): boolean {
  return !!startDate && daysUntil(startDate, today) > 0;
}

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** "Starts tomorrow", "Starts on Monday 3 November", "Joined today", "Joined 12 days ago", "Joined March 2024". */
export function startLabel(startDate: string | null | undefined, today: Date = new Date()): string | null {
  if (!startDate) return null;
  const d = daysUntil(startDate, today);
  const at = new Date(`${startDate}T12:00:00Z`);
  if (d === 1) return "Starts tomorrow";
  if (d > 1 && d <= 6) return `Starts in ${d} days`;
  if (d > 6) return `Starts on ${dayMonth.format(at)}`;
  if (d === 0) return "Joined today";
  if (d === -1) return "Joined yesterday";
  if (d > -30) return `Joined ${-d} days ago`;
  return `Joined ${monthYear.format(at)}`;
}

/** True when the string is an IANA zone the runtime understands. */
export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "4:12 pm" in the person's zone, or null without a usable zone. */
export function localTime(tz: string | null | undefined, now: Date = new Date()): string | null {
  if (!isValidTimezone(tz)) return null;
  return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz })
    .format(now)
    .replace(/\s?([ap])\.?m\.?/i, " $1m")
    .toLowerCase();
}

/** Minutes since local midnight in a zone. */
function localMinutes(tz: string, now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** Parses "09:00-17:30" into minutes since midnight. */
export function parseWorkingHours(value: string | null | undefined): { start: number; end: number } | null {
  const m = value?.trim().match(/^(\d{1,2}):(\d{2})\s*[-\u2013]\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  if (start >= 24 * 60 || end > 24 * 60 || start === end) return null;
  return { start, end };
}

/** Whether someone is inside their working hours right now; null when unknown. */
export function isWorkingNow(tz: string | null | undefined, hours: string | null | undefined, now: Date = new Date()): boolean | null {
  const h = parseWorkingHours(hours);
  if (!h || !isValidTimezone(tz)) return null;
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz }).format(now);
  if (day === "Sat" || day === "Sun") return false;
  const t = localMinutes(tz, now);
  return h.start < h.end ? t >= h.start && t < h.end : t >= h.start || t < h.end;
}

/** "9:00 am to 5:30 pm" from "09:00-17:30". */
export function formatWorkingHours(value: string | null | undefined): string | null {
  const h = parseWorkingHours(value);
  if (!h) return value?.trim() || null;
  const fmt = (min: number) => {
    const hh = Math.floor(min / 60) % 24;
    const mm = min % 60;
    const suffix = hh < 12 ? "am" : "pm";
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
  };
  return `${fmt(h.start)} to ${fmt(h.end)}`;
}

/** Normalises a skills list: trimmed, de-duplicated case-insensitively, max 30 of max 40 chars. */
export function normaliseSkills(input: string[] | string): string[] {
  const raw = Array.isArray(input) ? input : input.split(/[,\n]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const v = s.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length >= 30) break;
  }
  return out;
}
