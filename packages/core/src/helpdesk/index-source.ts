/**
 * Search indexing for the helpdesk. The integrator wires these into the reindex job.
 *  - Catalog items (request types) are visible to everyone.
 *  - Tickets are visible to their requester and to the team's agents.
 */
import { db, eq, s } from "@lobby/db";
import { removeSource, upsertSource } from "../search/write";

export async function indexRequestType(id: string): Promise<void> {
  const rows = await db
    .select({ rt: s.requestTypes, team: s.teams })
    .from(s.requestTypes)
    .innerJoin(s.teams, eq(s.teams.id, s.requestTypes.teamId))
    .where(eq(s.requestTypes.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || !row.rt.active) {
    await removeSource("request_type", id);
    return;
  }
  const { rt, team } = row;
  const fieldLabels = rt.fields.map((f) => f.label).join(", ");
  await upsertSource(
    "request_type",
    rt.id,
    [
      {
        title: rt.name,
        text: [rt.description ?? "", `Handled by the ${team.name} team.`, fieldLabels ? `Asks for: ${fieldLabels}.` : ""]
          .filter(Boolean)
          .join("\n\n"),
        url: `/help/new?type=${encodeURIComponent(rt.slug)}`,
      },
    ],
    ["*"],
  );
}

export async function reindexRequestTypes(): Promise<number> {
  const rows = await db.select({ id: s.requestTypes.id }).from(s.requestTypes);
  for (const r of rows) await indexRequestType(r.id);
  return rows.length;
}

export async function indexTicket(id: string): Promise<void> {
  const rows = await db
    .select({ t: s.tickets, team: s.teams, rtName: s.requestTypes.name })
    .from(s.tickets)
    .innerJoin(s.teams, eq(s.teams.id, s.tickets.teamId))
    .leftJoin(s.requestTypes, eq(s.requestTypes.id, s.tickets.requestTypeId))
    .where(eq(s.tickets.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    await removeSource("ticket", id);
    return;
  }
  const { t, team, rtName } = row;
  const acl = [`user:${t.requesterId}`, ...(team.agentGroupId ? [`group:${team.agentGroupId}`] : [])];
  await upsertSource(
    "ticket",
    t.id,
    [
      {
        title: `#${t.number} ${t.subject}`,
        text: [rtName ? `${rtName} (${team.name})` : team.name, t.description].filter(Boolean).join("\n\n"),
        url: `/help/${t.number}`,
      },
    ],
    acl,
  );
}

export async function reindexTickets(): Promise<number> {
  const rows = await db.select({ id: s.tickets.id }).from(s.tickets);
  for (const r of rows) await indexTicket(r.id);
  return rows.length;
}
