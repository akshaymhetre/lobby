/**
 * Request approvals: manager, group, or manager then group (sequential steps).
 * Each active step gets a one-time email link (/approve/<token>); only the sha256 is stored.
 * Deciding through the link still requires signing in as the approver.
 */
import { and, asc, db, desc, eq, inArray, isNull, or, s, sql } from "@lobby/db";
import type { UserContext } from "../identity/context";
import { audit } from "../audit";
import { notify } from "../notify";
import { env } from "../env";
import { mailHtml, queueMail } from "../mail";
import { randomToken, sha256 } from "../crypto";
import { indexTicket } from "./index-source";
import {
  addEvent,
  dueDatesFor,
  enqueueConnectorPush,
  groupMemberIds,
  HelpdeskError,
  notifyRequester,
  notifyWorkers,
  roundRobinAssignee,
  safely,
  ticketHref,
  type RequestTypeRow,
  type TeamRow,
  type TicketRow,
} from "./internal";

export type ApprovalRow = typeof s.approvals.$inferSelect;
export const APPROVAL_LINK_TTL_DAYS = 14;

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Token format: <issued-at base36>.<random>. The timestamp lets links expire without a schema column. */
function newToken() {
  const token = `${Date.now().toString(36)}.${randomToken(24)}`;
  return { token, hash: sha256(token) };
}

export function tokenIssuedAt(token: string): Date | null {
  const [ts] = token.split(".");
  const n = ts ? parseInt(ts, 36) : NaN;
  return Number.isFinite(n) ? new Date(n) : null;
}

/**
 * Creates the approval rows for a new ticket and activates the first step.
 * Returns false when the request type needs no approval.
 */
export async function startApprovals(
  ticket: TicketRow,
  rt: Pick<RequestTypeRow, "approval" | "name">,
  team: TeamRow,
  requester: { id: string; managerId: string | null; displayName: string },
): Promise<boolean> {
  const rule = rt.approval ?? { mode: "none" };
  if (rule.mode === "none") return false;
  const groupId = rule.groupId ?? team.agentGroupId ?? null;
  const steps: { approverId?: string; groupId?: string }[] = [];
  const wantsManager = rule.mode === "manager" || rule.mode === "manager_then_group";
  const wantsGroup = rule.mode === "group" || rule.mode === "manager_then_group";

  if (wantsManager && requester.managerId) steps.push({ approverId: requester.managerId });
  if (wantsGroup && groupId) steps.push({ groupId });
  // No manager on file: a manager-only rule falls back to the team's agents, never to "no approval".
  if (!steps.length && groupId) steps.push({ groupId });
  if (!steps.length) {
    await addEvent(ticket.id, null, "system", "This request needed approval, but no approver could be found. It went straight to the team.", { action: "approval_skipped" });
    return false;
  }
  if (wantsManager && !requester.managerId) {
    await addEvent(ticket.id, null, "system", "No manager is on file, so the team approves this instead.", { action: "approval_fallback" });
  }

  const rows = await db
    .insert(s.approvals)
    .values(steps.map((st, i) => ({ ticketId: ticket.id, step: i + 1, approverId: st.approverId ?? null, groupId: st.groupId ?? null, status: i === 0 ? ("pending" as const) : ("waiting" as const) })))
    .returning();
  await activateStep(rows[0]!, ticket, rt.name, requester.displayName);
  return true;
}

/** Issues the email link for a pending step and tells the approver(s). */
async function activateStep(approval: ApprovalRow, ticket: TicketRow, typeName: string, requesterName: string) {
  const { token, hash } = newToken();
  await db.update(s.approvals).set({ tokenHash: hash, status: "pending" }).where(eq(s.approvals.id, approval.id));
  const approverIds = approval.approverId ? [approval.approverId] : (await groupMemberIds(approval.groupId)).filter((id) => id !== ticket.requesterId);
  const title = `${requesterName} needs your approval`;
  const body = `${typeName}: ${ticket.subject}`;
  const link = `${env.url}/approve/${token}`;
  for (const userId of approverIds) {
    await safely("approval notify", async () => {
      await notify(userId, { kind: "helpdesk.approval_requested", title, body, href: "/approvals" });
      const user = await db.query.users.findFirst({ where: eq(s.users.id, userId), columns: { email: true } });
      if (!user) return;
      await queueMail({
        to: user.email,
        subject: `Approval needed: ${ticket.subject}`,
        text: `${requesterName} asked for ${typeName}: "${ticket.subject}".\n\nApprove or reject it here (you'll be asked to sign in):\n${link}\n\nThis link works once and expires in ${APPROVAL_LINK_TTL_DAYS} days. You can also decide in Lobby under Approvals.`,
        html: mailHtml({
          heading: title,
          body: `<p style="margin:0 0 8px"><strong>${esc(typeName)}</strong></p><p style="margin:0 0 8px">${esc(ticket.subject)}</p>${
            ticket.description ? `<p style="margin:0;color:#6B675F">${esc(ticket.description.slice(0, 400))}</p>` : ""
          }`,
          actionLabel: "Review request",
          actionUrl: link,
          footer: `You'll be asked to sign in. This link works once and expires in ${APPROVAL_LINK_TTL_DAYS} days.`,
        }),
      });
    });
  }
}

/** True when the user may decide this approval row. Requesters never approve their own request. */
export function canDecide(ctx: UserContext, a: Pick<ApprovalRow, "approverId" | "groupId">, ticket: Pick<TicketRow, "requesterId">) {
  if (ticket.requesterId === ctx.user.id) return false;
  return a.approverId === ctx.user.id || (!!a.groupId && ctx.groupIds.includes(a.groupId));
}

export async function findApprovalByToken(token: string) {
  if (!token || token.length > 200) return null;
  const a = await db.query.approvals.findFirst({ where: eq(s.approvals.tokenHash, sha256(token)) });
  if (!a) return null;
  const issued = tokenIssuedAt(token);
  const expired = !issued || Date.now() - issued.getTime() > APPROVAL_LINK_TTL_DAYS * 86_400_000;
  return { approval: a, expired };
}

/**
 * Approves or rejects one step. With `token`, the decision must match that link's approval row.
 * Rejection closes the ticket as rejected; the final approval opens it and starts the SLA.
 */
export async function decideApproval(
  ctx: UserContext,
  approvalId: string,
  decision: "approved" | "rejected",
  comment?: string | null,
  opts: { token?: string } = {},
): Promise<{ ticketNumber: number; outcome: "approved_step" | "approved_final" | "rejected" }> {
  const a = await db.query.approvals.findFirst({ where: eq(s.approvals.id, approvalId) });
  if (!a) throw new HelpdeskError("That approval doesn't exist.", "not_found");
  if (opts.token) {
    const found = await findApprovalByToken(opts.token);
    if (!found || found.approval.id !== a.id) throw new HelpdeskError("This link is no longer valid.", "forbidden");
    if (found.expired) throw new HelpdeskError("This link has expired. You can still decide from Approvals in Lobby.", "forbidden");
  }
  const ticket = await db.query.tickets.findFirst({ where: eq(s.tickets.id, a.ticketId) });
  if (!ticket) throw new HelpdeskError("That request no longer exists.", "not_found");
  if (!canDecide(ctx, a, ticket)) throw new HelpdeskError("You're not the approver for this request.", "forbidden");
  if (a.status !== "pending") throw new HelpdeskError("This has already been decided.", "conflict");
  if (ticket.status !== "pending_approval") throw new HelpdeskError("This request is no longer waiting for approval.", "conflict");
  const note = comment?.trim().slice(0, 2000) || null;

  const updated = await db
    .update(s.approvals)
    .set({ status: decision, decidedById: ctx.user.id, decidedAt: new Date(), comment: note, tokenHash: null })
    .where(and(eq(s.approvals.id, a.id), eq(s.approvals.status, "pending")))
    .returning({ id: s.approvals.id });
  if (!updated.length) throw new HelpdeskError("Someone else decided this a moment ago.", "conflict");

  const steps = await db.select().from(s.approvals).where(eq(s.approvals.ticketId, ticket.id)).orderBy(asc(s.approvals.step));
  const next = steps.find((st) => st.step > a.step && st.status === "waiting");
  const final = decision === "approved" && !next;
  await addEvent(ticket.id, ctx.user.id, "approval", note, { decision, step: a.step, steps: steps.length, final, groupId: a.groupId });
  await audit(ctx.user.id, `helpdesk.approval_${decision}`, { type: "ticket", id: ticket.id }, { approvalId: a.id, step: a.step, viaLink: !!opts.token });

  const rt = ticket.requestTypeId ? await db.query.requestTypes.findFirst({ where: eq(s.requestTypes.id, ticket.requestTypeId) }) : null;
  const team = (await db.query.teams.findFirst({ where: eq(s.teams.id, ticket.teamId) }))!;
  const typeName = rt?.name ?? "Request";

  if (decision === "rejected") {
    await db.update(s.tickets).set({ status: "rejected", resolvedAt: new Date() }).where(eq(s.tickets.id, ticket.id));
    await db.update(s.approvals).set({ tokenHash: null }).where(and(eq(s.approvals.ticketId, ticket.id), eq(s.approvals.status, "waiting")));
    await addEvent(ticket.id, ctx.user.id, "status", null, { from: ticket.status, to: "rejected" });
    await notifyRequester(ticket, ctx.user.id, {
      kind: "helpdesk.rejected",
      title: `${ctx.user.displayName} didn't approve #${ticket.number}`,
      body: note ? `"${note}"` : `${typeName}: ${ticket.subject}`,
      email: true,
    });
    await safely("index", () => indexTicket(ticket.id));
    return { ticketNumber: ticket.number, outcome: "rejected" };
  }

  if (next) {
    const requester = await db.query.users.findFirst({ where: eq(s.users.id, ticket.requesterId), columns: { displayName: true } });
    await activateStep(next, ticket, typeName, requester?.displayName ?? "Someone");
    await notifyRequester(ticket, ctx.user.id, {
      kind: "helpdesk.approval_progress",
      title: `${ctx.user.displayName} approved #${ticket.number}`,
      body: "It now needs one more approval.",
    });
    return { ticketNumber: ticket.number, outcome: "approved_step" };
  }

  await openApprovedTicket(ticket, rt ?? null, team, ctx.user.id);
  await notifyRequester(ticket, ctx.user.id, {
    kind: "helpdesk.approved",
    title: `#${ticket.number} was approved`,
    body: `${typeName}: ${ticket.subject}. The ${team.name} team has it now.`,
    email: true,
  });
  return { ticketNumber: ticket.number, outcome: "approved_final" };
}

/** Moves a fully approved ticket into the queue: open, SLA clock started, routed, pushed to connectors. */
async function openApprovedTicket(ticket: TicketRow, rt: RequestTypeRow | null, team: TeamRow, actorId: string) {
  const now = new Date();
  const due = await dueDatesFor(rt, team, ticket.priority, now);
  const assigneeId = ticket.assigneeId ?? (await roundRobinAssignee(team));
  const [opened] = await db
    .update(s.tickets)
    .set({ status: "open", assigneeId, firstResponseDueAt: due?.firstResponseDueAt ?? null, resolutionDueAt: due?.resolutionDueAt ?? null })
    .where(eq(s.tickets.id, ticket.id))
    .returning();
  await addEvent(ticket.id, actorId, "status", null, { from: "pending_approval", to: "open", slaStartedAt: now.toISOString() });
  if (assigneeId && !ticket.assigneeId) await addEvent(ticket.id, null, "assignment", null, { from: null, to: assigneeId, auto: true });
  await notifyWorkers(opened!, team, actorId, { kind: "helpdesk.new_ticket", title: `New request #${ticket.number}`, body: ticket.subject });
  await enqueueConnectorPush(ticket, "created");
  await safely("index", () => indexTicket(ticket.id));
}

export interface ApprovalListItem {
  id: string;
  step: number;
  steps: number;
  status: ApprovalRow["status"];
  viaGroup: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  decidedByName: string | null;
  comment: string | null;
  ticket: { id: string; number: number; subject: string; description: string; status: TicketRow["status"]; createdAt: Date; fields: Record<string, unknown> };
  requester: { id: string; name: string; title: string | null; department: string | null; avatarUrl: string | null };
  requestType: { name: string; icon: string | null; fields: RequestTypeRow["fields"] } | null;
  team: { name: string };
}

/** Approvals the user can act on (`pending`) or has decided (`decided`). */
export async function listMyApprovals(ctx: UserContext, view: "pending" | "decided" = "pending", limit = 50): Promise<ApprovalListItem[]> {
  const mine = or(eq(s.approvals.approverId, ctx.user.id), ctx.groupIds.length ? inArray(s.approvals.groupId, ctx.groupIds) : sql`false`);
  const where =
    view === "pending"
      ? and(eq(s.approvals.status, "pending"), mine, eq(s.tickets.status, "pending_approval"), sql`${s.tickets.requesterId} <> ${ctx.user.id}`)
      : and(eq(s.approvals.decidedById, ctx.user.id));
  const rows = await db
    .select({ a: s.approvals, t: s.tickets, u: s.users, rt: s.requestTypes, team: s.teams, groupName: s.groups.displayName })
    .from(s.approvals)
    .innerJoin(s.tickets, eq(s.tickets.id, s.approvals.ticketId))
    .innerJoin(s.users, eq(s.users.id, s.tickets.requesterId))
    .innerJoin(s.teams, eq(s.teams.id, s.tickets.teamId))
    .leftJoin(s.requestTypes, eq(s.requestTypes.id, s.tickets.requestTypeId))
    .leftJoin(s.groups, eq(s.groups.id, s.approvals.groupId))
    .where(where)
    .orderBy(view === "pending" ? asc(s.approvals.createdAt) : desc(s.approvals.decidedAt))
    .limit(limit);
  const counts = rows.length
    ? await db
        .select({ ticketId: s.approvals.ticketId, n: sql<number>`count(*)::int` })
        .from(s.approvals)
        .where(inArray(s.approvals.ticketId, rows.map((r) => r.t.id)))
        .groupBy(s.approvals.ticketId)
    : [];
  const deciders = new Map<string, string>();
  for (const r of rows) if (r.a.decidedById && !deciders.has(r.a.decidedById)) deciders.set(r.a.decidedById, "");
  if (deciders.size) {
    const us = await db.select({ id: s.users.id, n: s.users.displayName }).from(s.users).where(inArray(s.users.id, [...deciders.keys()]));
    for (const u of us) deciders.set(u.id, u.n);
  }
  return rows.map((r) => ({
    id: r.a.id,
    step: r.a.step,
    steps: counts.find((c) => c.ticketId === r.t.id)?.n ?? 1,
    status: r.a.status,
    viaGroup: r.a.groupId ? (r.groupName ?? "a group") : null,
    createdAt: r.a.createdAt,
    decidedAt: r.a.decidedAt,
    decidedByName: r.a.decidedById ? (deciders.get(r.a.decidedById) ?? null) : null,
    comment: r.a.comment,
    ticket: { id: r.t.id, number: r.t.number, subject: r.t.subject, description: r.t.description, status: r.t.status, createdAt: r.t.createdAt, fields: r.t.fields },
    requester: { id: r.u.id, name: r.u.displayName, title: r.u.title, department: r.u.department, avatarUrl: r.u.avatarUrl },
    requestType: r.rt ? { name: r.rt.name, icon: r.rt.icon, fields: r.rt.fields } : null,
    team: { name: r.team.name },
  }));
}

/** Count used by badges: pending approvals the user can act on. */
export async function countMyPendingApprovals(ctx: UserContext): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.approvals)
    .innerJoin(s.tickets, eq(s.tickets.id, s.approvals.ticketId))
    .where(
      and(
        eq(s.approvals.status, "pending"),
        eq(s.tickets.status, "pending_approval"),
        or(eq(s.approvals.approverId, ctx.user.id), ctx.groupIds.length ? inArray(s.approvals.groupId, ctx.groupIds) : sql`false`),
      ),
    );
  return row?.n ?? 0;
}

/** Unused-token cleanup for tickets that left approval some other way (cancelled). */
export async function voidApprovals(ticketId: string) {
  await db
    .update(s.approvals)
    .set({ tokenHash: null })
    .where(and(eq(s.approvals.ticketId, ticketId), or(eq(s.approvals.status, "pending"), eq(s.approvals.status, "waiting")), isNull(s.approvals.decidedAt)));
}
