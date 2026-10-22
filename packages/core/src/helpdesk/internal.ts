/**
 * Shared internals for the helpdesk services: permission checks, events, notifications,
 * SLA start, routing. Not exported from the package index.
 */
import { and, asc, db, desc, eq, inArray, isNotNull, s } from "@lobby/db";
import type { UserContext } from "../identity/context";
import { notify } from "../notify";
import { enqueue, QUEUES } from "../jobs";
import { computeDueDates, type BusinessCalendar, type SlaTargets } from "./sla";

export type TicketRow = typeof s.tickets.$inferSelect;
export type TeamRow = typeof s.teams.$inferSelect;
export type RequestTypeRow = typeof s.requestTypes.$inferSelect;
export type EventKind = (typeof s.ticketEvents.$inferInsert)["kind"];

export const OPEN_STATUSES = ["new", "open", "pending_approval", "waiting_on_requester"] as const;
export const WORKING_STATUSES = ["new", "open", "waiting_on_requester"] as const;
export const DONE_STATUSES = ["resolved", "closed", "rejected"] as const;

export class HelpdeskError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "forbidden" | "invalid" | "conflict" = "invalid",
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

/** True when the user works this team's queue (admins work every queue). */
export function canWorkTeam(ctx: UserContext, team: Pick<TeamRow, "agentGroupId">): boolean {
  if (ctx.has("admin")) return true;
  return ctx.has("agent") && !!team.agentGroupId && ctx.groupIds.includes(team.agentGroupId);
}

/** Team ids whose queues the user works; null means all teams (admin). */
export async function workableTeamIds(ctx: UserContext): Promise<string[] | null> {
  if (ctx.has("admin")) return null;
  if (!ctx.has("agent") || !ctx.groupIds.length) return [];
  const rows = await db.select({ id: s.teams.id }).from(s.teams).where(inArray(s.teams.agentGroupId, ctx.groupIds));
  return rows.map((r) => r.id);
}

export async function loadTicket(id: string) {
  const row = await db
    .select({ ticket: s.tickets, team: s.teams })
    .from(s.tickets)
    .innerJoin(s.teams, eq(s.teams.id, s.tickets.teamId))
    .where(eq(s.tickets.id, id))
    .limit(1);
  return row[0] ?? null;
}

export type TicketAccess = "agent" | "requester" | "approver" | null;

/** How the user may see a ticket: agents see everything, requesters and approvers see the public side. */
export async function accessTo(ctx: UserContext, ticket: TicketRow, team: TeamRow): Promise<TicketAccess> {
  if (canWorkTeam(ctx, team)) return "agent";
  if (ticket.requesterId === ctx.user.id) return "requester";
  const rows = await db
    .select({ approverId: s.approvals.approverId, groupId: s.approvals.groupId })
    .from(s.approvals)
    .where(eq(s.approvals.ticketId, ticket.id));
  if (rows.some((r) => r.approverId === ctx.user.id || (r.groupId && ctx.groupIds.includes(r.groupId)))) return "approver";
  return null;
}

export async function addEvent(
  ticketId: string,
  actorId: string | null,
  kind: EventKind,
  body: string | null,
  data: Record<string, unknown> = {},
) {
  const [row] = await db.insert(s.ticketEvents).values({ ticketId, actorId, kind, body, data }).returning();
  return row!;
}

export const ticketHref = (n: number) => `/help/${n}`;
export const queueHref = (n: number) => `/queue/${n}`;
export const ticketLabel = (n: number) => `#${n}`;

/** Never let a notification failure break the action that caused it. */
export async function safely(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    console.error(`[helpdesk] ${label} failed:`, err);
  }
}

export async function notifyRequester(
  ticket: Pick<TicketRow, "requesterId" | "number" | "subject">,
  actorId: string | null,
  n: { kind: string; title: string; body?: string; email?: boolean },
) {
  if (actorId && actorId === ticket.requesterId) return;
  await safely("notify requester", () =>
    notify(ticket.requesterId, { kind: n.kind, title: n.title, body: n.body, href: ticketHref(ticket.number), email: n.email }),
  );
}

/** Active members of a group, ordered by name. */
export async function groupMemberIds(groupId: string | null | undefined): Promise<string[]> {
  if (!groupId) return [];
  const rows = await db
    .select({ id: s.users.id })
    .from(s.groupMembers)
    .innerJoin(s.users, eq(s.users.id, s.groupMembers.userId))
    .where(and(eq(s.groupMembers.groupId, groupId), eq(s.users.status, "active")))
    .orderBy(asc(s.users.displayName));
  return rows.map((r) => r.id);
}

/** Who gets told about queue events: the assignee, or every agent of the team when unassigned. */
export async function notifyWorkers(
  ticket: Pick<TicketRow, "assigneeId" | "number" | "subject">,
  team: Pick<TeamRow, "agentGroupId">,
  actorId: string | null,
  n: { kind: string; title: string; body?: string; email?: boolean },
) {
  const ids = ticket.assigneeId ? [ticket.assigneeId] : await groupMemberIds(team.agentGroupId);
  for (const id of ids) {
    if (id === actorId) continue;
    await safely("notify worker", () => notify(id, { ...n, href: queueHref(ticket.number) }));
  }
}

/** Pure: the next agent after the last one assigned, wrapping around. */
export function pickRoundRobin(memberIds: string[], lastAssigneeId: string | null): string | null {
  if (!memberIds.length) return null;
  const i = lastAssigneeId ? memberIds.indexOf(lastAssigneeId) : -1;
  return memberIds[(i + 1) % memberIds.length]!;
}

export async function roundRobinAssignee(team: TeamRow): Promise<string | null> {
  if (!team.roundRobin) return null;
  const members = await groupMemberIds(team.agentGroupId);
  if (!members.length) return null;
  const [last] = await db
    .select({ assigneeId: s.tickets.assigneeId })
    .from(s.tickets)
    .where(and(eq(s.tickets.teamId, team.id), isNotNull(s.tickets.assigneeId), inArray(s.tickets.assigneeId, members)))
    .orderBy(desc(s.tickets.createdAt))
    .limit(1);
  return pickRoundRobin(members, last?.assigneeId ?? null);
}

export async function calendarFor(team: Pick<TeamRow, "calendarId">): Promise<BusinessCalendar | null> {
  if (!team.calendarId) return null;
  const cal = await db.query.businessCalendars.findFirst({ where: eq(s.businessCalendars.id, team.calendarId) });
  return cal ?? null;
}

/** Due dates for a ticket whose SLA clock starts now (or at `start`). Null when no policy applies. */
export async function dueDatesFor(
  requestType: Pick<RequestTypeRow, "slaPolicyId"> | null,
  team: Pick<TeamRow, "calendarId">,
  priority: TicketRow["priority"],
  start = new Date(),
) {
  if (!requestType?.slaPolicyId) return null;
  const policy = await db.query.slaPolicies.findFirst({ where: eq(s.slaPolicies.id, requestType.slaPolicyId) });
  if (!policy) return null;
  try {
    return computeDueDates(start, priority, policy.targets as SlaTargets, await calendarFor(team));
  } catch (err) {
    console.error("[helpdesk] SLA calculation failed, ticket has no due dates:", err);
    return null;
  }
}

/** Queue a push to every enabled connector that covers this ticket's request type. */
export async function enqueueConnectorPush(ticket: Pick<TicketRow, "id" | "requestTypeId">, event: "created" | "updated" | "comment", extra: Record<string, unknown> = {}) {
  await safely("connector push", async () => {
    const rows = await db.select().from(s.connectors).where(eq(s.connectors.enabled, true));
    const covering = rows.filter((c) => !c.requestTypeIds.length || (ticket.requestTypeId && c.requestTypeIds.includes(ticket.requestTypeId)));
    for (const c of covering) {
      await enqueue(QUEUES.connectorPush, { ticketId: ticket.id, connectorId: c.id, event, ...extra });
    }
  });
}

export async function displayName(userId: string | null | undefined): Promise<string> {
  if (!userId) return "Someone";
  const u = await db.query.users.findFirst({ where: eq(s.users.id, userId), columns: { displayName: true } });
  return u?.displayName ?? "Someone";
}
