/**
 * Building journey templates: listing, editing, activating, and the starter set for a new
 * company. Every mutation re-checks that the actor may manage journeys and writes an audit entry.
 */
import { z } from "zod";
import { and, asc, db, eq, inArray, isNull, ne, s, sql } from "@lobby/db";
import { JOURNEY_ASSIGNEES, JOURNEY_STEP_TYPES, type JourneyConditions, type JourneyStepConfig } from "@lobby/db/schema";
import { audit } from "../audit";
import type { UserContext } from "../identity/context";
import { getOrgSettings } from "../settings";
import { canManageJourneys, JourneyError } from "./engine";

async function assertManager(ctx: UserContext) {
  if (!(await canManageJourneys(ctx))) throw new JourneyError("Only admins and the People team can change journeys.", "forbidden");
}

export interface JourneyListItem {
  id: string;
  name: string;
  description: string | null;
  kind: "onboarding" | "offboarding";
  active: boolean;
  conditions: JourneyConditions;
  /** Every live (not archived) step on the template: "17 steps". Same as journeyLength().total. */
  stepCount: number;
  /** Live steps assigned to the new hire: "(10 for the new hire)". Same as journeyLength().forNewHire. */
  newHireStepCount: number;
  activeRuns: number;
  completedRuns: number;
  updatedAt: string;
}

export async function listJourneys(ctx: UserContext): Promise<JourneyListItem[]> {
  await assertManager(ctx);
  const rows = await db
    .select({
      journey: s.journeys,
      stepCount: sql<number>`(select count(*)::int from journey_steps js where js.journey_id = "journeys"."id" and js.archived_at is null)`,
      newHireStepCount: sql<number>`(select count(*)::int from journey_steps js where js.journey_id = "journeys"."id" and js.archived_at is null and js.assignee = 'subject')`,
      activeRuns: sql<number>`(select count(*)::int from journey_runs jr where jr.journey_id = "journeys"."id" and jr.status = 'active')`,
      completedRuns: sql<number>`(select count(*)::int from journey_runs jr where jr.journey_id = "journeys"."id" and jr.status = 'completed')`,
    })
    .from(s.journeys)
    .orderBy(asc(s.journeys.kind), asc(s.journeys.createdAt));
  return rows.map((r) => ({
    id: r.journey.id,
    name: r.journey.name,
    description: r.journey.description,
    kind: r.journey.kind,
    active: r.journey.active,
    conditions: r.journey.conditions,
    stepCount: r.stepCount,
    newHireStepCount: r.newHireStepCount,
    activeRuns: r.activeRuns,
    completedRuns: r.completedRuns,
    updatedAt: r.journey.updatedAt.toISOString(),
  }));
}

export interface EditableStep {
  id: string;
  title: string;
  description: string;
  type: (typeof JOURNEY_STEP_TYPES)[number];
  dayOffset: number;
  assignee: (typeof JOURNEY_ASSIGNEES)[number];
  assigneeUserId: string | null;
  config: JourneyStepConfig;
}

export interface EditableJourney {
  id: string | null;
  name: string;
  description: string;
  kind: "onboarding" | "offboarding";
  active: boolean;
  conditions: JourneyConditions;
  steps: EditableStep[];
  activeRuns: number;
}

export async function getJourneyForEdit(ctx: UserContext, id: string): Promise<EditableJourney | null> {
  await assertManager(ctx);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const journey = await db.query.journeys.findFirst({ where: eq(s.journeys.id, id) });
  if (!journey) return null;
  const [steps, [runs]] = await Promise.all([
    db.select().from(s.journeySteps).where(and(eq(s.journeySteps.journeyId, id), isNull(s.journeySteps.archivedAt))).orderBy(asc(s.journeySteps.position)),
    db.select({ n: sql<number>`count(*)::int` }).from(s.journeyRuns).where(and(eq(s.journeyRuns.journeyId, id), eq(s.journeyRuns.status, "active"))),
  ]);
  return {
    id: journey.id,
    name: journey.name,
    description: journey.description ?? "",
    kind: journey.kind,
    active: journey.active,
    conditions: journey.conditions,
    activeRuns: runs?.n ?? 0,
    steps: steps.map((st) => ({
      id: st.id,
      title: st.title,
      description: st.description ?? "",
      type: st.type,
      dayOffset: st.dayOffset,
      assignee: st.assignee,
      assigneeUserId: st.assigneeUserId,
      config: st.config,
    })),
  };
}

export interface BuilderOptions {
  departments: string[];
  locations: string[];
  groups: { id: string; name: string }[];
  pages: { spaceSlug: string; spaceName: string; pageSlug: string; title: string }[];
  apps: { slug: string; name: string; icon: string | null }[];
  requestTypes: { slug: string; name: string; team: string }[];
  people: { id: string; name: string; title: string | null; department: string | null; avatarUrl: string | null; startDate: string | null; endDate: string | null; managerId: string | null }[];
}

export async function builderOptions(ctx: UserContext): Promise<BuilderOptions> {
  await assertManager(ctx);
  const [people, groups, pages, apps, rts] = await Promise.all([
    db
      .select({
        id: s.users.id,
        name: s.users.displayName,
        title: s.users.title,
        department: s.users.department,
        location: s.users.location,
        avatarUrl: s.users.avatarUrl,
        startDate: s.users.startDate,
        endDate: s.users.endDate,
        managerId: s.users.managerId,
        isBreakGlass: s.users.isBreakGlass,
      })
      .from(s.users)
      .where(eq(s.users.status, "active"))
      .orderBy(asc(s.users.displayName)),
    db.select({ id: s.groups.id, name: s.groups.displayName }).from(s.groups).orderBy(asc(s.groups.displayName)),
    db
      .select({ spaceSlug: s.spaces.slug, spaceName: s.spaces.name, pageSlug: s.pages.slug, title: s.pages.title })
      .from(s.pages)
      .innerJoin(s.spaces, eq(s.spaces.id, s.pages.spaceId))
      .where(ne(s.pages.status, "archived"))
      .orderBy(asc(s.spaces.sortOrder), asc(s.spaces.name), asc(s.pages.title)),
    db.select({ slug: s.apps.slug, name: s.apps.name, icon: s.apps.icon }).from(s.apps).orderBy(asc(s.apps.name)),
    db
      .select({ slug: s.requestTypes.slug, name: s.requestTypes.name, team: s.teams.name })
      .from(s.requestTypes)
      .innerJoin(s.teams, eq(s.teams.id, s.requestTypes.teamId))
      .where(eq(s.requestTypes.active, true))
      .orderBy(asc(s.teams.sortOrder), asc(s.requestTypes.sortOrder), asc(s.requestTypes.name)),
  ]);
  const humans = people.filter((p) => !p.isBreakGlass);
  const distinct = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
  return {
    departments: distinct(humans.map((p) => p.department)),
    locations: distinct(humans.map((p) => p.location)),
    groups,
    pages,
    apps,
    requestTypes: rts,
    people: humans.map(({ isBreakGlass: _b, location: _l, ...p }) => p),
  };
}

// ---------------------------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------------------------

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);
const slug = z.string().trim().max(120);

const configSchema = z
  .object({
    spaceSlug: slug.optional(),
    pageSlug: slug.optional(),
    appSlug: slug.optional(),
    personId: uuid.optional(),
    personRole: z.enum(["manager", "buddy"]).optional(),
    requestTypeSlug: slug.optional(),
    ticketSubject: z.string().trim().max(200).optional(),
    leadDays: z.number().int().min(0).max(60).optional(),
    ticketFields: z.record(z.string().max(60), z.union([z.string().max(500), z.boolean()])).optional(),
    questions: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(60),
          label: z.string().trim().min(1).max(200),
          type: z.enum(["text", "textarea", "select"]),
          options: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
          required: z.boolean().optional(),
        }),
      )
      .max(20)
      .optional(),
    linkUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v), "Links must start with https:// or /")
      .optional(),
    linkLabel: z.string().trim().max(60).optional(),
  })
  .strip();

const stepSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Every step needs a title.").max(200),
  description: z.string().trim().max(2000).default(""),
  type: z.enum(JOURNEY_STEP_TYPES),
  dayOffset: z.number().int().min(-365).max(365),
  assignee: z.enum(JOURNEY_ASSIGNEES),
  assigneeUserId: uuid.nullable().default(null),
  config: configSchema.default({}),
});

export const journeyInputSchema = z.object({
  id: uuid.nullable().optional(),
  name: z.string().trim().min(1, "Give the journey a name.").max(120),
  description: z.string().trim().max(1000).default(""),
  kind: z.enum(["onboarding", "offboarding"]),
  active: z.boolean(),
  conditions: z.object({
    departments: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
    locations: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
    groupIds: z.array(uuid).max(50).default([]),
  }),
  steps: z.array(stepSchema).max(100),
});
export type JourneyInput = z.input<typeof journeyInputSchema>;

/** Checks each step has what its type needs. Returns a message per invalid step index. */
export function validateSteps(steps: z.output<typeof stepSchema>[]): Record<number, string> {
  const errors: Record<number, string> = {};
  steps.forEach((st, i) => {
    const c = st.config;
    if ((st.type === "read_page" || st.type === "acknowledge_page") && !(c.spaceSlug && c.pageSlug)) errors[i] = "Pick the page to read.";
    else if (st.type === "launch_app" && !c.appSlug) errors[i] = "Pick the app to open.";
    else if (st.type === "create_ticket" && !c.requestTypeSlug) errors[i] = "Pick the kind of request to raise.";
    else if (st.type === "meet_person" && !c.personId && !c.personRole) errors[i] = "Pick who they should meet.";
    else if (st.type === "form" && !(c.questions && c.questions.length)) errors[i] = "Add at least one question.";
    else if (st.assignee === "specific" && !st.assigneeUserId) errors[i] = "Pick the person this step is assigned to.";
  });
  return errors;
}

/** Keeps only the config keys a step type uses, so stale values never leak into a run. */
function pruneConfig(type: string, c: JourneyStepConfig): JourneyStepConfig {
  switch (type) {
    case "read_page":
    case "acknowledge_page":
      return { spaceSlug: c.spaceSlug, pageSlug: c.pageSlug };
    case "launch_app":
      return { appSlug: c.appSlug };
    case "meet_person":
      return c.personRole ? { personRole: c.personRole } : { personId: c.personId };
    case "create_ticket":
      return { requestTypeSlug: c.requestTypeSlug, ticketSubject: c.ticketSubject || undefined, leadDays: c.leadDays ?? 3, ticketFields: c.ticketFields };
    case "form":
      return { questions: c.questions };
    case "task":
      return c.linkUrl ? { linkUrl: c.linkUrl, linkLabel: c.linkLabel || undefined } : {};
    default:
      return {};
  }
}

export type SaveResult = { ok: true; id: string } | { ok: false; error: string; stepErrors?: Record<number, string> };

export async function saveJourney(ctx: UserContext, raw: unknown): Promise<SaveResult> {
  await assertManager(ctx);
  const parsed = journeyInputSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const stepIndex = first?.path[0] === "steps" && typeof first.path[1] === "number" ? first.path[1] : null;
    return {
      ok: false,
      error: first?.message ?? "Some details are missing.",
      ...(stepIndex !== null ? { stepErrors: { [stepIndex]: first?.message ?? "Check this step." } } : {}),
    };
  }
  const input = parsed.data;
  const stepErrors = validateSteps(input.steps);
  if (Object.keys(stepErrors).length) return { ok: false, error: "Some steps need a little more detail.", stepErrors };

  const assigneeIds = [...new Set(input.steps.map((st) => st.assigneeUserId).filter((x): x is string => !!x))];
  if (assigneeIds.length) {
    const found = await db.select({ id: s.users.id }).from(s.users).where(inArray(s.users.id, assigneeIds));
    if (found.length !== assigneeIds.length) return { ok: false, error: "One of the people picked no longer exists." };
  }

  const conditions: JourneyConditions = {
    ...(input.conditions.departments.length ? { departments: input.conditions.departments } : {}),
    ...(input.conditions.locations.length ? { locations: input.conditions.locations } : {}),
    ...(input.conditions.groupIds.length ? { groupIds: input.conditions.groupIds } : {}),
  };

  let id = input.id ?? null;
  const summary = { added: 0, updated: 0, removed: 0, archived: 0 };

  await db.transaction(async (tx) => {
    if (id) {
      const existing = await tx.query.journeys.findFirst({ where: eq(s.journeys.id, id) });
      if (!existing) throw new JourneyError("That journey no longer exists.", "not_found");
      await tx
        .update(s.journeys)
        .set({ name: input.name, description: input.description || null, kind: input.kind, active: input.active, conditions })
        .where(eq(s.journeys.id, id));
    } else {
      const [row] = await tx
        .insert(s.journeys)
        .values({ name: input.name, description: input.description || null, kind: input.kind, active: input.active, conditions })
        .returning({ id: s.journeys.id });
      id = row!.id;
    }
    const journeyId = id!;
    const current = await tx
      .select({ id: s.journeySteps.id })
      .from(s.journeySteps)
      .where(and(eq(s.journeySteps.journeyId, journeyId), isNull(s.journeySteps.archivedAt)));
    const currentIds = new Set(current.map((c) => c.id));
    const keep = new Set<string>();

    for (const [position, st] of input.steps.entries()) {
      const values = {
        position,
        title: st.title,
        description: st.description || null,
        type: st.type,
        dayOffset: st.dayOffset,
        assignee: st.assignee,
        assigneeUserId: st.assignee === "specific" || st.assignee === "it" || st.assignee === "people" ? st.assigneeUserId : null,
        config: pruneConfig(st.type, st.config),
      };
      if (st.id && currentIds.has(st.id)) {
        keep.add(st.id);
        await tx.update(s.journeySteps).set(values).where(eq(s.journeySteps.id, st.id));
        summary.updated++;
      } else {
        await tx.insert(s.journeySteps).values({ journeyId, ...values });
        summary.added++;
      }
    }

    const removed = [...currentIds].filter((x) => !keep.has(x));
    if (removed.length) {
      const used = await tx
        .selectDistinct({ stepId: s.journeyStepRuns.stepId })
        .from(s.journeyStepRuns)
        .where(inArray(s.journeyStepRuns.stepId, removed));
      const usedIds = new Set(used.map((u) => u.stepId));
      const toArchive = removed.filter((x) => usedIds.has(x));
      const toDelete = removed.filter((x) => !usedIds.has(x));
      if (toArchive.length) await tx.update(s.journeySteps).set({ archivedAt: new Date() }).where(inArray(s.journeySteps.id, toArchive));
      if (toDelete.length) await tx.delete(s.journeySteps).where(inArray(s.journeySteps.id, toDelete));
      summary.archived = toArchive.length;
      summary.removed = toDelete.length;
    }
  });

  await audit(ctx.user.id, input.id ? "journeys.updated" : "journeys.created", { type: "journey", id: id! }, {
    name: input.name,
    kind: input.kind,
    active: input.active,
    conditions,
    steps: input.steps.length,
    ...summary,
  });
  return { ok: true, id: id! };
}

export async function setJourneyActive(ctx: UserContext, id: string, active: boolean) {
  await assertManager(ctx);
  const updated = await db.update(s.journeys).set({ active }).where(eq(s.journeys.id, id)).returning({ name: s.journeys.name });
  if (!updated.length) throw new JourneyError("That journey no longer exists.", "not_found");
  await audit(ctx.user.id, active ? "journeys.activated" : "journeys.deactivated", { type: "journey", id }, { name: updated[0]!.name });
}

/** Deletes a template that has never been run. Templates with history are deactivated instead. */
export async function deleteJourney(ctx: UserContext, id: string) {
  await assertManager(ctx);
  const [runs] = await db.select({ n: sql<number>`count(*)::int` }).from(s.journeyRuns).where(eq(s.journeyRuns.journeyId, id));
  if ((runs?.n ?? 0) > 0) throw new JourneyError("People have already been through this journey. Turn it off instead, so their history stays.", "conflict");
  const deleted = await db.delete(s.journeys).where(eq(s.journeys.id, id)).returning({ name: s.journeys.name });
  if (deleted.length) await audit(ctx.user.id, "journeys.deleted", { type: "journey", id }, { name: deleted[0]!.name });
}

// ---------------------------------------------------------------------------------------------
// Starter templates
// ---------------------------------------------------------------------------------------------

type StarterStep = Omit<EditableStep, "id" | "description" | "assigneeUserId"> & { description?: string };

function starterTemplates(company: string): { name: string; description: string; kind: "onboarding" | "offboarding"; steps: StarterStep[] }[] {
  return [
    {
      name: `Welcome to ${company}`,
      description: "The first month for every new starter: equipment, essentials, people and check-ins.",
      kind: "onboarding",
      steps: [
        { title: "Laptop and accounts for {firstName}", type: "create_ticket", dayOffset: -5, assignee: "it", config: { requestTypeSlug: "onboarding-equipment", leadDays: 5 }, description: "Order the laptop and create the core accounts before day 1." },
        { title: "Plan the first week", type: "task", dayOffset: -3, assignee: "manager", config: {}, description: "Block time for intros, a first small task and a team lunch." },
        { title: "Read the employee handbook", type: "read_page", dayOffset: 0, assignee: "subject", config: { spaceSlug: "people", pageSlug: "employee-handbook" } },
        { title: "Acknowledge the code of conduct", type: "acknowledge_page", dayOffset: 0, assignee: "subject", config: { spaceSlug: "people", pageSlug: "code-of-conduct" } },
        { title: "Meet your manager", type: "meet_person", dayOffset: 0, assignee: "subject", config: { personRole: "manager" } },
        { title: "Say hello to your new teammate", type: "task", dayOffset: 0, assignee: "buddy", config: {} },
        { title: "First 1:1", type: "task", dayOffset: 7, assignee: "manager", config: {} },
        { title: "30-day check-in", type: "form", dayOffset: 29, assignee: "subject", config: { questions: [{ key: "going-well", label: "What is going well?", type: "textarea", required: true }, { key: "unclear", label: "What is still unclear?", type: "textarea" }] } },
      ],
    },
    {
      name: "Offboarding",
      description: "A smooth last few weeks: handover, equipment and access.",
      kind: "offboarding",
      steps: [
        { title: "Write a handover note", type: "task", dayOffset: -10, assignee: "subject", config: {} },
        { title: "Exit conversation", type: "task", dayOffset: -5, assignee: "people", config: {} },
        { title: "Return equipment", type: "create_ticket", dayOffset: 0, assignee: "it", config: { requestTypeSlug: "offboarding-return", leadDays: 7 } },
        { title: "Remove access to every app", type: "task", dayOffset: 0, assignee: "it", config: {} },
      ],
    },
  ];
}

/**
 * Installs a small, generic starter set for a brand-new company. Idempotent: a template whose
 * name already exists is left alone. Returns the names it created.
 */
export async function installStarterJourneys(): Promise<string[]> {
  const org = await getOrgSettings();
  const company = org.companyName && org.companyName !== "Your company" ? org.companyName : "the team";
  const created: string[] = [];
  for (const t of starterTemplates(company)) {
    const exists = await db.query.journeys.findFirst({ where: eq(s.journeys.name, t.name) });
    if (exists) continue;
    await db.transaction(async (tx) => {
      const [j] = await tx.insert(s.journeys).values({ name: t.name, description: t.description, kind: t.kind, conditions: {} }).returning({ id: s.journeys.id });
      await tx.insert(s.journeySteps).values(
        t.steps.map((st, position) => ({
          journeyId: j!.id,
          position,
          title: st.title,
          description: st.description ?? null,
          type: st.type,
          dayOffset: st.dayOffset,
          assignee: st.assignee,
          config: st.config,
        })),
      );
    });
    created.push(t.name);
  }
  if (created.length) await audit(null, "journeys.starter_installed", undefined, { created });
  return created;
}
