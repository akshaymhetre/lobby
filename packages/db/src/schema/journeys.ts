import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, ts, updatedAt, users } from "./core";

export interface JourneyConditions {
  departments?: string[];
  locations?: string[];
  groupIds?: string[];
}

export const journeys = pgTable("journeys", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  description: text(),
  kind: text({ enum: ["onboarding", "offboarding"] }).notNull().default("onboarding"),
  /** Started automatically for users whose start (or end) date is set and who match these. */
  conditions: jsonb().$type<JourneyConditions>().notNull().default({}),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const JOURNEY_STEP_TYPES = [
  "task", "read_page", "acknowledge_page", "launch_app", "meet_person", "create_ticket", "form",
] as const;
export type JourneyStepType = (typeof JOURNEY_STEP_TYPES)[number];
export const JOURNEY_ASSIGNEES = ["subject", "manager", "buddy", "it", "people", "specific"] as const;
export type JourneyAssignee = (typeof JOURNEY_ASSIGNEES)[number];

/** One question in a `form` step. Answers are stored on the step run. */
export interface JourneyFormQuestion {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  required?: boolean;
}

/**
 * Type-specific step configuration. Knowledge pages, apps and request types are referenced by
 * slug so a template survives those modules being re-seeded or reinstalled.
 */
export interface JourneyStepConfig {
  /** read_page / acknowledge_page */
  spaceSlug?: string;
  pageSlug?: string;
  /** launch_app */
  appSlug?: string;
  /** meet_person: a fixed person, or a role resolved per run. */
  personId?: string;
  personRole?: "manager" | "buddy";
  /** create_ticket */
  requestTypeSlug?: string;
  ticketSubject?: string;
  /** Days before the due date the ticket is raised. */
  leadDays?: number;
  /**
   * Values for the request type's form fields. Fields left out are filled in automatically:
   * person fields with the person, date fields with their start (or last) day, text with the step.
   */
  ticketFields?: Record<string, string | boolean>;
  /** form */
  questions?: JourneyFormQuestion[];
  /** task: optional link */
  linkUrl?: string;
  linkLabel?: string;
}

export const journeySteps = pgTable(
  "journey_steps",
  {
    id: uuid().primaryKey().defaultRandom(),
    journeyId: uuid().notNull().references(() => journeys.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    title: text().notNull(),
    description: text(),
    type: text({ enum: JOURNEY_STEP_TYPES }).notNull().default("task"),
    /** Days relative to the anchor date (start date for onboarding, end date for offboarding). */
    dayOffset: integer().notNull().default(0),
    assignee: text({ enum: JOURNEY_ASSIGNEES }).notNull().default("subject"),
    assigneeUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    config: jsonb().$type<JourneyStepConfig>().notNull().default({}),
    /**
     * Set when a step is removed from a template that already has runs: existing runs keep
     * their history, new runs and the builder skip it.
     */
    archivedAt: ts(),
  },
  (t) => [index("journey_steps_journey_idx").on(t.journeyId, t.position)],
);

export const journeyRuns = pgTable(
  "journey_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    journeyId: uuid().notNull().references(() => journeys.id, { onDelete: "cascade" }),
    subjectUserId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
    buddyUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    anchorDate: date({ mode: "string" }).notNull(),
    status: text({ enum: ["active", "completed", "cancelled"] }).notNull().default("active"),
    /** Null when the worker started it automatically. */
    startedById: uuid().references(() => users.id, { onDelete: "set null" }),
    startedAt: createdAt(),
    completedAt: ts(),
  },
  (t) => [
    index("journey_runs_subject_idx").on(t.subjectUserId),
    // A person never runs the same journey twice (a cancelled run may be restarted).
    uniqueIndex("journey_runs_once_idx").on(t.journeyId, t.subjectUserId).where(sql`status <> 'cancelled'`),
  ],
);

export const journeyStepRuns = pgTable(
  "journey_step_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    runId: uuid().notNull().references(() => journeyRuns.id, { onDelete: "cascade" }),
    stepId: uuid().notNull().references(() => journeySteps.id, { onDelete: "cascade" }),
    assigneeId: uuid().references(() => users.id, { onDelete: "set null" }),
    /** "it" or "people" when the step sits in that team's queue rather than with one person. */
    assigneeTeam: text({ enum: ["it", "people"] }),
    dueDate: date({ mode: "string" }).notNull(),
    status: text({ enum: ["pending", "done", "skipped"] }).notNull().default("pending"),
    completedAt: ts(),
    completedById: uuid().references(() => users.id, { onDelete: "set null" }),
    ticketId: uuid(),
    /** Answers to a form step, keyed by question key. */
    formAnswers: jsonb().$type<Record<string, string>>(),
    /** Reason given when a step is skipped. */
    note: text(),
    dueNotifiedAt: ts(),
    overdueNotifiedAt: ts(),
  },
  (t) => [
    index("journey_step_runs_assignee_idx").on(t.assigneeId, t.status),
    index("journey_step_runs_run_idx").on(t.runId),
    uniqueIndex("journey_step_runs_once_idx").on(t.runId, t.stepId),
  ],
);
