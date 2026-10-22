/**
 * Tickets: create, read, reply, note, assign, status and priority. Every change writes a
 * ticket_event; public changes notify the requester.
 */
import { and, asc, db, desc, eq, ilike, inArray, isNull, lte, or, s, sql, type SQL } from "@lobby/db";
import type { UserContext } from "../identity/context";
import { audit } from "../audit";
import { validateFields, type FormFieldDef } from "./fields";
import { indexTicket } from "./index-source";
import { startApprovals, voidApprovals } from "./approvals";
import { slaState, type SlaState } from "./sla";
import {
  accessTo,
  addEvent,
  canWorkTeam,
  DONE_STATUSES,
  dueDatesFor,
  enqueueConnectorPush,
  groupMemberIds,
  HelpdeskError,
  loadTicket,
  notifyRequester,
  notifyWorkers,
  OPEN_STATUSES,
  roundRobinAssignee,
  safely,
  workableTeamIds,
  type TeamRow,
  type TicketAccess,
  type TicketRow,
} from "./internal";

export type Priority = TicketRow["priority"];
export type TicketStatus = TicketRow["status"];
export type TicketSource = TicketRow["source"];

export interface CreateTicketInput {
  requestTypeSlug: string;
  subject: string;
  description?: string;
  fields?: Record<string, unknown>;
  priority?: Priority;
  source?: TicketSource;
  onBehalfOfUserId?: string;
}

const PRIORITY_SET = new Set(["low", "normal", "high", "urgent"]);

/**
 * Raises a ticket: validates the form, routes it to the request type's team, applies
 * approvals or starts the SLA, round-robins when the team asks for it, notifies, pushes
 * to connectors, indexes and audits. Callers outside the helpdesk (apps, journeys, AI)
 * use this; it throws HelpdeskError with `fieldErrors` for invalid input.
 */
export async function createTicket(ctx: UserContext, input: CreateTicketInput): Promise<{ id: string; number: number }> {
  const rt = await db.query.requestTypes.findFirst({ where: eq(s.requestTypes.slug, input.requestTypeSlug) });
  if (!rt || !rt.active) throw new HelpdeskError(`There's no request type called "${input.requestTypeSlug}".`, "not_found");
  const team = await db.query.teams.findFirst({ where: eq(s.teams.id, rt.teamId) });
  if (!team) throw new HelpdeskError("That request type has no team.", "invalid");

  const subject = (input.subject ?? "").trim().replace(/\s+/g, " ");
  const description = (input.description ?? "").trim();
  const fieldErrors: Record<string, string> = {};
  if (!subject) fieldErrors.subject = "Add a short summary.";
  else if (subject.length > 200) fieldErrors.subject = "Keep the summary under 200 characters.";
  if (description.length > 20_000) fieldErrors.description = "That's too long. Keep it under 20,000 characters.";
  const checked = validateFields(rt.fields as FormFieldDef[], await normaliseAppRefs(rt.fields as FormFieldDef[], input.fields ?? {}));
  if (!checked.ok) Object.assign(fieldErrors, checked.errors);
  if (Object.keys(fieldErrors).length) throw new HelpdeskError("Some fields need attention.", "invalid", fieldErrors);
  await assertPickerValues(ctx, rt.fields as FormFieldDef[], checked.values);

  let requesterId = ctx.user.id;
  if (input.onBehalfOfUserId && input.onBehalfOfUserId !== ctx.user.id) {
    const target = await db.query.users.findFirst({ where: eq(s.users.id, input.onBehalfOfUserId) });
    if (!target) throw new HelpdeskError("That person doesn't exist.", "not_found");
    const allowed = ctx.has("agent") || ctx.has("admin") || target.managerId === ctx.user.id || input.source === "journey";
    if (!allowed) throw new HelpdeskError("You can only raise requests for yourself or your reports.", "forbidden");
    requesterId = target.id;
  }
  const requester = (await db.query.users.findFirst({ where: eq(s.users.id, requesterId) }))!;

  const priority = input.priority && PRIORITY_SET.has(input.priority) ? input.priority : rt.defaultPriority;
  const needsApproval = rt.approval?.mode && rt.approval.mode !== "none";
  const now = new Date();
  const due = needsApproval ? null : await dueDatesFor(rt, team, priority, now);
  const assigneeId = needsApproval ? null : await roundRobinAssignee(team);

  const [ticket] = await db
    .insert(s.tickets)
    .values({
      requestTypeId: rt.id,
      teamId: team.id,
      requesterId,
      assigneeId,
      subject,
      description,
      fields: checked.values,
      status: needsApproval ? "pending_approval" : "new",
      priority,
      source: input.source ?? "portal",
      firstResponseDueAt: due?.firstResponseDueAt ?? null,
      resolutionDueAt: due?.resolutionDueAt ?? null,
      createdAt: now,
    })
    .returning();
  const t = ticket!;

  await addEvent(t.id, ctx.user.id, "system", null, {
    action: "created",
    source: t.source,
    onBehalfOf: requesterId !== ctx.user.id ? requesterId : undefined,
  });
  if (assigneeId) await addEvent(t.id, null, "assignment", null, { from: null, to: assigneeId, auto: true });

  let approvalStarted = false;
  if (needsApproval) {
    approvalStarted = await startApprovals(t, rt, team, { id: requester.id, managerId: requester.managerId, displayName: requester.displayName });
    if (!approvalStarted) {
      // No approver could be found at all: go straight to the queue with the SLA running.
      const d = await dueDatesFor(rt, team, priority, now);
      await db.update(s.tickets).set({ status: "new", firstResponseDueAt: d?.firstResponseDueAt ?? null, resolutionDueAt: d?.resolutionDueAt ?? null }).where(eq(s.tickets.id, t.id));
      t.status = "new";
    }
  }

  if (!approvalStarted) {
    await notifyWorkers(t, team, ctx.user.id, { kind: "helpdesk.new_ticket", title: `New request #${t.number}`, body: t.subject });
    await enqueueConnectorPush(t, "created");
  }
  await safely("index", () => indexTicket(t.id));
  await audit(ctx.user.id, "helpdesk.ticket_created", { type: "ticket", id: t.id }, { number: t.number, requestType: rt.slug, source: t.source, requesterId });
  return { id: t.id, number: t.number };
}

/** User and app pickers must point at rows the requester can actually see. */
async function assertPickerValues(ctx: UserContext, fields: FormFieldDef[], values: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = values[f.key];
    if (typeof v !== "string") continue;
    if (f.type === "user") {
      const u = await db.query.users.findFirst({ where: and(eq(s.users.id, v), eq(s.users.status, "active")), columns: { id: true } });
      if (!u) errors[f.key] = "Choose someone from the list.";
    }
    if (f.type === "app") {
      const app = await db.query.apps.findFirst({ where: eq(s.apps.id, v), columns: { id: true, requestAccessEnabled: true } });
      const visible = app ? (await visibleAppIds(ctx, [v])).length > 0 : false;
      if (!app || (!visible && !app.requestAccessEnabled)) errors[f.key] = "Choose an app from the list.";
    }
  }
  if (Object.keys(errors).length) throw new HelpdeskError("Some fields need attention.", "invalid", errors);
}

/** App ids (from `ids`) the user can see: apps with no visibility rows, or one of the user's groups. */
async function visibleAppIds(ctx: UserContext, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: s.apps.id })
    .from(s.apps)
    .where(
      and(
        inArray(s.apps.id, ids),
        or(
          sql`not exists (select 1 from ${s.appVisibility} v where v.app_id = ${s.apps.id})`,
          ctx.groupIds.length
            ? sql`exists (select 1 from ${s.appVisibility} v where v.app_id = ${s.apps.id} and v.group_id = any(${`{${ctx.groupIds.join(",")}}`}::uuid[]))`
            : sql`false`,
        ),
      ),
    );
  return rows.map((r) => r.id);
}

/** Callers (the launcher, the assistant) may pass an app slug; the form stores the app id. */
async function normaliseAppRefs(fields: FormFieldDef[], values: Record<string, unknown>) {
  const out = { ...values };
  for (const f of fields) {
    const v = out[f.key];
    if (f.type !== "app" || typeof v !== "string" || !v || /^[0-9a-f-]{36}$/i.test(v)) continue;
    const app = await db.query.apps.findFirst({ where: eq(s.apps.slug, v), columns: { id: true } });
    if (app) out[f.key] = app.id;
  }
  return out;
}

/**
 * Options for the app picker: apps the user can open, plus apps they can ask for
 * (asking for access to something you can't see yet is the whole point of the form).
 */
export async function listPickableApps(ctx: UserContext) {
  const rows = await db
    .select({ id: s.apps.id, name: s.apps.name, category: s.apps.category, icon: s.apps.icon, requestAccessEnabled: s.apps.requestAccessEnabled })
    .from(s.apps)
    .orderBy(asc(s.apps.name));
  const visible = new Set(await visibleAppIds(ctx, rows.map((r) => r.id)));
  return rows
    .filter((r) => visible.has(r.id) || r.requestAccessEnabled)
    .map((r) => ({ id: r.id, name: r.name, category: r.category, icon: r.icon, hasAccess: visible.has(r.id) }));
}

/** Options for the person picker. */
export async function searchPeople(query: string, limit = 8) {
  const q = query.trim();
  const where = q
    ? and(eq(s.users.status, "active"), eq(s.users.isBreakGlass, false), or(ilike(s.users.displayName, `%${q.replace(/[%_]/g, "")}%`), ilike(s.users.email, `${q.replace(/[%_]/g, "")}%`)))
    : and(eq(s.users.status, "active"), eq(s.users.isBreakGlass, false));
  return db
    .select({ id: s.users.id, name: s.users.displayName, title: s.users.title, avatarUrl: s.users.avatarUrl })
    .from(s.users)
    .where(where)
    .orderBy(asc(s.users.displayName))
    .limit(Math.min(limit, 25));
}

export interface TicketListItem {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  priority: Priority;
  createdAt: Date;
  updatedAt: Date;
  requestTypeName: string | null;
  requestTypeIcon: string | null;
  teamName: string;
  assigneeName: string | null;
  resolutionDueAt: Date | null;
  resolvedAt: Date | null;
  firstResponseDueAt: Date | null;
  firstRespondedAt: Date | null;
  sla: SlaState;
}

/** The signed-in user's own requests, newest activity first. */
export async function listMyTickets(ctx: UserContext, opts: { open?: boolean; limit?: number } = {}): Promise<TicketListItem[]> {
  const conds: SQL[] = [eq(s.tickets.requesterId, ctx.user.id)];
  if (opts.open === true) conds.push(inArray(s.tickets.status, [...OPEN_STATUSES]));
  if (opts.open === false) conds.push(inArray(s.tickets.status, [...DONE_STATUSES]));
  const assignee = sql<string | null>`(select display_name from users a where a.id = ${s.tickets.assigneeId})`;
  const rows = await db
    .select({ t: s.tickets, rtName: s.requestTypes.name, rtIcon: s.requestTypes.icon, teamName: s.teams.name, assigneeName: assignee })
    .from(s.tickets)
    .innerJoin(s.teams, eq(s.teams.id, s.tickets.teamId))
    .leftJoin(s.requestTypes, eq(s.requestTypes.id, s.tickets.requestTypeId))
    .where(and(...conds))
    .orderBy(desc(s.tickets.updatedAt))
    .limit(Math.min(opts.limit ?? 50, 200));
  const now = new Date();
  return rows.map((r) => toListItem(r.t, r.rtName, r.rtIcon, r.teamName, r.assigneeName, now));
}

function toListItem(t: TicketRow, rtName: string | null, rtIcon: string | null, teamName: string, assigneeName: string | null, now: Date): TicketListItem {
  return {
    id: t.id,
    number: t.number,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    requestTypeName: rtName,
    requestTypeIcon: rtIcon,
    teamName,
    assigneeName,
    resolutionDueAt: t.resolutionDueAt,
    resolvedAt: t.resolvedAt,
    firstResponseDueAt: t.firstResponseDueAt,
    firstRespondedAt: t.firstRespondedAt,
    sla: ticketSlaState(t, now),
  };
}

/** The clock that matters now: first response until answered, then resolution. */
export function ticketSlaState(t: Pick<TicketRow, "status" | "firstResponseDueAt" | "firstRespondedAt" | "resolutionDueAt" | "resolvedAt" | "firstResponseBreachedAt" | "resolutionBreachedAt">, now = new Date()): SlaState {
  if (t.status === "pending_approval" || t.status === "rejected") return "none";
  if (t.resolutionBreachedAt || t.firstResponseBreachedAt) return "breached";
  if (t.resolvedAt || (DONE_STATUSES as readonly string[]).includes(t.status)) return t.resolutionDueAt ? slaState(t.resolutionDueAt, t.resolvedAt ?? now, now) : "none";
  if (!t.firstRespondedAt && t.firstResponseDueAt) {
    const fr = slaState(t.firstResponseDueAt, null, now);
    const res = slaState(t.resolutionDueAt, null, now);
    return fr === "breached" || res === "breached" ? "breached" : fr === "soon" || res === "soon" ? "soon" : "ok";
  }
  return slaState(t.resolutionDueAt, null, now);
}

// ---------------------------------------------------------------------------------------------
// Ticket detail

export interface TimelineEvent {
  id: string;
  kind: string;
  body: string | null;
  data: Record<string, unknown>;
  createdAt: Date;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
}

const PUBLIC_KINDS = new Set(["reply", "status", "approval", "assignment"]);

function isPublicEvent(e: { kind: string; data: Record<string, unknown> }) {
  if (PUBLIC_KINDS.has(e.kind)) return true;
  return e.kind === "system" && ["created", "approval_fallback", "approval_skipped", "external_status"].includes(String(e.data.action));
}

export async function getTicketDetail(ctx: UserContext, number: number) {
  const t = await db.query.tickets.findFirst({ where: eq(s.tickets.number, number) });
  if (!t) return null;
  const team = (await db.query.teams.findFirst({ where: eq(s.teams.id, t.teamId) }))!;
  const access = await accessTo(ctx, t, team);
  if (!access) return null;

  const [rt, requester, assignee, events, approvals, links] = await Promise.all([
    t.requestTypeId ? db.query.requestTypes.findFirst({ where: eq(s.requestTypes.id, t.requestTypeId) }) : null,
    db.query.users.findFirst({ where: eq(s.users.id, t.requesterId) }),
    t.assigneeId ? db.query.users.findFirst({ where: eq(s.users.id, t.assigneeId) }) : null,
    db.select().from(s.ticketEvents).where(eq(s.ticketEvents.ticketId, t.id)).orderBy(asc(s.ticketEvents.createdAt)),
    db
      .select({ a: s.approvals, groupName: s.groups.displayName })
      .from(s.approvals)
      .leftJoin(s.groups, eq(s.groups.id, s.approvals.groupId))
      .where(eq(s.approvals.ticketId, t.id))
      .orderBy(asc(s.approvals.step)),
    access === "agent"
      ? db.select({ l: s.connectorLinks, name: s.connectors.name, kind: s.connectors.kind }).from(s.connectorLinks).innerJoin(s.connectors, eq(s.connectors.id, s.connectorLinks.connectorId)).where(eq(s.connectorLinks.ticketId, t.id))
      : Promise.resolve([]),
  ]);
  const manager = requester?.managerId ? await db.query.users.findFirst({ where: eq(s.users.id, requester.managerId), columns: { id: true, displayName: true, title: true } }) : null;

  const visible = access === "agent" ? events : events.filter((e) => isPublicEvent(e));
  const userIds = new Set<string>();
  for (const e of visible) {
    if (e.actorId) userIds.add(e.actorId);
    for (const k of ["to", "from"]) if (e.kind === "assignment" && typeof e.data[k] === "string") userIds.add(e.data[k] as string);
  }
  for (const a of approvals) {
    if (a.a.approverId) userIds.add(a.a.approverId);
    if (a.a.decidedById) userIds.add(a.a.decidedById);
  }
  const people = userIds.size
    ? await db.select({ id: s.users.id, name: s.users.displayName, avatarUrl: s.users.avatarUrl }).from(s.users).where(inArray(s.users.id, [...userIds]))
    : [];
  const byId = new Map(people.map((p) => [p.id, p]));

  const fieldDefs = (rt?.fields ?? []) as FormFieldDef[];
  const fieldDisplay = await displayFieldValues(fieldDefs, t.fields);

  return {
    access: access as Exclude<TicketAccess, null>,
    canWork: access === "agent",
    ticket: t,
    sla: ticketSlaState(t),
    team: { id: team.id, slug: team.slug, name: team.name, icon: team.icon, agentGroupId: team.agentGroupId },
    requestType: rt ? { id: rt.id, slug: rt.slug, name: rt.name, icon: rt.icon } : null,
    requester: requester
      ? { id: requester.id, name: requester.displayName, email: requester.email, title: requester.title, department: requester.department, location: requester.location, avatarUrl: requester.avatarUrl, manager: manager ? { id: manager.id, name: manager.displayName, title: manager.title } : null }
      : null,
    assignee: assignee ? { id: assignee.id, name: assignee.displayName, avatarUrl: assignee.avatarUrl } : null,
    fields: fieldDisplay,
    events: visible.map<TimelineEvent>((e) => ({
      id: e.id,
      kind: e.kind,
      body: e.body,
      data: resolveEventNames(e.data, byId),
      createdAt: e.createdAt,
      actor: e.actorId ? (byId.get(e.actorId) ?? null) : null,
    })),
    approvals: approvals.map(({ a, groupName }) => ({
      id: a.id,
      step: a.step,
      status: a.status,
      approverName: a.approverId ? (byId.get(a.approverId)?.name ?? null) : null,
      groupName: groupName ?? null,
      decidedByName: a.decidedById ? (byId.get(a.decidedById)?.name ?? null) : null,
      decidedAt: a.decidedAt,
      comment: a.comment,
      canDecide:
        a.status === "pending" && t.status === "pending_approval" && t.requesterId !== ctx.user.id && (a.approverId === ctx.user.id || (!!a.groupId && ctx.groupIds.includes(a.groupId))),
    })),
    connectorLinks: links.map((l) => ({ connectorName: l.name, kind: l.kind, externalKey: l.l.externalKey, externalUrl: l.l.externalUrl, lastStatus: l.l.lastStatus, lastError: l.l.lastError, lastSyncedAt: l.l.lastSyncedAt })),
  };
}

export type TicketDetail = NonNullable<Awaited<ReturnType<typeof getTicketDetail>>>;

function resolveEventNames(data: Record<string, unknown>, byId: Map<string, { name: string }>) {
  const out = { ...data };
  for (const k of ["to", "from"]) {
    const v = data[k];
    if (typeof v === "string" && byId.has(v)) out[`${k}Name`] = byId.get(v)!.name;
  }
  return out;
}

/** Field values as label/value pairs, with people and apps shown by name. */
export async function displayFieldValues(defs: FormFieldDef[], values: Record<string, unknown>) {
  const userIds = defs.filter((d) => d.type === "user" && typeof values[d.key] === "string").map((d) => values[d.key] as string);
  const appIds = defs.filter((d) => d.type === "app" && typeof values[d.key] === "string").map((d) => values[d.key] as string);
  const [us, as] = await Promise.all([
    userIds.length ? db.select({ id: s.users.id, n: s.users.displayName }).from(s.users).where(inArray(s.users.id, userIds)) : [],
    appIds.length ? db.select({ id: s.apps.id, n: s.apps.name }).from(s.apps).where(inArray(s.apps.id, appIds)) : [],
  ]);
  const names = new Map([...us, ...as].map((r) => [r.id, r.n]));
  const out: { key: string; label: string; value: string; type: FormFieldDef["type"] }[] = [];
  for (const d of defs) {
    const v = values[d.key];
    if (v === undefined || v === null || v === "") continue;
    let shown: string;
    if (d.type === "checkbox") {
      if (v !== true) continue;
      shown = "Yes";
    } else if (d.type === "user" || d.type === "app") shown = names.get(String(v)) ?? "Unknown";
    else if (d.type === "date") shown = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${v}T00:00:00Z`));
    else shown = String(v);
    out.push({ key: d.key, label: d.label, value: shown, type: d.type });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Actions

async function loadForAction(ctx: UserContext, ticketId: string) {
  const loaded = await loadTicket(ticketId);
  if (!loaded) throw new HelpdeskError("That request doesn't exist.", "not_found");
  const access = await accessTo(ctx, loaded.ticket, loaded.team);
  if (!access) throw new HelpdeskError("That request doesn't exist.", "not_found");
  return { ...loaded, access };
}

async function touch(ticketId: string, patch: Partial<typeof s.tickets.$inferInsert> = {}) {
  const [row] = await db.update(s.tickets).set({ ...patch, updatedAt: new Date() }).where(eq(s.tickets.id, ticketId)).returning();
  return row!;
}

/**
 * Adds a public reply or an internal note. Requesters can only reply. An agent's first
 * public reply records the first response; a requester replying to a ticket that was
 * waiting on them, or resolved, puts it back in the queue.
 */
export async function addComment(ctx: UserContext, ticketId: string, input: { body: string; internal?: boolean }) {
  const { ticket, team, access } = await loadForAction(ctx, ticketId);
  const body = input.body.trim();
  if (!body) throw new HelpdeskError("Write something first.", "invalid");
  if (body.length > 20_000) throw new HelpdeskError("That's too long. Keep it under 20,000 characters.", "invalid");
  const internal = !!input.internal;
  if (internal && access !== "agent") throw new HelpdeskError("Only the team can add internal notes.", "forbidden");
  if (access === "approver") throw new HelpdeskError("Approvers can comment when they approve or reject.", "forbidden");
  if (ticket.status === "closed" || ticket.status === "rejected") {
    if (!internal) throw new HelpdeskError("This request is closed. Raise a new one if you still need help.", "conflict");
  }

  const event = await addEvent(ticket.id, ctx.user.id, internal ? "internal_note" : "reply", body);
  const fromAgent = access === "agent" && ctx.user.id !== ticket.requesterId;
  const patch: Partial<typeof s.tickets.$inferInsert> = {};
  if (!internal && fromAgent) {
    if (!ticket.firstRespondedAt) patch.firstRespondedAt = new Date();
    if (ticket.status === "new") patch.status = "open";
    if (!ticket.assigneeId) patch.assigneeId = ctx.user.id;
  }
  if (!internal && !fromAgent && (ticket.status === "waiting_on_requester" || ticket.status === "resolved")) {
    patch.status = "open";
    patch.resolvedAt = null;
  }
  await touch(ticket.id, patch);
  if (patch.status && patch.status !== ticket.status) await addEvent(ticket.id, fromAgent ? ctx.user.id : null, "status", null, { from: ticket.status, to: patch.status, auto: true });
  if (patch.assigneeId) await addEvent(ticket.id, null, "assignment", null, { from: null, to: patch.assigneeId, auto: true });

  if (!internal) {
    if (fromAgent) {
      await notifyRequester(ticket, ctx.user.id, { kind: "helpdesk.reply", title: `${ctx.user.displayName} replied to #${ticket.number}`, body: body.slice(0, 280), email: true });
    } else {
      await notifyWorkers(ticket, team, ctx.user.id, { kind: "helpdesk.reply", title: `${ctx.user.displayName} replied to #${ticket.number}`, body: body.slice(0, 280) });
    }
    await enqueueConnectorPush(ticket, "comment", { eventId: event.id });
  }
  return event;
}

const AGENT_STATUSES: TicketStatus[] = ["new", "open", "waiting_on_requester", "resolved", "closed"];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  new: "New",
  open: "Open",
  pending_approval: "Waiting for approval",
  waiting_on_requester: "Waiting on you",
  resolved: "Resolved",
  closed: "Closed",
  rejected: "Not approved",
};

/** Agents move a ticket through the workflow; requesters can cancel an open request or close a resolved one. */
export async function setStatus(ctx: UserContext, ticketId: string, status: TicketStatus, opts: { reason?: string } = {}) {
  const { ticket, team, access } = await loadForAction(ctx, ticketId);
  if (ticket.status === status) return ticket;
  const isRequester = ticket.requesterId === ctx.user.id;
  if (access !== "agent") {
    if (!isRequester || status !== "closed") throw new HelpdeskError("Only the team can change the status.", "forbidden");
    if (ticket.status === "closed" || ticket.status === "rejected") throw new HelpdeskError("This request is already closed.", "conflict");
  } else if (!AGENT_STATUSES.includes(status)) {
    throw new HelpdeskError("That status can't be set by hand.", "invalid");
  } else if (ticket.status === "pending_approval" && status !== "closed") {
    throw new HelpdeskError("This request is waiting for approval. It moves on when it's approved.", "conflict");
  } else if (ticket.status === "rejected") {
    throw new HelpdeskError("This request wasn't approved, so it can't be reopened.", "conflict");
  }

  const now = new Date();
  const patch: Partial<typeof s.tickets.$inferInsert> = { status };
  if (status === "resolved" || status === "closed") patch.resolvedAt = ticket.resolvedAt ?? now;
  if (status === "open" || status === "new" || status === "waiting_on_requester") patch.resolvedAt = null;
  const cancelled = status === "closed" && isRequester && ticket.status !== "resolved";
  const updated = await touch(ticket.id, patch);
  if (ticket.status === "pending_approval") await voidApprovals(ticket.id);
  await addEvent(ticket.id, ctx.user.id, "status", opts.reason?.trim() || null, { from: ticket.status, to: status, cancelled: cancelled || undefined });
  await audit(ctx.user.id, "helpdesk.ticket_status", { type: "ticket", id: ticket.id }, { from: ticket.status, to: status });

  if (isRequester && access !== "agent") {
    await notifyWorkers(updated, team, ctx.user.id, {
      kind: "helpdesk.status",
      title: cancelled ? `${ctx.user.displayName} cancelled #${ticket.number}` : `${ctx.user.displayName} closed #${ticket.number}`,
      body: ticket.subject,
    });
  } else {
    const titles: Partial<Record<TicketStatus, string>> = {
      resolved: `#${ticket.number} is resolved`,
      waiting_on_requester: `#${ticket.number} needs something from you`,
      closed: `#${ticket.number} was closed`,
      open: `#${ticket.number} is open again`,
    };
    if (titles[status]) {
      await notifyRequester(ticket, ctx.user.id, { kind: "helpdesk.status", title: titles[status]!, body: ticket.subject, email: status === "resolved" || status === "waiting_on_requester" });
    }
  }
  await enqueueConnectorPush(ticket, "updated", { change: { kind: "status", from: ticket.status, to: status } });
  await safely("index", () => indexTicket(ticket.id));
  return updated;
}

/** Assigns tickets (bulk). The assignee must work the ticket's team; null unassigns. */
export async function assignTickets(ctx: UserContext, ticketIds: string[], assigneeId: string | null) {
  if (!ticketIds.length) return { updated: 0 };
  if (ticketIds.length > 200) throw new HelpdeskError("Assign at most 200 at a time.", "invalid");
  const rows = await db.select({ t: s.tickets, team: s.teams }).from(s.tickets).innerJoin(s.teams, eq(s.teams.id, s.tickets.teamId)).where(inArray(s.tickets.id, ticketIds));
  if (rows.length !== new Set(ticketIds).size) throw new HelpdeskError("Some of those requests don't exist.", "not_found");
  // Check everything before changing anything, so a refusal never leaves a half-applied bulk edit.
  const assignee = assigneeId ? await db.query.users.findFirst({ where: and(eq(s.users.id, assigneeId), eq(s.users.status, "active")), columns: { id: true } }) : null;
  if (assigneeId && !assignee) throw new HelpdeskError("That person can't be assigned.", "invalid");
  const assigneeIsAdmin = assigneeId ? await isAdminUser(assigneeId) : false;
  for (const { team } of rows) {
    if (!canWorkTeam(ctx, team)) throw new HelpdeskError(`You don't work the ${team.name} queue.`, "forbidden");
    if (assigneeId && !assigneeIsAdmin && !(await groupMemberIds(team.agentGroupId)).includes(assigneeId)) {
      throw new HelpdeskError(`That person isn't on the ${team.name} team.`, "invalid");
    }
  }
  let updated = 0;
  for (const { t, team } of rows) {
    if (t.assigneeId === assigneeId) continue;
    await touch(t.id, { assigneeId });
    await addEvent(t.id, ctx.user.id, "assignment", null, { from: t.assigneeId, to: assigneeId });
    if (assigneeId && assigneeId !== ctx.user.id) {
      await notifyWorkers({ ...t, assigneeId }, team, ctx.user.id, { kind: "helpdesk.assigned", title: `${ctx.user.displayName} assigned #${t.number} to you`, body: t.subject });
    }
    updated++;
  }
  await audit(ctx.user.id, "helpdesk.tickets_assigned", { type: "ticket", id: ticketIds[0]! }, { ticketIds, assigneeId });
  return { updated };
}

async function isAdminUser(userId: string): Promise<boolean> {
  const rows = await db
    .select({ role: s.roleMappings.role })
    .from(s.groupMembers)
    .innerJoin(s.groups, eq(s.groups.id, s.groupMembers.groupId))
    .innerJoin(s.roleMappings, eq(s.roleMappings.groupName, s.groups.name))
    .where(and(eq(s.groupMembers.userId, userId), eq(s.roleMappings.role, "admin")))
    .limit(1);
  return rows.length > 0;
}

/** Changes priority and recalculates the SLA clocks that have not been met yet. */
export async function setPriority(ctx: UserContext, ticketId: string, priority: Priority) {
  if (!PRIORITY_SET.has(priority)) throw new HelpdeskError("Unknown priority.", "invalid");
  const { ticket, team, access } = await loadForAction(ctx, ticketId);
  if (access !== "agent") throw new HelpdeskError("Only the team can change priority.", "forbidden");
  if (ticket.priority === priority) return ticket;
  const patch: Partial<typeof s.tickets.$inferInsert> = { priority };
  if (ticket.status !== "pending_approval" && ticket.firstResponseDueAt) {
    const start = await slaStart(ticket);
    const rt = ticket.requestTypeId ? await db.query.requestTypes.findFirst({ where: eq(s.requestTypes.id, ticket.requestTypeId) }) : null;
    const due = await dueDatesFor(rt ?? null, team, priority, start);
    if (due) {
      if (!ticket.firstRespondedAt && !ticket.firstResponseBreachedAt) patch.firstResponseDueAt = due.firstResponseDueAt;
      if (!ticket.resolvedAt && !ticket.resolutionBreachedAt) patch.resolutionDueAt = due.resolutionDueAt;
    }
  }
  const updated = await touch(ticket.id, patch);
  await addEvent(ticket.id, ctx.user.id, "system", null, { action: "priority", from: ticket.priority, to: priority });
  await audit(ctx.user.id, "helpdesk.ticket_priority", { type: "ticket", id: ticket.id }, { from: ticket.priority, to: priority });
  await enqueueConnectorPush(ticket, "updated", { change: { kind: "priority", from: ticket.priority, to: priority } });
  return updated;
}

/** When the SLA clock started: the final approval, or creation. */
async function slaStart(ticket: TicketRow): Promise<Date> {
  const [ev] = await db
    .select({ createdAt: s.ticketEvents.createdAt })
    .from(s.ticketEvents)
    .where(and(eq(s.ticketEvents.ticketId, ticket.id), eq(s.ticketEvents.kind, "status"), sql`${s.ticketEvents.data}->>'from' = 'pending_approval'`, sql`${s.ticketEvents.data}->>'to' = 'open'`))
    .orderBy(desc(s.ticketEvents.createdAt))
    .limit(1);
  return ev?.createdAt ?? ticket.createdAt;
}

// ---------------------------------------------------------------------------------------------
// Queue

export type QueueView = "unassigned" | "mine" | "open" | "breaching" | "resolved";
export type QueueSort = "number" | "subject" | "requester" | "type" | "priority" | "status" | "due";

export interface QueueItem extends TicketListItem {
  requesterId: string;
  requesterName: string;
  requesterAvatar: string | null;
  assigneeId: string | null;
  teamId: string;
  dueAt: Date | null;
}

export interface QueueResult {
  items: QueueItem[];
  counts: Record<QueueView, number>;
  teams: { id: string; name: string; slug: string }[];
}

const PRIORITY_RANK = sql`case ${s.tickets.priority} when 'urgent' then 4 when 'high' then 3 when 'normal' then 2 else 1 end`;
const DUE_AT = sql`case when ${s.tickets.firstRespondedAt} is null and ${s.tickets.firstResponseDueAt} is not null then least(${s.tickets.firstResponseDueAt}, ${s.tickets.resolutionDueAt}) else ${s.tickets.resolutionDueAt} end`;

export async function listQueue(
  ctx: UserContext,
  opts: { view?: QueueView; sort?: QueueSort; dir?: "asc" | "desc"; teamSlug?: string; q?: string; limit?: number } = {},
): Promise<QueueResult> {
  if (!ctx.has("agent") && !ctx.has("admin")) throw new HelpdeskError("The queue is for helpdesk agents.", "forbidden");
  const teamIds = await workableTeamIds(ctx);
  const allTeams = await db.select({ id: s.teams.id, name: s.teams.name, slug: s.teams.slug }).from(s.teams).orderBy(asc(s.teams.sortOrder), asc(s.teams.name));
  const teams = teamIds === null ? allTeams : allTeams.filter((t) => teamIds.includes(t.id));
  const scope: SQL[] = [];
  if (teamIds !== null) scope.push(teamIds.length ? inArray(s.tickets.teamId, teamIds) : sql`false`);
  const team = opts.teamSlug ? teams.find((t) => t.slug === opts.teamSlug) : null;
  if (team) scope.push(eq(s.tickets.teamId, team.id));
  const q = opts.q?.trim();
  if (q) {
    const n = Number(q.replace(/^#/, ""));
    scope.push(Number.isInteger(n) && n > 0 ? eq(s.tickets.number, n) : ilike(s.tickets.subject, `%${q.replace(/[%_]/g, "")}%`));
  }

  const soon = new Date(Date.now() + 2 * 3600_000);
  const working = inArray(s.tickets.status, ["new", "open", "waiting_on_requester"]);
  const views: Record<QueueView, SQL> = {
    unassigned: and(isNull(s.tickets.assigneeId), working)!,
    mine: and(eq(s.tickets.assigneeId, ctx.user.id), working)!,
    open: inArray(s.tickets.status, [...OPEN_STATUSES]),
    breaching: and(
      working,
      or(
        and(isNull(s.tickets.firstRespondedAt), lte(s.tickets.firstResponseDueAt, soon)),
        lte(s.tickets.resolutionDueAt, soon),
      ),
    )!,
    resolved: inArray(s.tickets.status, ["resolved", "closed", "rejected"]),
  };

  const countRows = await Promise.all(
    (Object.keys(views) as QueueView[]).map(async (v) => {
      const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(s.tickets).where(and(views[v], ...scope));
      return [v, r?.n ?? 0] as const;
    }),
  );
  const view = opts.view && views[opts.view] ? opts.view : "open";
  const dir = opts.dir === "asc" ? "asc" : opts.dir === "desc" ? "desc" : null;
  const requesterName = sql<string>`(select display_name from users r where r.id = ${s.tickets.requesterId})`;
  const sortCol: Record<QueueSort, SQL> = {
    number: sql`${s.tickets.number}`,
    subject: sql`lower(${s.tickets.subject})`,
    requester: sql`(select lower(display_name) from users r where r.id = ${s.tickets.requesterId})`,
    type: sql`lower(${s.requestTypes.name})`,
    priority: PRIORITY_RANK,
    status: sql`${s.tickets.status}`,
    due: DUE_AT,
  };
  const sort = opts.sort && sortCol[opts.sort] ? opts.sort : view === "resolved" ? "number" : "due";
  const defaultDir = sort === "due" ? "asc" : sort === "priority" || sort === "number" ? "desc" : "asc";
  const d = dir ?? defaultDir;
  const order = d === "asc" ? sql`${sortCol[sort]} asc nulls last` : sql`${sortCol[sort]} desc nulls last`;

  const rows = await db
    .select({
      t: s.tickets,
      rtName: s.requestTypes.name,
      rtIcon: s.requestTypes.icon,
      teamName: s.teams.name,
      requesterName,
      requesterAvatar: sql<string | null>`(select avatar_url from users r where r.id = ${s.tickets.requesterId})`,
      assigneeName: sql<string | null>`(select display_name from users a where a.id = ${s.tickets.assigneeId})`,
    })
    .from(s.tickets)
    .innerJoin(s.teams, eq(s.teams.id, s.tickets.teamId))
    .leftJoin(s.requestTypes, eq(s.requestTypes.id, s.tickets.requestTypeId))
    .where(and(views[view], ...scope))
    .orderBy(order, desc(s.tickets.number))
    .limit(Math.min(opts.limit ?? 200, 500));

  const now = new Date();
  return {
    items: rows.map((r) => {
      const base = toListItem(r.t, r.rtName, r.rtIcon, r.teamName, r.assigneeName, now);
      const dueAt = !r.t.firstRespondedAt && r.t.firstResponseDueAt
        ? new Date(Math.min(r.t.firstResponseDueAt.getTime(), r.t.resolutionDueAt?.getTime() ?? Infinity))
        : r.t.resolutionDueAt;
      return { ...base, requesterId: r.t.requesterId, requesterName: r.requesterName, requesterAvatar: r.requesterAvatar, assigneeId: r.t.assigneeId, teamId: r.t.teamId, dueAt };
    }),
    counts: Object.fromEntries(countRows) as Record<QueueView, number>,
    teams,
  };
}

/** Teammates who can be assigned a ticket from this team (its agent group, plus the acting admin). */
export async function assignableAgents(ctx: UserContext, teamIds: string[]) {
  const teams = teamIds.length ? await db.select().from(s.teams).where(inArray(s.teams.id, teamIds)) : [];
  const ids = new Set<string>();
  for (const t of teams as TeamRow[]) {
    if (!canWorkTeam(ctx, t)) continue;
    for (const id of await groupMemberIds(t.agentGroupId)) ids.add(id);
  }
  if (ctx.has("admin")) ids.add(ctx.user.id);
  if (!ids.size) return [];
  return db
    .select({ id: s.users.id, name: s.users.displayName, title: s.users.title, avatarUrl: s.users.avatarUrl })
    .from(s.users)
    .where(and(inArray(s.users.id, [...ids]), eq(s.users.status, "active")))
    .orderBy(asc(s.users.displayName));
}

/** Canned replies for a team, plus the ones shared by every team. */
export async function cannedRepliesFor(ctx: UserContext, teamId: string) {
  const team = await db.query.teams.findFirst({ where: eq(s.teams.id, teamId) });
  if (!team || !canWorkTeam(ctx, team)) return [];
  return db
    .select({ id: s.cannedReplies.id, title: s.cannedReplies.title, body: s.cannedReplies.body })
    .from(s.cannedReplies)
    .where(or(eq(s.cannedReplies.teamId, teamId), isNull(s.cannedReplies.teamId)))
    .orderBy(asc(s.cannedReplies.title));
}
