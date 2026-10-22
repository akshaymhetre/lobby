/**
 * Orchestration between Lobby tickets and connectors. The worker calls `pushTicket` for
 * `helpdesk.connector-push` jobs; the inbound route calls `handleInbound`.
 */
import { db, eq, s } from "@lobby/db";
import { decrypt, env } from "@lobby/core";
import {
  applyExternalStatus,
  displayFieldValues,
  findLinkByExternalKey,
  getConnectorLink,
  recordConnectorEvent,
  ticketEventById,
  ticketForPush,
  upsertConnectorLink,
  type FormFieldDef,
} from "@lobby/core/helpdesk";
import { JiraServiceManagementConnector } from "./jira-sm";
import { WebhookConnector } from "./webhook";
import type { FetchLike, InboundRequest, TicketConnector, TicketPayload, UpdateEvent } from "./types";

export type ConnectorRow = typeof s.connectors.$inferSelect;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const secret = (config: Record<string, unknown>, key: string) => {
  const enc = str(config[`${key}Enc`]);
  return enc ? decrypt(enc) : "";
};

/** Builds a connector from its stored row, decrypting secrets. */
export function connectorFromRow(row: Pick<ConnectorRow, "kind" | "config">, fetchImpl?: FetchLike): TicketConnector {
  const c = row.config;
  if (row.kind === "jira_sm") {
    return new JiraServiceManagementConnector(
      {
        baseUrl: str(c.baseUrl),
        email: str(c.email),
        apiToken: secret(c, "apiToken"),
        serviceDeskId: str(c.serviceDeskId),
        requestTypeId: str(c.requestTypeId),
        raiseOnBehalfOf: c.raiseOnBehalfOf === true,
        webhookSecret: secret(c, "webhookSecret") || undefined,
      },
      fetchImpl,
    );
  }
  return new WebhookConnector({ url: str(c.url), secret: secret(c, "secret") }, fetchImpl);
}

async function payloadFor(ticketId: string): Promise<TicketPayload | null> {
  const row = await ticketForPush(ticketId);
  if (!row) return null;
  const fields = await displayFieldValues((row.rt?.fields ?? []) as FormFieldDef[], row.t.fields);
  return {
    id: row.t.id,
    number: row.t.number,
    subject: row.t.subject,
    description: row.t.description,
    status: row.t.status,
    priority: row.t.priority,
    url: `${env.url}/help/${row.t.number}`,
    createdAt: row.t.createdAt.toISOString(),
    team: { slug: row.team.slug, name: row.team.name },
    requestType: row.rt ? { slug: row.rt.slug, name: row.rt.name } : null,
    requester: { name: row.requesterName, email: row.requesterEmail },
    fields: fields.map((f) => ({ label: f.label, value: f.value })),
  };
}

export interface PushJob {
  ticketId: string;
  connectorId: string;
  event: "created" | "updated" | "comment";
  eventId?: string;
  change?: UpdateEvent;
}

/**
 * Pushes one ticket event to one connector. Safe to retry: a ticket is created externally
 * only while no external key is recorded. Errors are recorded on the link, then rethrown
 * so the job queue retries.
 */
export async function pushTicket(job: PushJob, fetchImpl?: FetchLike): Promise<"skipped" | "created" | "updated" | "commented"> {
  const row = await db.query.connectors.findFirst({ where: eq(s.connectors.id, job.connectorId) });
  if (!row || !row.enabled) return "skipped";
  const ticket = await payloadFor(job.ticketId);
  if (!ticket) return "skipped";
  if (row.requestTypeIds.length) {
    const t = await db.query.tickets.findFirst({ where: eq(s.tickets.id, job.ticketId), columns: { requestTypeId: true } });
    if (!t?.requestTypeId || !row.requestTypeIds.includes(t.requestTypeId)) return "skipped";
  }
  const connector = connectorFromRow(row, fetchImpl);
  const link = await getConnectorLink(job.ticketId, row.id);

  try {
    if (!link?.externalKey && row.kind === "jira_sm") {
      // Never comment on or update a Jira request that doesn't exist yet: create it first.
      const res = await connector.create(ticket);
      await upsertConnectorLink(job.ticketId, row.id, { externalKey: res.externalKey ?? null, externalUrl: res.externalUrl ?? null, lastStatus: res.status ?? null, lastError: null });
      await recordConnectorEvent(job.ticketId, `Sent to ${row.name} as ${res.externalKey}.`, { connectorId: row.id, externalKey: res.externalKey, externalUrl: res.externalUrl });
      return "created";
    }

    if (job.event === "created") {
      if (link) return "skipped"; // already delivered on an earlier attempt
      const res = await connector.create(ticket);
      await upsertConnectorLink(job.ticketId, row.id, { externalKey: res.externalKey ?? null, externalUrl: res.externalUrl ?? null, lastStatus: res.status ?? null, lastError: null });
      await recordConnectorEvent(job.ticketId, res.externalKey ? `Sent to ${row.name} as ${res.externalKey}.` : `Sent to ${row.name}.`, { connectorId: row.id, externalKey: res.externalKey ?? null });
      return "created";
    }

    const ref = { externalKey: link?.externalKey ?? null, externalUrl: link?.externalUrl ?? null };
    if (job.event === "comment") {
      const ev = job.eventId ? await ticketEventById(job.eventId) : null;
      if (!ev || ev.kind !== "reply" || ev.ticketId !== job.ticketId) return "skipped"; // internal notes never leave Lobby
      const author = ev.actorId ? await db.query.users.findFirst({ where: eq(s.users.id, ev.actorId), columns: { displayName: true } }) : null;
      await connector.comment(ref, { body: ev.body ?? "", authorName: author?.displayName ?? "Lobby" }, ticket);
      await upsertConnectorLink(job.ticketId, row.id, { lastError: null });
      return "commented";
    }

    const res = await connector.update(ref, ticket, updateEventFrom(job));
    await upsertConnectorLink(job.ticketId, row.id, { lastError: null, ...(res.status ? { lastStatus: res.status } : {}) });
    return "updated";
  } catch (err) {
    await upsertConnectorLink(job.ticketId, row.id, { lastError: (err as Error).message.slice(0, 500) });
    throw err;
  }
}

function updateEventFrom(job: PushJob): UpdateEvent {
  return job.change ?? { kind: "other" };
}

/** Pulls the current status from the external system and applies it. */
export async function refreshStatus(ticketId: string, connectorId: string, fetchImpl?: FetchLike) {
  const row = await db.query.connectors.findFirst({ where: eq(s.connectors.id, connectorId) });
  const link = await getConnectorLink(ticketId, connectorId);
  if (!row || !link?.externalKey) return null;
  const st = await connectorFromRow(row, fetchImpl).fetchStatus({ externalKey: link.externalKey });
  if (!st) return null;
  return applyExternalStatus(ticketId, connectorId, st.status, st.category);
}

/** Runs the connector's own test call with the stored settings. */
export async function testConnector(connectorId: string, fetchImpl?: FetchLike) {
  const row = await db.query.connectors.findFirst({ where: eq(s.connectors.id, connectorId) });
  if (!row) return { ok: false, message: "That connector doesn't exist." };
  try {
    return await connectorFromRow(row, fetchImpl).test();
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

/**
 * Handles an inbound Jira webhook. Returns an HTTP status and a short message; never reveals
 * whether a connector exists to a caller without the secret.
 */
export async function handleInbound(connectorId: string, req: InboundRequest): Promise<{ status: number; message: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(connectorId)) return { status: 404, message: "Not found" };
  const row = await db.query.connectors.findFirst({ where: eq(s.connectors.id, connectorId) });
  if (!row || row.kind !== "jira_sm" || !row.enabled) return { status: 404, message: "Not found" };
  const connector = connectorFromRow(row);
  if (!connector.verifyInbound(req)) return { status: 401, message: "Bad or missing secret" };
  const update = connector.parseInbound(req);
  if (!update) return { status: 202, message: "Ignored: no issue key or status in the body" };
  const link = await findLinkByExternalKey(row.id, update.externalKey);
  if (!link) return { status: 202, message: `Ignored: ${update.externalKey} is not linked to a Lobby ticket` };
  const result = await applyExternalStatus(link.ticketId, row.id, update.status, update.category);
  return { status: 200, message: result.changed ? `Updated to ${result.to}` : "No change" };
}
