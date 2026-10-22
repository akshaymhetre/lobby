/**
 * The SLA sweep, run every minute by the worker (`helpdesk.sla-check`). Marks each clock
 * breached exactly once (the UPDATE is conditional, so overlapping runs cannot double-fire),
 * writes an `sla` event and tells the assignee, or the whole team when nobody has it.
 */
import { and, db, eq, inArray, isNull, lte, s } from "@lobby/db";
import { addEvent, notifyWorkers, WORKING_STATUSES } from "./internal";

export async function runSlaCheck(now = new Date()): Promise<{ firstResponse: number[]; resolution: number[] }> {
  const working = inArray(s.tickets.status, [...WORKING_STATUSES]);

  const fr = await db
    .update(s.tickets)
    .set({ firstResponseBreachedAt: now })
    .where(and(working, isNull(s.tickets.firstRespondedAt), isNull(s.tickets.firstResponseBreachedAt), lte(s.tickets.firstResponseDueAt, now)))
    .returning();
  const res = await db
    .update(s.tickets)
    .set({ resolutionBreachedAt: now })
    .where(and(working, isNull(s.tickets.resolvedAt), isNull(s.tickets.resolutionBreachedAt), lte(s.tickets.resolutionDueAt, now)))
    .returning();

  for (const [rows, clock] of [[fr, "first_response"], [res, "resolution"]] as const) {
    for (const t of rows) {
      const dueAt = clock === "first_response" ? t.firstResponseDueAt : t.resolutionDueAt;
      await addEvent(t.id, null, "sla", null, { clock, breached: true, dueAt: dueAt?.toISOString() });
      const team = await db.query.teams.findFirst({ where: eq(s.teams.id, t.teamId) });
      if (!team) continue;
      await notifyWorkers(t, team, null, {
        kind: "helpdesk.sla_breach",
        title: clock === "first_response" ? `#${t.number} missed its first-response target` : `#${t.number} missed its resolution target`,
        body: t.subject,
        email: !!t.assigneeId,
      });
    }
  }
  return { firstResponse: fr.map((t) => t.number), resolution: res.map((t) => t.number) };
}
