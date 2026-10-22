/** Pure helpers for the home page. Unit tested; no database access. */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The one-line "Today" summary under the greeting.
 * e.g. "You have 3 things to do and 1 approval waiting."
 */
export function todaySentence(c: { tasks: number; approvals: number; tickets: number }): string {
  const parts: string[] = [];
  if (c.tasks) parts.push(plural(c.tasks, "thing to do", "things to do"));
  if (c.approvals) parts.push(`${plural(c.approvals, "approval", "approvals")} waiting`);
  if (c.tickets) parts.push(plural(c.tickets, "open request", "open requests"));
  if (!parts.length) return "Nothing needs you right now.";
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `You have ${list}.`;
}

/** "Good morning" / "Good afternoon" / "Good evening" for an hour 0..23. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Local hour (0..23) in an IANA timezone; falls back to UTC on an unknown zone. */
export function hourIn(timeZone: string | null | undefined, now = new Date()): number {
  try {
    const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timeZone || "UTC" }).format(now);
    return Number(h) % 24;
  } catch {
    return now.getUTCHours();
  }
}

export interface AnnouncementLike {
  startsAt: Date;
  endsAt: Date | null;
  mustAcknowledge: boolean;
  audienceGroupIds: string[];
}

export interface ReceiptLike {
  acknowledgedAt: Date | null;
  dismissedAt: Date | null;
}

/**
 * Whether an announcement should show on someone's home page right now:
 * within its window, in their audience, and not acknowledged (must-acknowledge ones cannot be
 * dismissed; other ones disappear once dismissed).
 */
export function shouldShowAnnouncement(
  a: AnnouncementLike,
  userGroupIds: readonly string[],
  receipt: ReceiptLike | null | undefined,
  now = new Date(),
): boolean {
  if (a.startsAt.getTime() > now.getTime()) return false;
  if (a.endsAt && a.endsAt.getTime() <= now.getTime()) return false;
  if (a.audienceGroupIds.length && !a.audienceGroupIds.some((g) => userGroupIds.includes(g))) return false;
  if (receipt?.acknowledgedAt) return false;
  if (!a.mustAcknowledge && receipt?.dismissedAt) return false;
  return true;
}

/** YYYY-MM-DD for a UTC date offset by `days` from `now`. */
export function isoDay(days: number, now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The new-joiner window: started in the last 30 days or starting in the next 14. */
export function newJoinerWindow(now = new Date()): { from: string; to: string } {
  return { from: isoDay(-30, now), to: isoDay(14, now) };
}

/** Whole days from today to a YYYY-MM-DD date (negative = in the past). */
export function daysUntil(day: string, now = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const [y, m, d] = day.split("-").map(Number);
  return Math.round((Date.UTC(y!, m! - 1, d!) - today) / 86_400_000);
}

/** "Starts tomorrow", "Started today", "Started 5 days ago", "Starts in 9 days". */
export function startPhrase(day: string, now = new Date()): string {
  const n = daysUntil(day, now);
  if (n === 0) return "Starts today";
  if (n === 1) return "Starts tomorrow";
  if (n > 1) return `Starts in ${n} days`;
  if (n === -1) return "Started yesterday";
  if (n > -7) return `Started ${-n} days ago`;
  const weeks = Math.round(-n / 7);
  return `Started ${weeks === 1 ? "a week" : `${weeks} weeks`} ago`;
}

/**
 * Next payday when people are paid on the last working day (Mon-Fri) of the month.
 * Returns today if today is payday.
 */
export function nextPayday(now = new Date(), workingDays: readonly number[] = [1, 2, 3, 4, 5]): Date {
  const lastWorkingDay = (y: number, m: number) => {
    const d = new Date(Date.UTC(y, m + 1, 0));
    while (!workingDays.includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() - 1);
    return d;
  };
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const thisMonth = lastWorkingDay(today.getUTCFullYear(), today.getUTCMonth());
  if (thisMonth.getTime() >= today.getTime()) return thisMonth;
  return lastWorkingDay(today.getUTCFullYear(), today.getUTCMonth() + 1);
}

/**
 * Splits text with [label](href) links into parts. Only internal paths ("/...") and https URLs
 * become links; anything else stays as plain text.
 */
export function linkParts(text: string): ({ text: string } | { text: string; href: string })[] {
  const out: ({ text: string } | { text: string; href: string })[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const href = m[2]!;
    const safe = (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("https://");
    out.push(safe ? { text: m[1]!, href } : { text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Trims and validates a short message (comments, greetings). */
export function cleanMessage(raw: string, max = 2000): string {
  const v = raw.replace(/\r\n/g, "\n").trim();
  if (!v) throw new Error("Write a message first.");
  if (v.length > max) throw new Error(`Keep it under ${max} characters.`);
  return v;
}
