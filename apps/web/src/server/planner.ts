import "server-only";
import { and, asc, db, eq, gte, inArray, isNull, lte, ne, or, s } from "@lobby/db";
import { type UserContext } from "@lobby/core";
import { nextPayday, shouldShowAnnouncement } from "@lobby/core/home";
import { canManageJourneys, personalise } from "@lobby/core/journeys";
import { ticketSlaState } from "@lobby/core/helpdesk";
import { OPEN_REQUEST_STATUSES } from "@lobby/core/counts";

/**
 * Read models for the Home hero ("This week" planner) and the Onboarding card.
 * Read-only. Every row is filtered by what the acting user may see:
 *   - the viewer's own requests, approvals and steps
 *   - direct reports' onboarding steps (a manager sees their reports' journeys)
 *   - every active run when the viewer manages journeys (admin or People team)
 *   - new joiners' start days (directory data, visible to everyone)
 *   - company-wide items (acknowledgement deadlines, payday) in the viewer's audience
 * Teammates' requests, approvals and private steps are never shown.
 */

export type PlannerCategory = "onboarding" | "joiner" | "request" | "approval" | "announcement" | "payday";

export interface PlannerStat {
  label: string;
  value: number;
  suffix?: string;
}

export interface PlannerBlock {
  id: string;
  category: PlannerCategory;
  /** Short label on the block. */
  label: string;
  /** First day (YYYY-MM-DD), inclusive. */
  day: string;
  /** Last day, inclusive. Equal to `day` for a one-day item. */
  endDay: string;
  status: { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" };
  href: string;
  /** Detail panel content. */
  panel: {
    kicker: string;
    title: string;
    summary: string;
    stats: PlannerStat[];
    facts: { label: string; value: string }[];
    action: { href: string; label: string };
  };
}

export interface PlannerRow {
  id: string;
  kind: "company" | "me" | "report" | "team" | "joiner";
  name: string;
  subtitle: string | null;
  seed: string;
  avatarUrl: string | null;
  blocks: PlannerBlock[];
}

export interface PlannerData {
  /** First column, a Monday (YYYY-MM-DD). */
  start: string;
  /** Number of day columns. */
  days: number;
  today: string;
  workingDays: number[];
  rows: PlannerRow[];
  /** Items that fall on today or later across every row. */
  dueCount: number;
}

const DAY = 86_400_000;
const toUtc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromUtc(toUtc(d) + n * DAY);
export const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY);

/** Today as YYYY-MM-DD in a timezone. */
function todayIn(tz: string, now: Date): string {
  try {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const get = (t: string) => p.find((x) => x.type === t)!.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

const dayOf = (d: Date, tz: string) => todayIn(tz, d);

const cols = {
  id: s.users.id,
  displayName: s.users.displayName,
  firstName: s.users.firstName,
  title: s.users.title,
  avatarUrl: s.users.avatarUrl,
  startDate: s.users.startDate,
  managerId: s.users.managerId,
  location: s.users.location,
};

const active = () => and(eq(s.users.status, "active"), eq(s.users.isBreakGlass, false))!;

const TICKET_STATUS: Record<string, string> = {
  new: "Waiting for the team",
  open: "In progress",
  pending_approval: "Waiting for approval",
  waiting_on_requester: "Waiting on you",
};

export async function getPlanner(
  ctx: UserContext,
  org: { timezone: string; workingDays: number[]; companyName: string },
  now = new Date(),
): Promise<PlannerData> {
  const tz = ctx.user.timezone || org.timezone;
  const today = todayIn(tz, now);
  // Monday of this week, then three weeks: this one and the two after it.
  const dow = new Date(toUtc(today)).getUTCDay();
  const start = addDays(today, -((dow + 6) % 7));
  const days = 21;
  const end = addDays(start, days - 1);
  const uid = ctx.user.id;
  const manages = await canManageJourneys(ctx);

  const [reports, teammates, joiners] = await Promise.all([
    db.select(cols).from(s.users).where(and(active(), eq(s.users.managerId, uid))).orderBy(asc(s.users.displayName)),
    ctx.user.managerId
      ? db
          .select(cols)
          .from(s.users)
          .where(and(active(), eq(s.users.managerId, ctx.user.managerId), ne(s.users.id, uid)))
          .orderBy(asc(s.users.displayName))
      : Promise.resolve([]),
    db
      .select(cols)
      .from(s.users)
      .where(and(active(), gte(s.users.startDate, start), lte(s.users.startDate, end), ne(s.users.id, uid)))
      .orderBy(asc(s.users.startDate)),
  ]);
  const isManager = reports.length > 0;

  // Row order: company, me, my reports (or my teammates), then anyone else starting in the window.
  const rowMap = new Map<string, PlannerRow>();
  const addRow = (u: (typeof reports)[number], kind: PlannerRow["kind"]) => {
    if (rowMap.has(u.id)) return;
    rowMap.set(u.id, { id: u.id, kind, name: u.displayName, subtitle: u.title, seed: u.id, avatarUrl: u.avatarUrl, blocks: [] });
  };
  const company: PlannerRow = { id: "company", kind: "company", name: org.companyName, subtitle: "Everyone", seed: `org:${org.companyName}`, avatarUrl: null, blocks: [] };
  rowMap.set("me", { id: uid, kind: "me", name: ctx.user.displayName, subtitle: "You", seed: uid, avatarUrl: ctx.user.avatarUrl, blocks: [] });
  for (const r of reports) addRow(r, "report");
  if (!isManager) for (const t of teammates) addRow(t, "team");
  for (const j of joiners) addRow(j, "joiner");

  // Whose onboarding steps may the viewer see on their row: self, reports, everyone when managing journeys.
  const stepSubjects = new Set<string>([uid, ...reports.map((r) => r.id)]);
  if (manages) for (const id of rowMap.keys()) stepSubjects.add(id);
  stepSubjects.delete("me");
  stepSubjects.add(uid);

  const [steps, tickets, approvals, announcements, receipts] = await Promise.all([
    db
      .select({
        id: s.journeyStepRuns.id,
        runId: s.journeyRuns.id,
        dueDate: s.journeyStepRuns.dueDate,
        title: s.journeySteps.title,
        description: s.journeySteps.description,
        type: s.journeySteps.type,
        assigneeId: s.journeyStepRuns.assigneeId,
        subjectId: s.journeyRuns.subjectUserId,
        journeyName: s.journeys.name,
        subjectName: s.users.displayName,
        subjectFirst: s.users.firstName,
        subjectStart: s.users.startDate,
      })
      .from(s.journeyStepRuns)
      .innerJoin(s.journeyRuns, eq(s.journeyRuns.id, s.journeyStepRuns.runId))
      .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
      .innerJoin(s.journeys, eq(s.journeys.id, s.journeyRuns.journeyId))
      .innerJoin(s.users, eq(s.users.id, s.journeyRuns.subjectUserId))
      .where(
        and(
          eq(s.journeyStepRuns.status, "pending"),
          eq(s.journeyRuns.status, "active"),
          gte(s.journeyStepRuns.dueDate, start),
          lte(s.journeyStepRuns.dueDate, end),
          or(eq(s.journeyStepRuns.assigneeId, uid), inArray(s.journeyRuns.subjectUserId, [...stepSubjects])),
        ),
      )
      .orderBy(asc(s.journeyStepRuns.dueDate), asc(s.journeySteps.position))
      .limit(120),
    db
      .select({
        id: s.tickets.id,
        number: s.tickets.number,
        subject: s.tickets.subject,
        status: s.tickets.status,
        priority: s.tickets.priority,
        createdAt: s.tickets.createdAt,
        resolutionDueAt: s.tickets.resolutionDueAt,
        firstResponseDueAt: s.tickets.firstResponseDueAt,
        firstRespondedAt: s.tickets.firstRespondedAt,
        resolvedAt: s.tickets.resolvedAt,
        firstResponseBreachedAt: s.tickets.firstResponseBreachedAt,
        resolutionBreachedAt: s.tickets.resolutionBreachedAt,
        teamName: s.teams.name,
        typeName: s.requestTypes.name,
      })
      .from(s.tickets)
      .innerJoin(s.teams, eq(s.teams.id, s.tickets.teamId))
      .leftJoin(s.requestTypes, eq(s.requestTypes.id, s.tickets.requestTypeId))
      .where(and(eq(s.tickets.requesterId, uid), inArray(s.tickets.status, [...OPEN_REQUEST_STATUSES])))
      .orderBy(asc(s.tickets.resolutionDueAt))
      .limit(40),
    db
      .select({
        id: s.approvals.id,
        createdAt: s.approvals.createdAt,
        ticketNumber: s.tickets.number,
        subject: s.tickets.subject,
        requester: s.users.displayName,
        typeName: s.requestTypes.name,
      })
      .from(s.approvals)
      .innerJoin(s.tickets, eq(s.tickets.id, s.approvals.ticketId))
      .innerJoin(s.users, eq(s.users.id, s.tickets.requesterId))
      .leftJoin(s.requestTypes, eq(s.requestTypes.id, s.tickets.requestTypeId))
      .where(
        and(
          eq(s.approvals.status, "pending"),
          eq(s.tickets.status, "pending_approval"),
          ne(s.tickets.requesterId, uid),
          or(eq(s.approvals.approverId, uid), ctx.groupIds.length ? inArray(s.approvals.groupId, ctx.groupIds) : undefined),
        ),
      )
      .orderBy(asc(s.approvals.createdAt))
      .limit(20),
    db.select().from(s.announcements).where(and(lte(s.announcements.startsAt, now), eq(s.announcements.mustAcknowledge, true))),
    db.select().from(s.announcementReceipts).where(eq(s.announcementReceipts.userId, uid)),
  ]);

  const clamp = (d: string) => (d < start ? start : d > end ? end : d);
  const inWindow = (d: string) => d >= start && d <= end;
  const push = (rowId: string, block: PlannerBlock) => {
    const row = rowId === uid ? rowMap.get("me") : rowMap.get(rowId);
    if (row) row.blocks.push(block);
  };
  const fmtDay = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(toUtc(d)));

  // Onboarding steps: on the subject's row when that row exists, otherwise on mine (steps I own for someone).
  for (const st of steps) {
    const subject = { displayName: st.subjectName, firstName: st.subjectFirst, startDate: st.subjectStart };
    const title = personalise(st.title, subject);
    const onSubjectRow = rowMap.has(st.subjectId) || st.subjectId === uid;
    const rowId = onSubjectRow && (st.subjectId === uid || stepSubjects.has(st.subjectId)) ? st.subjectId : uid;
    if (rowId === uid && st.assigneeId !== uid && st.subjectId !== uid) continue;
    const mine = st.assigneeId === uid;
    const late = st.dueDate < today;
    const dueIn = daysBetween(today, st.dueDate);
    push(rowId, {
      id: `step:${st.id}`,
      category: "onboarding",
      label: rowId === uid && st.subjectId !== uid ? `${title} · ${st.subjectFirst || st.subjectName}` : title,
      day: st.dueDate,
      endDay: st.dueDate,
      status: late ? { label: "Overdue", tone: "danger" } : mine ? { label: "Yours", tone: "info" } : { label: "To do", tone: "neutral" },
      href: `/journeys/runs/${st.runId}`,
      panel: {
        kicker: st.journeyName,
        title,
        summary: st.description ? personalise(st.description, subject) : `An onboarding step for ${st.subjectId === uid ? "you" : st.subjectName}.`,
        stats: [
          { label: late ? "Days overdue" : "Days until due", value: Math.abs(dueIn) },
          { label: "Due", value: Number(st.dueDate.slice(8, 10)), suffix: ` ${fmtDay(st.dueDate).split(" ").slice(2).join(" ")}` },
        ],
        facts: [
          { label: "For", value: st.subjectId === uid ? "You" : st.subjectName },
          { label: "Owner", value: mine ? "You" : st.assigneeId ? "Assigned" : "A team queue" },
          { label: "Type", value: st.type.replace(/_/g, " ") },
        ],
        action: { href: `/journeys/runs/${st.runId}`, label: "Open the journey" },
      },
    });
  }

  // New joiners' first days (and mine, if I am starting).
  const meStart = ctx.user.startDate;
  const starters = [...joiners, ...(meStart && inWindow(meStart) ? [{ ...ctx.user, id: uid, displayName: ctx.user.displayName }] : [])];
  for (const j of starters) {
    if (!j.startDate || !inWindow(j.startDate)) continue;
    const first = j.firstName || j.displayName.split(" ")[0]!;
    const until = daysBetween(today, j.startDate);
    push(j.id, {
      id: `start:${j.id}`,
      category: "joiner",
      label: j.id === uid ? "Your first day" : "First day",
      day: j.startDate,
      endDay: j.startDate,
      status: until < 0 ? { label: "Started", tone: "success" } : until === 0 ? { label: "Today", tone: "success" } : { label: "Starting", tone: "neutral" },
      href: `/people/${j.id}`,
      panel: {
        kicker: "New joiner",
        title: j.id === uid ? "Your first day" : `${first} starts on ${fmtDay(j.startDate)}`,
        summary: j.title ? `${j.displayName} joins as ${j.title}${j.location ? ` in ${j.location}` : ""}.` : `${j.displayName} joins the company.`,
        stats: [{ label: until >= 0 ? "Days to go" : "Days in", value: Math.abs(until) }],
        facts: [
          { label: "Role", value: j.title ?? "Not set" },
          { label: "Location", value: j.location ?? "Not set" },
          { label: "Start date", value: fmtDay(j.startDate) },
        ],
        action: { href: `/people/${j.id}`, label: j.id === uid ? "Your profile" : `Say hi to ${first}` },
      },
    });
  }

  // My open requests, placed on the day their resolution is due.
  for (const t of tickets) {
    const dueAt = t.resolutionDueAt ?? t.firstResponseDueAt;
    const due = dueAt ? dayOf(dueAt, tz) : t.status === "pending_approval" ? today : null;
    if (!due || !inWindow(due)) continue;
    const sla = ticketSlaState(t, now);
    const hoursLeft = dueAt ? Math.max(0, Math.round((dueAt.getTime() - now.getTime()) / 3_600_000)) : 0;
    // A request is a point on the day it is due, never a span: a filled span would read as duration.
    push(uid, {
      id: `ticket:${t.id}`,
      category: "request",
      label: t.subject,
      day: due,
      endDay: due,
      status:
        sla === "breached"
          ? { label: "Past due", tone: "danger" }
          : t.status === "waiting_on_requester"
            ? { label: "Needs you", tone: "warning" }
            : { label: TICKET_STATUS[t.status] ?? "Open", tone: t.status === "pending_approval" ? "warning" : "info" },
      href: `/help/${t.number}`,
      panel: {
        kicker: `${t.typeName ?? "Request"} · #${t.number}`,
        title: t.subject,
        summary:
          t.status === "pending_approval"
            ? "Waiting for an approval before the team can start."
            : `${t.teamName} is working on it. The clock is the agreed resolution time.`,
        stats: [
          { label: "Hours left on the SLA", value: hoursLeft },
          { label: "Request number", value: t.number },
        ],
        facts: [
          { label: "Status", value: TICKET_STATUS[t.status] ?? t.status },
          { label: "Team", value: t.teamName },
          { label: "Priority", value: t.priority },
        ],
        action: { href: `/help/${t.number}`, label: "Open the request" },
      },
    });
  }

  // Approvals waiting on me: they have no due date, so they sit on today.
  for (const a of approvals) {
    const waiting = Math.max(0, Math.round((now.getTime() - a.createdAt.getTime()) / DAY));
    // An approval has no due date: it waits on the viewer today.
    push(uid, {
      id: `approval:${a.id}`,
      category: "approval",
      label: `Approve: ${a.subject}`,
      day: today,
      endDay: today,
      status: { label: "Waiting on you", tone: "warning" },
      href: "/approvals",
      panel: {
        kicker: `Approval · #${a.ticketNumber}`,
        title: a.subject,
        summary: `${a.requester} asked for this${a.typeName ? ` (${a.typeName})` : ""}. Nothing moves until you decide.`,
        stats: [{ label: "Days waiting", value: waiting }],
        facts: [
          { label: "Requested by", value: a.requester },
          { label: "Type", value: a.typeName ?? "Request" },
        ],
        action: { href: "/approvals", label: "Review and decide" },
      },
    });
  }

  // Company row: acknowledgement deadlines I still owe, and payday.
  const byId = new Map(receipts.map((r) => [r.announcementId, r]));
  for (const an of announcements) {
    if (!an.endsAt || !shouldShowAnnouncement(an, ctx.groupIds, byId.get(an.id), now)) continue;
    const deadline = dayOf(an.endsAt, tz);
    if (deadline < start) continue;
    const from = clamp(today);
    const to = clamp(deadline);
    if (from > to) continue;
    const left = daysBetween(today, deadline);
    company.blocks.push({
      id: `ack:${an.id}`,
      category: "announcement",
      label: an.title,
      day: from,
      endDay: to,
      status: left <= 2 ? { label: "Confirm soon", tone: "warning" } : { label: "To confirm", tone: "neutral" },
      href: "/#announcements",
      panel: {
        kicker: "Announcement",
        title: an.title,
        summary: an.body.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"),
        stats: [{ label: "Days to acknowledge", value: Math.max(0, left) }],
        facts: [
          { label: "Deadline", value: fmtDay(deadline) },
          { label: "Severity", value: an.severity },
        ],
        action: { href: "/#announcements", label: "Read and confirm" },
      },
    });
  }
  const payday = fromUtc(nextPayday(now, org.workingDays).getTime());
  if (inWindow(payday)) {
    const left = daysBetween(today, payday);
    company.blocks.push({
      id: "payday",
      category: "payday",
      label: "Payday",
      day: payday,
      endDay: payday,
      status: left === 0 ? { label: "Today", tone: "success" } : { label: `In ${left} days`, tone: "neutral" },
      href: "/knowledge",
      panel: {
        kicker: "Payroll",
        title: left === 0 ? "Today is payday" : `Payday is ${fmtDay(payday)}`,
        summary: "Salaries are paid on the last working day of the month.",
        stats: [{ label: "Days to payday", value: left }],
        facts: [{ label: "Paid on", value: fmtDay(payday) }],
        action: { href: "/knowledge", label: "Payroll questions" },
      },
    });
  }

  const rows = [company, ...rowMap.values()].filter((r) => r.kind === "me" || r.blocks.length > 0);
  for (const r of rows) r.blocks.sort((a, b) => a.day.localeCompare(b.day));
  const dueCount = rows.reduce((n, r) => n + r.blocks.filter((b) => b.endDay >= today).length, 0);
  return { start, days, today, workingDays: org.workingDays, rows: rows.slice(0, 9), dueCount };
}

// ---------------------------------------------------------------- Onboarding card

export interface OnboardingPerson {
  id: string;
  name: string;
  firstName: string;
  title: string | null;
  avatarUrl: string | null;
  startDate: string | null;
  /** Steps done / total across the person's active runs; null when the viewer may not see progress. */
  done: number | null;
  total: number | null;
  runId: string | null;
}

/**
 * People being onboarded right now. Progress shows when the viewer is the person, their manager,
 * their buddy, or manages journeys; otherwise only the public start date shows.
 */
export async function getOnboardingCard(ctx: UserContext, now = new Date()): Promise<OnboardingPerson[]> {
  const uid = ctx.user.id;
  const manages = await canManageJourneys(ctx);
  const runs = await db
    .select({
      runId: s.journeyRuns.id,
      subjectId: s.journeyRuns.subjectUserId,
      buddyId: s.journeyRuns.buddyUserId,
      anchor: s.journeyRuns.anchorDate,
      kind: s.journeys.kind,
      name: s.users.displayName,
      firstName: s.users.firstName,
      title: s.users.title,
      avatarUrl: s.users.avatarUrl,
      managerId: s.users.managerId,
      startDate: s.users.startDate,
    })
    .from(s.journeyRuns)
    .innerJoin(s.journeys, eq(s.journeys.id, s.journeyRuns.journeyId))
    .innerJoin(s.users, eq(s.users.id, s.journeyRuns.subjectUserId))
    .where(and(eq(s.journeyRuns.status, "active"), eq(s.journeys.kind, "onboarding"), eq(s.users.status, "active"), isNull(s.users.endDate)))
    .orderBy(asc(s.journeyRuns.anchorDate))
    .limit(40);
  if (!runs.length) return [];
  const counts = await db
    .select({ runId: s.journeyStepRuns.runId, status: s.journeyStepRuns.status })
    .from(s.journeyStepRuns)
    .where(inArray(s.journeyStepRuns.runId, runs.map((r) => r.runId)));
  const tally = new Map<string, { done: number; total: number }>();
  for (const c of counts) {
    const t = tally.get(c.runId) ?? { done: 0, total: 0 };
    t.total += 1;
    if (c.status !== "pending") t.done += 1;
    tally.set(c.runId, t);
  }
  const people = new Map<string, OnboardingPerson>();
  for (const r of runs) {
    const maySee = manages || r.subjectId === uid || r.managerId === uid || r.buddyId === uid;
    const t = tally.get(r.runId) ?? { done: 0, total: 0 };
    const p = people.get(r.subjectId) ?? {
      id: r.subjectId,
      name: r.name,
      firstName: r.firstName || r.name.split(" ")[0]!,
      title: r.title,
      avatarUrl: r.avatarUrl,
      startDate: r.startDate,
      done: maySee ? 0 : null,
      total: maySee ? 0 : null,
      runId: maySee ? r.runId : null,
    };
    if (maySee && p.done !== null && p.total !== null) {
      p.done += t.done;
      p.total += t.total;
    }
    people.set(r.subjectId, p);
  }
  // Still being onboarded: started within the last 60 days or starting soon.
  const today = now.toISOString().slice(0, 10);
  return [...people.values()].filter((p) => !p.startDate || daysBetween(p.startDate, today) <= 60).slice(0, 6);
}
