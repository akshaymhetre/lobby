/**
 * The journeys heartbeat, run by the worker every 15 minutes and on start:
 *  1. start journeys for people whose start or last day is close,
 *  2. raise helpdesk tickets for ticket steps whose lead time has arrived,
 *  3. complete ticket steps whose ticket is resolved, and acknowledgement steps already acknowledged,
 *  4. tell assignees when their steps fall due (once) and when they are overdue (once),
 *  5. close runs with nothing left to do.
 */
import { and, asc, db, eq, inArray, isNotNull, isNull, lt, s, sql } from "@lobby/db";
import type { JourneyStepConfig } from "@lobby/db/schema";
import { loadUserContext } from "../identity/context";
import { notify } from "../notify";
import { addDays } from "./dates";
import { loadHelpdesk, loadKnowledge, pageIdOf } from "./deps";
import { personalise, ticketFieldValues, type TicketFieldDef } from "./rules";
import { journeyClock, maybeCompleteRun, peopleInStartWindow, startJourneyFor } from "./engine";

export interface TickSummary {
  today: string;
  started: number;
  ticketsCreated: number;
  stepsAutoCompleted: number;
  dueNotified: number;
  overdueNotified: number;
  runsCompleted: number;
}

const RESOLVED = ["resolved", "closed"];

export async function runJourneysTick(opts: { now?: Date } = {}): Promise<TickSummary> {
  const clock = await journeyClock(opts.now);
  const { today } = clock;
  const summary: TickSummary = { today, started: 0, ticketsCreated: 0, stepsAutoCompleted: 0, dueNotified: 0, overdueNotified: 0, runsCompleted: 0 };

  // 1. Start journeys for people starting (or leaving) soon.
  for (const person of await peopleInStartWindow(today)) {
    try {
      const res = await startJourneyFor(person.id, undefined, { now: opts.now });
      summary.started += res.started.length;
    } catch (err) {
      console.error("[journeys] start failed for", person.id, err);
    }
  }

  // 2. Raise tickets whose lead time has arrived. Only one tick at a time may raise tickets,
  // or two overlapping ticks would both see "no ticket yet" and raise it twice.
  summary.ticketsCreated = await db.transaction(async (tx) => {
    const [lock] = await tx.execute<{ ok: boolean }>(sql`select pg_try_advisory_xact_lock(hashtext('lobby.journeys.raise-tickets')) as ok`);
    return lock?.ok ? raiseDueTickets(today) : 0;
  });

  // 3. Auto-complete steps finished elsewhere.
  summary.stepsAutoCompleted = (await completeResolvedTicketSteps()) + (await completeAcknowledgedSteps());

  // 4. Due and overdue notifications, grouped per person.
  summary.dueNotified = await notifyDue(today);
  summary.overdueNotified = await notifyOverdue(today);

  // 5. Close runs with nothing pending.
  const active = await db.select({ id: s.journeyRuns.id }).from(s.journeyRuns).where(eq(s.journeyRuns.status, "active"));
  for (const run of active) if (await maybeCompleteRun(run.id)) summary.runsCompleted++;

  return summary;
}

async function raiseDueTickets(today: string): Promise<number> {
  const rows = await db
    .select({ stepRun: s.journeyStepRuns, step: s.journeySteps, subject: s.users, kind: s.journeys.kind })
    .from(s.journeyStepRuns)
    .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
    .innerJoin(s.journeyRuns, eq(s.journeyRuns.id, s.journeyStepRuns.runId))
    .innerJoin(s.journeys, eq(s.journeys.id, s.journeyRuns.journeyId))
    .innerJoin(s.users, eq(s.users.id, s.journeyRuns.subjectUserId))
    .where(
      and(
        eq(s.journeySteps.type, "create_ticket"),
        eq(s.journeyStepRuns.status, "pending"),
        eq(s.journeyRuns.status, "active"),
        isNull(s.journeyStepRuns.ticketId),
      ),
    )
    .orderBy(asc(s.journeyStepRuns.dueDate));
  const due = rows.filter((r) => {
    const cfg = r.step.config as JourneyStepConfig;
    const lead = Math.max(0, Math.min(60, Number(cfg.leadDays ?? 3) || 0));
    return r.stepRun.dueDate <= addDays(today, lead) && !!cfg.requestTypeSlug;
  });
  if (!due.length) return 0;
  const helpdesk = await loadHelpdesk();
  if (!helpdesk) return 0;

  let created = 0;
  for (const r of due) {
    const cfg = r.step.config as JourneyStepConfig;
    // The ticket is raised by the manager on the person's behalf (or by the person if they have no manager).
    const requester = (await loadUserContext(r.subject.managerId ?? r.subject.id)) ?? (await loadUserContext(r.subject.id));
    if (!requester) continue;
    const anchor = (r.kind === "offboarding" ? r.subject.endDate : r.subject.startDate) ?? r.stepRun.dueDate;
    const rt = await db.query.requestTypes.findFirst({ where: eq(s.requestTypes.slug, cfg.requestTypeSlug!) });
    const fields = ticketFieldValues((rt?.fields ?? []) as TicketFieldDef[], cfg.ticketFields ?? {}, {
      subjectId: r.subject.id,
      anchor,
      text: personalise(r.step.description || r.step.title, r.subject),
      appSlug: cfg.appSlug,
    });
    const when = r.kind === "offboarding" ? `Last day: ${r.subject.endDate ?? "not set"}` : `Start date: ${r.subject.startDate ?? "not set"}`;
    try {
      const ticket = await helpdesk.createTicket(requester, {
        requestTypeSlug: cfg.requestTypeSlug!,
        subject: personalise(cfg.ticketSubject || r.step.title, r.subject),
        description: [r.step.description ? personalise(r.step.description, r.subject) : null, `${r.subject.displayName}. ${when}. Needed by ${r.stepRun.dueDate}.`, "Raised automatically by their journey in Lobby."]
          .filter(Boolean)
          .join("\n\n"),
        fields,
        source: "journey",
        onBehalfOfUserId: r.subject.id,
      });
      await db
        .update(s.journeyStepRuns)
        .set({ ticketId: ticket.id })
        .where(and(eq(s.journeyStepRuns.id, r.stepRun.id), isNull(s.journeyStepRuns.ticketId)));
      created++;
    } catch (err) {
      console.error(`[journeys] could not raise a ${cfg.requestTypeSlug} ticket for step ${r.stepRun.id}:`, (err as Error).message);
    }
  }
  return created;
}

async function completeResolvedTicketSteps(): Promise<number> {
  const rows = await db
    .select({ id: s.journeyStepRuns.id, runId: s.journeyStepRuns.runId })
    .from(s.journeyStepRuns)
    .innerJoin(s.tickets, eq(s.tickets.id, s.journeyStepRuns.ticketId))
    .where(and(eq(s.journeyStepRuns.status, "pending"), isNotNull(s.journeyStepRuns.ticketId), inArray(s.tickets.status, RESOLVED as ("resolved" | "closed")[])));
  for (const r of rows) {
    await db
      .update(s.journeyStepRuns)
      .set({ status: "done", completedAt: new Date(), completedById: null })
      .where(and(eq(s.journeyStepRuns.id, r.id), eq(s.journeyStepRuns.status, "pending")));
    await maybeCompleteRun(r.runId);
  }
  return rows.length;
}

/**
 * Completes acknowledgement steps whose page the person already acknowledged in Knowledge.
 * Pass a subject to sync just their steps (the navigator does this on load).
 */
export async function completeAcknowledgedSteps(subjectUserId?: string): Promise<number> {
  const rows = await db
    .select({ id: s.journeyStepRuns.id, runId: s.journeyStepRuns.runId, subjectId: s.journeyRuns.subjectUserId, config: s.journeySteps.config })
    .from(s.journeyStepRuns)
    .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
    .innerJoin(s.journeyRuns, eq(s.journeyRuns.id, s.journeyStepRuns.runId))
    .where(
      and(
        eq(s.journeySteps.type, "acknowledge_page"),
        eq(s.journeyStepRuns.status, "pending"),
        eq(s.journeyRuns.status, "active"),
        subjectUserId ? eq(s.journeyRuns.subjectUserId, subjectUserId) : undefined,
      ),
    );
  if (!rows.length) return 0;
  const knowledge = await loadKnowledge();
  if (!knowledge) return 0;
  let n = 0;
  for (const r of rows) {
    const cfg = r.config as JourneyStepConfig;
    if (!cfg.spaceSlug || !cfg.pageSlug) continue;
    const ctx = await loadUserContext(r.subjectId);
    if (!ctx) continue;
    const pageId = pageIdOf(await knowledge.getPageBySlug(ctx, cfg.spaceSlug, cfg.pageSlug).catch(() => null));
    if (!pageId || !(await knowledge.hasAcknowledged(r.subjectId, pageId).catch(() => false))) continue;
    await db
      .update(s.journeyStepRuns)
      .set({ status: "done", completedAt: new Date(), completedById: r.subjectId })
      .where(and(eq(s.journeyStepRuns.id, r.id), eq(s.journeyStepRuns.status, "pending")));
    await maybeCompleteRun(r.runId);
    n++;
  }
  return n;
}

type PendingRow = { id: string; assigneeId: string | null; title: string; subjectName: string; subjectFirst: string; subjectId: string; runId: string };

async function pendingFor(where: ReturnType<typeof and>): Promise<PendingRow[]> {
  const rows = await db
    .select({
      id: s.journeyStepRuns.id,
      assigneeId: s.journeyStepRuns.assigneeId,
      title: s.journeySteps.title,
      subjectName: s.users.displayName,
      subjectFirst: s.users.firstName,
      subjectId: s.users.id,
      runId: s.journeyRuns.id,
    })
    .from(s.journeyStepRuns)
    .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
    .innerJoin(s.journeyRuns, eq(s.journeyRuns.id, s.journeyStepRuns.runId))
    .innerJoin(s.users, eq(s.users.id, s.journeyRuns.subjectUserId))
    .where(where);
  return rows.map((r) => ({ ...r, title: personalise(r.title, { displayName: r.subjectName, firstName: r.subjectFirst }) }));
}

function groupByAssignee(rows: PendingRow[]) {
  const map = new Map<string, PendingRow[]>();
  for (const r of rows) {
    if (!r.assigneeId) continue;
    map.set(r.assigneeId, [...(map.get(r.assigneeId) ?? []), r]);
  }
  return map;
}

function describe(r: PendingRow, assigneeId: string) {
  return r.subjectId === assigneeId ? r.title : `${r.title} (${r.subjectName})`;
}

async function notifyDue(today: string): Promise<number> {
  const rows = await pendingFor(
    and(
      eq(s.journeyStepRuns.status, "pending"),
      eq(s.journeyRuns.status, "active"),
      isNull(s.journeyStepRuns.dueNotifiedAt),
      isNotNull(s.journeyStepRuns.assigneeId),
      eq(s.journeyStepRuns.dueDate, today),
    ),
  );
  let n = 0;
  for (const [assigneeId, items] of groupByAssignee(rows)) {
    const first = items[0]!;
    await notify(assigneeId, {
      kind: "journeys.step_due",
      title: items.length === 1 ? `Due today: ${describe(first, assigneeId)}` : `${items.length} onboarding steps are due`,
      body: items.length === 1 ? undefined : items.slice(0, 5).map((i) => describe(i, assigneeId)).join(", "),
      href: first.subjectId === assigneeId ? "/journeys" : `/journeys?view=tasks`,
    });
    await db.update(s.journeyStepRuns).set({ dueNotifiedAt: new Date() }).where(inArray(s.journeyStepRuns.id, items.map((i) => i.id)));
    n += items.length;
  }
  return n;
}

async function notifyOverdue(today: string): Promise<number> {
  const rows = await pendingFor(
    and(
      eq(s.journeyStepRuns.status, "pending"),
      eq(s.journeyRuns.status, "active"),
      isNull(s.journeyStepRuns.overdueNotifiedAt),
      isNotNull(s.journeyStepRuns.assigneeId),
      lt(s.journeyStepRuns.dueDate, today),
    ),
  );
  let n = 0;
  for (const [assigneeId, items] of groupByAssignee(rows)) {
    const first = items[0]!;
    await notify(assigneeId, {
      kind: "journeys.step_overdue",
      title: items.length === 1 ? `Overdue: ${describe(first, assigneeId)}` : `${items.length} onboarding steps are overdue`,
      body: items.length === 1 ? "It was due earlier. Tick it off when it is done." : items.slice(0, 5).map((i) => describe(i, assigneeId)).join(", "),
      href: first.subjectId === assigneeId ? "/journeys" : `/journeys?view=tasks`,
      email: true,
    });
    await db.update(s.journeyStepRuns).set({ overdueNotifiedAt: new Date(), dueNotifiedAt: new Date() }).where(inArray(s.journeyStepRuns.id, items.map((i) => i.id)));
    n += items.length;
  }
  return n;
}
