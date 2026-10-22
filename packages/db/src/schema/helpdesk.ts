import { boolean, index, integer, jsonb, pgTable, primaryKey, serial, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, groups, ts, updatedAt, users } from "./core";

export const businessCalendars = pgTable("business_calendars", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  timezone: text().notNull().default("UTC"),
  /** ISO weekdays, 1 = Monday. */
  workDays: integer().array().notNull().default([1, 2, 3, 4, 5]),
  startMinute: integer().notNull().default(9 * 60),
  endMinute: integer().notNull().default(17 * 60 + 30),
  holidays: text().array().notNull().default([]),
});

export const teams = pgTable("teams", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text(),
  icon: text(),
  /** Members of this group work the team's queue. */
  agentGroupId: uuid().references(() => groups.id, { onDelete: "set null" }),
  calendarId: uuid().references(() => businessCalendars.id, { onDelete: "set null" }),
  roundRobin: boolean().notNull().default(false),
  sortOrder: integer().notNull().default(0),
});

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const slaPolicies = pgTable("sla_policies", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  /** Business minutes per priority. */
  targets: jsonb().$type<Record<Priority, { firstResponse: number; resolution: number }>>().notNull(),
});

export interface FormField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "checkbox" | "user" | "app" | "number";
  required?: boolean;
  options?: string[];
  help?: string;
  /** Show only when another field equals a value. */
  showIf?: { key: string; equals: string | boolean };
}

export interface ApprovalRule {
  mode: "none" | "manager" | "group" | "manager_then_group";
  groupId?: string;
}

export const requestTypes = pgTable("request_types", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  teamId: uuid().notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  icon: text(),
  fields: jsonb().$type<FormField[]>().notNull().default([]),
  approval: jsonb().$type<ApprovalRule>().notNull().default({ mode: "none" }),
  slaPolicyId: uuid().references(() => slaPolicies.id, { onDelete: "set null" }),
  defaultPriority: text({ enum: PRIORITIES }).notNull().default("normal"),
  active: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
});

export const TICKET_STATUSES = [
  "new", "open", "pending_approval", "waiting_on_requester", "resolved", "closed", "rejected",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const tickets = pgTable(
  "tickets",
  {
    id: uuid().primaryKey().defaultRandom(),
    number: serial().notNull().unique(),
    requestTypeId: uuid().references(() => requestTypes.id, { onDelete: "set null" }),
    teamId: uuid().notNull().references(() => teams.id),
    requesterId: uuid().notNull().references(() => users.id),
    assigneeId: uuid().references(() => users.id, { onDelete: "set null" }),
    subject: text().notNull(),
    description: text().notNull().default(""),
    fields: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    status: text({ enum: TICKET_STATUSES }).notNull().default("new"),
    priority: text({ enum: PRIORITIES }).notNull().default("normal"),
    source: text({ enum: ["portal", "ai", "journey", "email", "access_request"] }).notNull().default("portal"),
    firstResponseDueAt: ts(),
    resolutionDueAt: ts(),
    firstRespondedAt: ts(),
    resolvedAt: ts(),
    firstResponseBreachedAt: ts(),
    resolutionBreachedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tickets_team_status_idx").on(t.teamId, t.status),
    index("tickets_requester_idx").on(t.requesterId),
    index("tickets_assignee_idx").on(t.assigneeId),
  ],
);

export const ticketEvents = pgTable(
  "ticket_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    ticketId: uuid().notNull().references(() => tickets.id, { onDelete: "cascade" }),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    kind: text({ enum: ["reply", "internal_note", "status", "assignment", "approval", "sla", "system", "connector"] }).notNull(),
    body: text(),
    data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("ticket_events_ticket_idx").on(t.ticketId, t.createdAt)],
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid().primaryKey().defaultRandom(),
    ticketId: uuid().notNull().references(() => tickets.id, { onDelete: "cascade" }),
    step: integer().notNull().default(1),
    approverId: uuid().references(() => users.id, { onDelete: "set null" }),
    groupId: uuid().references(() => groups.id, { onDelete: "set null" }),
    status: text({ enum: ["waiting", "pending", "approved", "rejected"] }).notNull().default("pending"),
    decidedById: uuid().references(() => users.id, { onDelete: "set null" }),
    decidedAt: ts(),
    comment: text(),
    /** sha256 of the one-time token embedded in the approval email link. */
    tokenHash: text(),
    createdAt: createdAt(),
  },
  (t) => [index("approvals_ticket_idx").on(t.ticketId), index("approvals_approver_idx").on(t.approverId, t.status)],
);

export const cannedReplies = pgTable("canned_replies", {
  id: uuid().primaryKey().defaultRandom(),
  teamId: uuid().references(() => teams.id, { onDelete: "cascade" }),
  title: text().notNull(),
  body: text().notNull(),
});

export const connectors = pgTable("connectors", {
  id: uuid().primaryKey().defaultRandom(),
  kind: text({ enum: ["jira_sm", "webhook"] }).notNull(),
  name: text().notNull(),
  /** Kind-specific settings; secrets inside are encrypted with LOBBY_SECRET. */
  config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  /** Empty = all request types. */
  requestTypeIds: uuid().array().notNull().default([]),
  enabled: boolean().notNull().default(true),
  createdAt: createdAt(),
});

export const connectorLinks = pgTable(
  "connector_links",
  {
    ticketId: uuid().notNull().references(() => tickets.id, { onDelete: "cascade" }),
    connectorId: uuid().notNull().references(() => connectors.id, { onDelete: "cascade" }),
    externalKey: text(),
    externalUrl: text(),
    lastStatus: text(),
    lastError: text(),
    lastSyncedAt: ts(),
  },
  (t) => [primaryKey({ columns: [t.ticketId, t.connectorId] })],
);
