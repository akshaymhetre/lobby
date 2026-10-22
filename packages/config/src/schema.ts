import { z } from "zod";

/**
 * The configuration file. Every item is matched by a natural key (slug or name), never by a
 * database id, so a file exported from one Lobby can be applied to another.
 * Secrets (identity client secret, AI keys, SCIM tokens) are never exported.
 */

const groupNames = z.array(z.string().min(1)).default([]);
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a 6-digit hex colour such as #2A5FE6");
const hhmm = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, "Use 24-hour time such as 09:00 (24:00 means midnight at the end of the day)");

export const orgSection = z.object({
  companyName: z.string().min(1),
  productName: z.string().min(1).default("Lobby"),
  accentColor: hex,
  timezone: z.string().min(1).default("UTC"),
  workingDays: z.array(z.number().int().min(1).max(7)).min(1).default([1, 2, 3, 4, 5]),
  emailDomain: z.string().nullable().default(null),
  logoUrl: z.string().nullable().default(null),
});

export const roleMappingItem = z.object({
  group: z.string().min(1),
  role: z.enum(["admin", "agent", "content-editor"]),
});

export const groupItem = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
});

export const appItem = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Slugs use lowercase letters, numbers and dashes"),
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  category: z.string().default("General"),
  icon: z.string().nullable().default(null),
  color: z.string().nullable().default(null),
  launchUrl: z.string().url(),
  launchType: z.enum(["sso_link", "idp_initiated", "bookmark"]).default("sso_link"),
  presetKey: z.string().nullable().default(null),
  owner: z.string().nullable().default(null),
  requestAccessEnabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  visibleTo: groupNames,
});

export const spaceItem = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
  editors: groupNames,
  visibleTo: groupNames,
});

export const calendarItem = z.object({
  name: z.string().min(1),
  timezone: z.string().default("UTC"),
  workDays: z.array(z.number().int().min(1).max(7)).default([1, 2, 3, 4, 5]),
  start: hhmm.default("09:00"),
  end: hhmm.default("17:30"),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
});

const target = z.object({ firstResponse: z.number().int().min(1), resolution: z.number().int().min(1) });
export const slaItem = z.object({
  name: z.string().min(1),
  targets: z.object({ low: target, normal: target, high: target, urgent: target }),
});

export const teamItem = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
  agentGroup: z.string().nullable().default(null),
  calendar: z.string().nullable().default(null),
  roundRobin: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

const formField = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "select", "date", "checkbox", "user", "app", "number"]),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  help: z.string().optional(),
  showIf: z.object({ key: z.string(), equals: z.union([z.string(), z.boolean()]) }).optional(),
});

export const requestTypeItem = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  team: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
  fields: z.array(formField).default([]),
  approval: z
    .object({ mode: z.enum(["none", "manager", "group", "manager_then_group"]), group: z.string().optional() })
    .default({ mode: "none" }),
  slaPolicy: z.string().nullable().default(null),
  defaultPriority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const journeyStepItem = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  type: z.enum(["task", "read_page", "acknowledge_page", "launch_app", "meet_person", "create_ticket", "form"]).default("task"),
  dayOffset: z.number().int().default(0),
  assignee: z.enum(["subject", "manager", "buddy", "it", "people", "specific"]).default("subject"),
  /** Email of the assignee when assignee is "specific". */
  assigneeEmail: z.string().nullable().default(null),
  /** References are written by natural key: page "space/page", app slug, requestType slug, person email. */
  config: z.record(z.string(), z.unknown()).default({}),
});

export const journeyItem = z.object({
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  kind: z.enum(["onboarding", "offboarding"]).default("onboarding"),
  active: z.boolean().default(true),
  conditions: z
    .object({
      departments: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
    })
    .default({}),
  steps: z.array(journeyStepItem).default([]),
});

export const configDoc = z.object({
  version: z.literal(1).default(1),
  org: orgSection.optional(),
  roleMappings: z.array(roleMappingItem).optional(),
  groups: z.array(groupItem).optional(),
  apps: z.array(appItem).optional(),
  knowledgeSpaces: z.array(spaceItem).optional(),
  helpdesk: z
    .object({
      calendars: z.array(calendarItem).optional(),
      slaPolicies: z.array(slaItem).optional(),
      teams: z.array(teamItem).optional(),
      requestTypes: z.array(requestTypeItem).optional(),
    })
    .optional(),
  journeys: z.array(journeyItem).optional(),
});

export type ConfigDoc = z.output<typeof configDoc>;
export type AppItem = z.output<typeof appItem>;
export type SpaceItem = z.output<typeof spaceItem>;
export type CalendarItem = z.output<typeof calendarItem>;
export type SlaItem = z.output<typeof slaItem>;
export type TeamItem = z.output<typeof teamItem>;
export type RequestTypeItem = z.output<typeof requestTypeItem>;
export type JourneyItem = z.output<typeof journeyItem>;
export type GroupItem = z.output<typeof groupItem>;
export type RoleMappingItem = z.output<typeof roleMappingItem>;
export type OrgSection = z.output<typeof orgSection>;
