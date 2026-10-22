/**
 * The Lobby side of connector sync: connector links, and applying a status that came back
 * from an external system (Jira Service Management) to the Lobby ticket.
 */
import { and, db, eq, s, sql } from "@lobby/db";
import { addEvent, notifyRequester, safely, type TicketRow } from "./internal";
import { indexTicket } from "./index-source";

/** Names of the config keys that hold secrets, per connector kind. Stored encrypted as `<key>Enc`. */
export const CONNECTOR_SECRET_KEYS = {
  jira_sm: ["apiToken", "webhookSecret"],
  webhook: ["secret"],
} as const;

export async function upsertConnectorLink(
  ticketId: string,
  connectorId: string,
  patch: { externalKey?: string | null; externalUrl?: string | null; lastStatus?: string | null; lastError?: string | null },
) {
  const values = { ticketId, connectorId, ...patch, lastSyncedAt: new Date() };
  await db
    .insert(s.connectorLinks)
    .values(values)
    .onConflictDoUpdate({ target: [s.connectorLinks.ticketId, s.connectorLinks.connectorId], set: { ...patch, lastSyncedAt: new Date() } });
}

export async function getConnectorLink(ticketId: string, connectorId: string) {
  return db.query.connectorLinks.findFirst({ where: and(eq(s.connectorLinks.ticketId, ticketId), eq(s.connectorLinks.connectorId, connectorId)) });
}

export async function findLinkByExternalKey(connectorId: string, externalKey: string) {
  return db.query.connectorLinks.findFirst({ where: and(eq(s.connectorLinks.connectorId, connectorId), eq(s.connectorLinks.externalKey, externalKey)) });
}

/** Maps an external status to a Lobby status. `category` follows Jira's new / indeterminate / done. */
export function mapExternalStatus(name: string, category?: string | null): TicketRow["status"] {
  const n = name.toLowerCase();
  const c = (category ?? "").toLowerCase();
  if (/waiting for (customer|reporter|requester)|pending customer|awaiting customer/.test(n)) return "waiting_on_requester";
  if (c === "done" || /^(resolved|done|closed|completed|canceled|cancelled)$/.test(n)) return n === "closed" ? "closed" : "resolved";
  return "open";
}

/**
 * Applies a status reported by a connector. Approval and rejection stay Lobby's decision, so
 * tickets waiting for approval or already rejected are never changed from outside.
 */
export async function applyExternalStatus(ticketId: string, connectorId: string, externalStatus: string, category?: string | null) {
  await upsertConnectorLink(ticketId, connectorId, { lastStatus: externalStatus, lastError: null });
  const t = await db.query.tickets.findFirst({ where: eq(s.tickets.id, ticketId) });
  if (!t || t.status === "pending_approval" || t.status === "rejected") return { changed: false as const };
  const to = mapExternalStatus(externalStatus, category);
  if (to === t.status || (to === "open" && t.status === "new")) return { changed: false as const };
  const now = new Date();
  await db
    .update(s.tickets)
    .set({
      status: to,
      resolvedAt: to === "resolved" || to === "closed" ? (t.resolvedAt ?? now) : null,
      updatedAt: now,
    })
    .where(eq(s.tickets.id, t.id));
  const connector = await db.query.connectors.findFirst({ where: eq(s.connectors.id, connectorId), columns: { name: true } });
  await addEvent(t.id, null, "status", null, { from: t.status, to, via: connector?.name ?? "connector", externalStatus });
  if (to === "resolved" || to === "waiting_on_requester") {
    await notifyRequester(t, null, {
      kind: "helpdesk.status",
      title: to === "resolved" ? `#${t.number} is resolved` : `#${t.number} needs something from you`,
      body: t.subject,
      email: true,
    });
  }
  await safely("index", () => indexTicket(t.id));
  return { changed: true as const, from: t.status, to };
}

/** Everything a connector needs to push one ticket. */
export async function ticketForPush(ticketId: string) {
  const rows = await db
    .select({ t: s.tickets, team: s.teams, rt: s.requestTypes, requesterEmail: s.users.email, requesterName: s.users.displayName })
    .from(s.tickets)
    .innerJoin(s.teams, eq(s.teams.id, s.tickets.teamId))
    .innerJoin(s.users, eq(s.users.id, s.tickets.requesterId))
    .leftJoin(s.requestTypes, eq(s.requestTypes.id, s.tickets.requestTypeId))
    .where(eq(s.tickets.id, ticketId))
    .limit(1);
  return rows[0] ?? null;
}

export async function ticketEventById(eventId: string) {
  return db.query.ticketEvents.findFirst({ where: eq(s.ticketEvents.id, eventId) });
}

/** Records a connector outcome on the ticket timeline (internal, agents only). */
export async function recordConnectorEvent(ticketId: string, body: string, data: Record<string, unknown>) {
  await addEvent(ticketId, null, "connector", body, data);
}

export const connectorLinkCount = (connectorId: string) =>
  db.select({ n: sql<number>`count(*)::int` }).from(s.connectorLinks).where(eq(s.connectorLinks.connectorId, connectorId));
