/**
 * Helpdesk configuration: teams, request types (with the form builder), SLA policies,
 * business calendars, canned replies and connectors. Admin only; every change is audited.
 */
import { z } from "zod";
import { and, asc, count, db, eq, inArray, ne, s } from "@lobby/db";
import type { UserContext } from "../identity/context";
import { audit } from "../audit";
import { encrypt } from "../crypto";
import { getOrgSettings } from "../settings";
import { validateSchema, FIELD_TYPES, type FormFieldDef } from "./fields";
import { indexRequestType, reindexRequestTypes } from "./index-source";
import { CONNECTOR_SECRET_KEYS } from "./connector-sync";
import { HelpdeskError } from "./internal";
import { STARTER_REQUEST_TYPES, STARTER_SLA_POLICIES, STARTER_TEAMS } from "./catalog-data";

function requireAdminCtx(ctx: UserContext) {
  if (!ctx.has("admin")) throw new HelpdeskError("Only admins can change helpdesk settings.", "forbidden");
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of r.error.issues) fieldErrors[issue.path.join(".") || "_"] ??= issue.message;
    throw new HelpdeskError(r.error.issues[0]?.message ?? "Check the form.", "invalid", fieldErrors);
  }
  return r.data;
}

const slug = z.string().trim().min(1, "Add a slug.").max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.");
const name = z.string().trim().min(1, "Add a name.").max(80);
const uuid = z.uuid();

// ---------------------------------------------------------------------------------------------

export async function loadHelpdeskAdmin(ctx: UserContext) {
  requireAdminCtx(ctx);
  const [teams, requestTypes, policies, calendars, canned, connectors, groups, ticketCounts] = await Promise.all([
    db.select().from(s.teams).orderBy(asc(s.teams.sortOrder), asc(s.teams.name)),
    db.select().from(s.requestTypes).orderBy(asc(s.requestTypes.sortOrder), asc(s.requestTypes.name)),
    db.select().from(s.slaPolicies).orderBy(asc(s.slaPolicies.name)),
    db.select().from(s.businessCalendars).orderBy(asc(s.businessCalendars.name)),
    db.select().from(s.cannedReplies).orderBy(asc(s.cannedReplies.title)),
    db.select().from(s.connectors).orderBy(asc(s.connectors.name)),
    db.select({ id: s.groups.id, name: s.groups.name, displayName: s.groups.displayName }).from(s.groups).orderBy(asc(s.groups.displayName)),
    db.select({ teamId: s.tickets.teamId, n: count() }).from(s.tickets).groupBy(s.tickets.teamId),
  ]);
  const links = connectors.length
    ? await db.select({ connectorId: s.connectorLinks.connectorId, n: count() }).from(s.connectorLinks).groupBy(s.connectorLinks.connectorId)
    : [];
  return {
    teams: teams.map((t) => ({ ...t, ticketCount: ticketCounts.find((c) => c.teamId === t.id)?.n ?? 0 })),
    requestTypes,
    policies,
    calendars,
    canned,
    groups,
    connectors: connectors.map((c) => ({
      id: c.id,
      kind: c.kind,
      name: c.name,
      enabled: c.enabled,
      requestTypeIds: c.requestTypeIds,
      createdAt: c.createdAt,
      linkedTickets: links.find((l) => l.connectorId === c.id)?.n ?? 0,
      config: publicConfig(c.kind, c.config),
    })),
  };
}

export type HelpdeskAdminData = Awaited<ReturnType<typeof loadHelpdeskAdmin>>;

/** Config without secrets: secret values become `<key>Set: true`. */
export function publicConfig(kind: keyof typeof CONNECTOR_SECRET_KEYS, config: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const secrets = CONNECTOR_SECRET_KEYS[kind] as readonly string[];
  for (const [k, v] of Object.entries(config)) {
    if (k.endsWith("Enc")) continue;
    out[k] = v;
  }
  for (const k of secrets) out[`${k}Set`] = !!config[`${k}Enc`];
  return out;
}

// ---------------------------------------------------------------------------------------------
// Teams

const teamInput = z.object({
  id: uuid.optional(),
  slug,
  name,
  description: z.string().trim().max(300).optional().default(""),
  icon: z.string().trim().max(40).optional().default("life-buoy"),
  agentGroupId: uuid.nullable().optional(),
  calendarId: uuid.nullable().optional(),
  roundRobin: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export async function saveTeam(ctx: UserContext, input: z.input<typeof teamInput>) {
  requireAdminCtx(ctx);
  const v = parse(teamInput, input);
  const clash = await db.query.teams.findFirst({ where: v.id ? and(eq(s.teams.slug, v.slug), ne(s.teams.id, v.id)) : eq(s.teams.slug, v.slug) });
  if (clash) throw new HelpdeskError("Another team already uses that slug.", "invalid", { slug: "Another team already uses that slug." });
  const values = { slug: v.slug, name: v.name, description: v.description || null, icon: v.icon, agentGroupId: v.agentGroupId ?? null, calendarId: v.calendarId ?? null, roundRobin: v.roundRobin, ...(v.sortOrder !== undefined ? { sortOrder: v.sortOrder } : {}) };
  const [row] = v.id
    ? await db.update(s.teams).set(values).where(eq(s.teams.id, v.id)).returning()
    : await db.insert(s.teams).values(values).returning();
  if (!row) throw new HelpdeskError("That team doesn't exist.", "not_found");
  await audit(ctx.user.id, v.id ? "helpdesk.team_updated" : "helpdesk.team_created", { type: "team", id: row.id }, values);
  if (v.id) {
    const types = await db.select({ id: s.requestTypes.id }).from(s.requestTypes).where(eq(s.requestTypes.teamId, row.id));
    for (const t of types) await indexRequestType(t.id);
  }
  return row;
}

export async function deleteTeam(ctx: UserContext, id: string) {
  requireAdminCtx(ctx);
  const [used] = await db.select({ n: count() }).from(s.tickets).where(eq(s.tickets.teamId, id));
  if ((used?.n ?? 0) > 0) throw new HelpdeskError("This team has requests, so it can't be deleted. Move its request types to another team instead.", "conflict");
  const types = await db.select({ id: s.requestTypes.id }).from(s.requestTypes).where(eq(s.requestTypes.teamId, id));
  const [row] = await db.delete(s.teams).where(eq(s.teams.id, id)).returning();
  if (!row) throw new HelpdeskError("That team doesn't exist.", "not_found");
  for (const t of types) await indexRequestType(t.id);
  await audit(ctx.user.id, "helpdesk.team_deleted", { type: "team", id }, { name: row.name });
}

// ---------------------------------------------------------------------------------------------
// Request types

const fieldInput = z.object({
  key: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1, "Every field needs a label.").max(200),
  type: z.enum(FIELD_TYPES.map((f) => f.value) as [FormFieldDef["type"], ...FormFieldDef["type"][]]),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  help: z.string().trim().max(300).optional(),
  showIf: z.object({ key: z.string(), equals: z.union([z.string(), z.boolean()]) }).optional(),
});

const requestTypeInput = z.object({
  id: uuid.optional(),
  slug,
  teamId: uuid,
  name,
  description: z.string().trim().max(400).optional().default(""),
  icon: z.string().trim().max(40).optional().default("life-buoy"),
  fields: z.array(fieldInput).max(40),
  approval: z.object({ mode: z.enum(["none", "manager", "group", "manager_then_group"]), groupId: uuid.optional() }),
  slaPolicyId: uuid.nullable().optional(),
  defaultPriority: z.enum(["low", "normal", "high", "urgent"]),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export async function saveRequestType(ctx: UserContext, input: z.input<typeof requestTypeInput>) {
  requireAdminCtx(ctx);
  const v = parse(requestTypeInput, input);
  const fields: FormFieldDef[] = v.fields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    ...(f.required ? { required: true } : {}),
    ...(f.type === "select" ? { options: (f.options ?? []).filter(Boolean) } : {}),
    ...(f.help ? { help: f.help } : {}),
    ...(f.showIf?.key ? { showIf: f.showIf } : {}),
  }));
  const problems = validateSchema(fields);
  if (problems.length) throw new HelpdeskError(problems[0]!, "invalid", { fields: problems.join(" ") });
  if ((v.approval.mode === "group" || v.approval.mode === "manager_then_group") && !v.approval.groupId) {
    const team = await db.query.teams.findFirst({ where: eq(s.teams.id, v.teamId) });
    if (!team?.agentGroupId) throw new HelpdeskError("Pick the group that approves.", "invalid", { "approval.groupId": "Pick the group that approves." });
  }
  const clash = await db.query.requestTypes.findFirst({ where: v.id ? and(eq(s.requestTypes.slug, v.slug), ne(s.requestTypes.id, v.id)) : eq(s.requestTypes.slug, v.slug) });
  if (clash) throw new HelpdeskError("Another request type already uses that slug.", "invalid", { slug: "Another request type already uses that slug." });
  const values = {
    slug: v.slug,
    teamId: v.teamId,
    name: v.name,
    description: v.description || null,
    icon: v.icon,
    fields,
    approval: v.approval.mode === "none" || v.approval.mode === "manager" ? { mode: v.approval.mode } : { mode: v.approval.mode, ...(v.approval.groupId ? { groupId: v.approval.groupId } : {}) },
    slaPolicyId: v.slaPolicyId ?? null,
    defaultPriority: v.defaultPriority,
    active: v.active,
    ...(v.sortOrder !== undefined ? { sortOrder: v.sortOrder } : {}),
  };
  const [row] = v.id
    ? await db.update(s.requestTypes).set(values).where(eq(s.requestTypes.id, v.id)).returning()
    : await db.insert(s.requestTypes).values(values).returning();
  if (!row) throw new HelpdeskError("That request type doesn't exist.", "not_found");
  await audit(ctx.user.id, v.id ? "helpdesk.request_type_updated" : "helpdesk.request_type_created", { type: "request_type", id: row.id }, { slug: row.slug, fields: fields.length, approval: values.approval, active: row.active });
  await indexRequestType(row.id);
  return row;
}

export async function deleteRequestType(ctx: UserContext, id: string) {
  requireAdminCtx(ctx);
  const [used] = await db.select({ n: count() }).from(s.tickets).where(eq(s.tickets.requestTypeId, id));
  if ((used?.n ?? 0) > 0) throw new HelpdeskError("Requests already use this type. Turn it off instead, so people can't pick it.", "conflict");
  const [row] = await db.delete(s.requestTypes).where(eq(s.requestTypes.id, id)).returning();
  if (!row) throw new HelpdeskError("That request type doesn't exist.", "not_found");
  await indexRequestType(id);
  await audit(ctx.user.id, "helpdesk.request_type_deleted", { type: "request_type", id }, { slug: row.slug });
}

// ---------------------------------------------------------------------------------------------
// SLA policies and calendars

const minutes = z.number().int().min(1, "Use at least 1 minute.").max(60 * 24 * 90);
const target = z.object({ firstResponse: minutes, resolution: minutes });
const policyInput = z.object({
  id: uuid.optional(),
  name,
  targets: z.object({ low: target, normal: target, high: target, urgent: target }),
});

export async function saveSlaPolicy(ctx: UserContext, input: z.input<typeof policyInput>) {
  requireAdminCtx(ctx);
  const v = parse(policyInput, input);
  for (const [p, t] of Object.entries(v.targets)) {
    if (t.resolution < t.firstResponse) throw new HelpdeskError(`For ${p}, resolution can't be sooner than first response.`, "invalid", { [`targets.${p}.resolution`]: "Must be at least the first-response time." });
  }
  const [row] = v.id
    ? await db.update(s.slaPolicies).set({ name: v.name, targets: v.targets }).where(eq(s.slaPolicies.id, v.id)).returning()
    : await db.insert(s.slaPolicies).values({ name: v.name, targets: v.targets }).returning();
  if (!row) throw new HelpdeskError("That policy doesn't exist.", "not_found");
  await audit(ctx.user.id, v.id ? "helpdesk.sla_policy_updated" : "helpdesk.sla_policy_created", { type: "sla_policy", id: row.id }, { name: row.name, targets: v.targets });
  return row;
}

export async function deleteSlaPolicy(ctx: UserContext, id: string) {
  requireAdminCtx(ctx);
  const [row] = await db.delete(s.slaPolicies).where(eq(s.slaPolicies.id, id)).returning();
  if (!row) throw new HelpdeskError("That policy doesn't exist.", "not_found");
  await audit(ctx.user.id, "helpdesk.sla_policy_deleted", { type: "sla_policy", id }, { name: row.name });
}

const calendarInput = z.object({
  id: uuid.optional(),
  name,
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Pick a valid timezone."),
  workDays: z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one working day."),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Holidays are dates like 2026-12-25.")).max(200),
});

export async function saveCalendar(ctx: UserContext, input: z.input<typeof calendarInput>) {
  requireAdminCtx(ctx);
  const v = parse(calendarInput, input);
  if (v.startMinute === v.endMinute) throw new HelpdeskError("Opening and closing times can't be the same.", "invalid", { endMinute: "Can't equal the opening time." });
  const values = { ...v, workDays: [...new Set(v.workDays)].sort(), holidays: [...new Set(v.holidays)].sort() };
  delete (values as { id?: string }).id;
  const [row] = v.id
    ? await db.update(s.businessCalendars).set(values).where(eq(s.businessCalendars.id, v.id)).returning()
    : await db.insert(s.businessCalendars).values(values).returning();
  if (!row) throw new HelpdeskError("That calendar doesn't exist.", "not_found");
  await audit(ctx.user.id, v.id ? "helpdesk.calendar_updated" : "helpdesk.calendar_created", { type: "business_calendar", id: row.id }, values);
  return row;
}

export async function deleteCalendar(ctx: UserContext, id: string) {
  requireAdminCtx(ctx);
  const [row] = await db.delete(s.businessCalendars).where(eq(s.businessCalendars.id, id)).returning();
  if (!row) throw new HelpdeskError("That calendar doesn't exist.", "not_found");
  await audit(ctx.user.id, "helpdesk.calendar_deleted", { type: "business_calendar", id }, { name: row.name });
}

// ---------------------------------------------------------------------------------------------
// Canned replies

const cannedInput = z.object({
  id: uuid.optional(),
  teamId: uuid.nullable().optional(),
  title: z.string().trim().min(1, "Add a title.").max(80),
  body: z.string().trim().min(1, "Write the reply.").max(5000),
});

export async function saveCannedReply(ctx: UserContext, input: z.input<typeof cannedInput>) {
  requireAdminCtx(ctx);
  const v = parse(cannedInput, input);
  const values = { teamId: v.teamId ?? null, title: v.title, body: v.body };
  const [row] = v.id
    ? await db.update(s.cannedReplies).set(values).where(eq(s.cannedReplies.id, v.id)).returning()
    : await db.insert(s.cannedReplies).values(values).returning();
  if (!row) throw new HelpdeskError("That reply doesn't exist.", "not_found");
  await audit(ctx.user.id, v.id ? "helpdesk.canned_reply_updated" : "helpdesk.canned_reply_created", { type: "canned_reply", id: row.id }, { title: row.title });
  return row;
}

export async function deleteCannedReply(ctx: UserContext, id: string) {
  requireAdminCtx(ctx);
  const [row] = await db.delete(s.cannedReplies).where(eq(s.cannedReplies.id, id)).returning();
  if (!row) throw new HelpdeskError("That reply doesn't exist.", "not_found");
  await audit(ctx.user.id, "helpdesk.canned_reply_deleted", { type: "canned_reply", id }, { title: row.title });
}

// ---------------------------------------------------------------------------------------------
// Connectors

const httpsUrl = z.url("Enter a full URL, like https://example.atlassian.net").refine((u) => /^https?:\/\//.test(u), "Use an http or https URL.");
const connectorInput = z.discriminatedUnion("kind", [
  z.object({
    id: uuid.optional(),
    kind: z.literal("jira_sm"),
    name,
    enabled: z.boolean(),
    requestTypeIds: z.array(uuid).max(100),
    config: z.object({
      baseUrl: httpsUrl,
      email: z.email("Enter the email of the Jira account."),
      apiToken: z.string().max(500).optional(),
      serviceDeskId: z.string().trim().regex(/^\d+$/, "Service desk ids are numbers."),
      requestTypeId: z.string().trim().regex(/^\d+$/, "Request type ids are numbers."),
      raiseOnBehalfOf: z.boolean().optional().default(false),
      webhookSecret: z.string().max(500).optional(),
    }),
  }),
  z.object({
    id: uuid.optional(),
    kind: z.literal("webhook"),
    name,
    enabled: z.boolean(),
    requestTypeIds: z.array(uuid).max(100),
    config: z.object({ url: httpsUrl, secret: z.string().max(500).optional() }),
  }),
]);

export async function saveConnector(ctx: UserContext, input: z.input<typeof connectorInput>) {
  requireAdminCtx(ctx);
  const v = parse(connectorInput, input);
  const existing = v.id ? await db.query.connectors.findFirst({ where: eq(s.connectors.id, v.id) }) : null;
  if (v.id && !existing) throw new HelpdeskError("That connector doesn't exist.", "not_found");
  if (existing && existing.kind !== v.kind) throw new HelpdeskError("A connector's kind can't change.", "invalid");
  if (v.requestTypeIds.length) {
    const found = await db.select({ id: s.requestTypes.id }).from(s.requestTypes).where(inArray(s.requestTypes.id, v.requestTypeIds));
    if (found.length !== new Set(v.requestTypeIds).size) throw new HelpdeskError("Some of those request types don't exist.", "invalid");
  }
  const config: Record<string, unknown> = {};
  const raw = v.config as Record<string, unknown>;
  const secretKeys = CONNECTOR_SECRET_KEYS[v.kind] as readonly string[];
  for (const [k, val] of Object.entries(raw)) if (!secretKeys.includes(k)) config[k] = typeof val === "string" ? (k === "baseUrl" ? val.trim().replace(/\/+$/, "") : val.trim()) : val;
  for (const k of secretKeys) {
    const val = typeof raw[k] === "string" ? (raw[k] as string).trim() : "";
    if (val) config[`${k}Enc`] = encrypt(val);
    else if (existing?.config[`${k}Enc`]) config[`${k}Enc`] = existing.config[`${k}Enc`];
  }
  if (v.kind === "jira_sm" && !config.apiTokenEnc) throw new HelpdeskError("Add the Jira API token.", "invalid", { "config.apiToken": "Add the Jira API token." });
  if (v.kind === "webhook" && !config.secretEnc) throw new HelpdeskError("Add a signing secret.", "invalid", { "config.secret": "Add a signing secret." });
  const values = { kind: v.kind, name: v.name, enabled: v.enabled, requestTypeIds: v.requestTypeIds, config };
  const [row] = v.id
    ? await db.update(s.connectors).set(values).where(eq(s.connectors.id, v.id)).returning()
    : await db.insert(s.connectors).values(values).returning();
  await audit(ctx.user.id, v.id ? "helpdesk.connector_updated" : "helpdesk.connector_created", { type: "connector", id: row!.id }, {
    kind: v.kind,
    name: v.name,
    enabled: v.enabled,
    requestTypeIds: v.requestTypeIds,
    secretsChanged: secretKeys.filter((k) => typeof raw[k] === "string" && (raw[k] as string).trim()),
  });
  return row!;
}

export async function deleteConnector(ctx: UserContext, id: string) {
  requireAdminCtx(ctx);
  const [row] = await db.delete(s.connectors).where(eq(s.connectors.id, id)).returning();
  if (!row) throw new HelpdeskError("That connector doesn't exist.", "not_found");
  await audit(ctx.user.id, "helpdesk.connector_deleted", { type: "connector", id }, { name: row.name, kind: row.kind });
}

// ---------------------------------------------------------------------------------------------
// Starter catalog

/**
 * Installs the starter catalog for a brand-new company: four teams, an office-hours calendar
 * from the org settings, two SLA policies and fifteen request types. Idempotent: anything
 * that already exists (by slug or name) is left alone, so it never overwrites admin edits.
 */
export async function installStarterCatalog(): Promise<{ teams: number; requestTypes: number; policies: number; calendars: number }> {
  const created = { teams: 0, requestTypes: 0, policies: 0, calendars: 0 };
  const org = await getOrgSettings();

  let calendar = await db.query.businessCalendars.findFirst({ orderBy: asc(s.businessCalendars.name) });
  if (!calendar) {
    [calendar] = await db
      .insert(s.businessCalendars)
      .values({ name: "Office hours", timezone: org.timezone || "UTC", workDays: org.workingDays?.length ? org.workingDays : [1, 2, 3, 4, 5], startMinute: 9 * 60, endMinute: 17 * 60 + 30, holidays: [] })
      .returning();
    created.calendars++;
  }

  const policyIds: Record<keyof typeof STARTER_SLA_POLICIES, string> = { standard: "", people: "" };
  for (const [key, p] of Object.entries(STARTER_SLA_POLICIES) as [keyof typeof STARTER_SLA_POLICIES, (typeof STARTER_SLA_POLICIES)[keyof typeof STARTER_SLA_POLICIES]][]) {
    const found = await db.query.slaPolicies.findFirst({ where: eq(s.slaPolicies.name, p.name) });
    if (found) policyIds[key] = found.id;
    else {
      const [row] = await db.insert(s.slaPolicies).values({ name: p.name, targets: p.targets }).returning();
      policyIds[key] = row!.id;
      created.policies++;
    }
  }

  const groups = await db.select({ id: s.groups.id, name: s.groups.name }).from(s.groups);
  const groupId = (n?: string) => (n ? groups.find((g) => g.name === n)?.id : undefined);
  const teamIds = new Map<string, { id: string; agentGroupId: string | null }>();
  for (const t of STARTER_TEAMS) {
    const found = await db.query.teams.findFirst({ where: eq(s.teams.slug, t.slug) });
    if (found) {
      teamIds.set(t.slug, { id: found.id, agentGroupId: found.agentGroupId });
      continue;
    }
    const [row] = await db
      .insert(s.teams)
      .values({ slug: t.slug, name: t.name, description: t.description, icon: t.icon, agentGroupId: groupId(t.agentGroup) ?? null, calendarId: calendar!.id, sortOrder: t.sortOrder })
      .returning();
    teamIds.set(t.slug, { id: row!.id, agentGroupId: row!.agentGroupId });
    created.teams++;
  }

  for (const [i, rt] of STARTER_REQUEST_TYPES.entries()) {
    const found = await db.query.requestTypes.findFirst({ where: eq(s.requestTypes.slug, rt.slug), columns: { id: true } });
    if (found) continue;
    const team = teamIds.get(rt.team)!;
    const approvalGroup = groupId(rt.approval.group) ?? team.agentGroupId ?? undefined;
    let approval: { mode: typeof rt.approval.mode; groupId?: string } = { mode: rt.approval.mode };
    if (rt.approval.mode === "group" || rt.approval.mode === "manager_then_group") {
      // With no group to approve, keep the manager step rather than silently dropping approval.
      approval = approvalGroup ? { mode: rt.approval.mode, groupId: approvalGroup } : { mode: "manager" };
    }
    await db.insert(s.requestTypes).values({
      slug: rt.slug,
      teamId: team.id,
      name: rt.name,
      description: rt.description,
      icon: rt.icon,
      fields: rt.fields,
      approval,
      slaPolicyId: policyIds[rt.sla],
      defaultPriority: rt.defaultPriority,
      sortOrder: i,
    });
    created.requestTypes++;
  }
  await reindexRequestTypes();
  await audit(null, "helpdesk.starter_catalog_installed", undefined, created);
  return created;
}
