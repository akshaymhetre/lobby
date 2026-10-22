/**
 * Read models for the journeys screens. Each loader re-checks who may see what, so pages can
 * stay thin. Knowledge pages, apps and request types are resolved by slug in bulk.
 */
import { and, asc, db, desc, eq, gte, inArray, isNull, ne, or, s, sql } from "@lobby/db";
import type { JourneyFormQuestion, JourneyStepConfig } from "@lobby/db/schema";
import type { UserContext } from "../identity/context";
import { addDays, journeyDayLabel, phaseFor, type JourneyKind, type Phase } from "./dates";
import { canManageJourneys, journeyClock, stepAction, teamsOf, type Team } from "./engine";
import { ASSIGNEE_LABELS, OFFBOARDING_ASSIGNEE_LABELS, canActOnStep, personalise, type AssigneeKind } from "./rules";
import { addTallies, pctOf, tallyNewHireSteps, tallyRunSteps, type StepTally } from "./progress";

export interface PersonLite {
  id: string;
  name: string;
  firstName: string;
  title: string | null;
  avatarUrl: string | null;
}

export type StepTarget =
  | { kind: "page"; title: string; href: string; space: string; found: boolean }
  | { kind: "app"; name: string; href: string; icon: string | null; color: string | null; found: boolean }
  | { kind: "person"; person: PersonLite | null; role: "manager" | "buddy" | null; href: string | null }
  | { kind: "ticket"; requestTypeName: string; ticket: { id: string; number: number; status: string } | null; leadDays: number }
  | { kind: "form"; questions: JourneyFormQuestion[]; answers: Record<string, string> | null }
  | { kind: "link"; href: string; label: string }
  | null;

export interface TimelineStep {
  id: string;
  runId: string;
  position: number;
  title: string;
  description: string | null;
  type: string;
  dayOffset: number;
  phase: Phase;
  dueDate: string;
  status: "pending" | "done" | "skipped";
  completedAt: string | null;
  completedBy: string | null;
  note: string | null;
  overdue: boolean;
  dueToday: boolean;
  assignee: {
    kind: AssigneeKind;
    label: string;
    person: PersonLite | null;
    team: Team | null;
    awaitingBuddy: boolean;
  };
  /** Assigned to the person the journey is for. */
  forSubject: boolean;
  /** Assigned to the viewer. */
  mine: boolean;
  canAct: boolean;
  canSkip: boolean;
  target: StepTarget;
  action: { href: string; label: string };
}

export interface RunView {
  run: { id: string; status: string; anchorDate: string; startedAt: string; completedAt: string | null };
  journey: { id: string; name: string; description: string | null; kind: JourneyKind };
  subject: PersonLite & { department: string | null; location: string | null; startDate: string | null; endDate: string | null };
  manager: PersonLite | null;
  buddy: PersonLite | null;
  steps: TimelineStep[];
  /**
   * `done`/`total`/`pct` count EVERY step on the run (run progress, "across everyone").
   * `newHire` counts only the new hire's own steps: the canonical "their progress" number.
   */
  progress: { done: number; total: number; pct: number; overdue: number; newHire: StepTally };
  today: string;
  dayLabel: string;
  hasBuddySteps: boolean;
  viewer: { isSubject: boolean; isManager: boolean; canAssignBuddy: boolean; canManage: boolean };
}

function lite(u: { id: string; displayName: string; firstName: string; title: string | null; avatarUrl: string | null }): PersonLite {
  return { id: u.id, name: u.displayName, firstName: u.firstName || u.displayName.split(" ")[0] || u.displayName, title: u.title, avatarUrl: u.avatarUrl };
}

const userCols = {
  id: s.users.id,
  displayName: s.users.displayName,
  firstName: s.users.firstName,
  title: s.users.title,
  avatarUrl: s.users.avatarUrl,
};

async function peopleById(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x && /^[0-9a-f-]{36}$/i.test(x)))];
  if (!unique.length) return new Map<string, PersonLite>();
  const rows = await db.select(userCols).from(s.users).where(inArray(s.users.id, unique));
  return new Map(rows.map((r) => [r.id, lite(r)]));
}

/** Resolves page, app and request-type slugs used by a set of step configs. */
export async function resolveRefs(configs: JourneyStepConfig[]) {
  const pageKeys = [...new Set(configs.filter((c) => c.spaceSlug && c.pageSlug).map((c) => `${c.spaceSlug}/${c.pageSlug}`))];
  const appSlugs = [...new Set(configs.map((c) => c.appSlug).filter((x): x is string => !!x))];
  const rtSlugs = [...new Set(configs.map((c) => c.requestTypeSlug).filter((x): x is string => !!x))];
  const [pages, apps, rts] = await Promise.all([
    pageKeys.length
      ? db
          .select({ space: s.spaces.slug, spaceName: s.spaces.name, slug: s.pages.slug, title: s.pages.title })
          .from(s.pages)
          .innerJoin(s.spaces, eq(s.spaces.id, s.pages.spaceId))
          .where(and(inArray(s.spaces.slug, [...new Set(pageKeys.map((k) => k.split("/")[0]!))]), ne(s.pages.status, "archived")))
      : Promise.resolve([]),
    appSlugs.length
      ? db.select({ slug: s.apps.slug, name: s.apps.name, icon: s.apps.icon, color: s.apps.color }).from(s.apps).where(inArray(s.apps.slug, appSlugs))
      : Promise.resolve([]),
    rtSlugs.length
      ? db.select({ slug: s.requestTypes.slug, name: s.requestTypes.name }).from(s.requestTypes).where(inArray(s.requestTypes.slug, rtSlugs))
      : Promise.resolve([]),
  ]);
  return {
    page: new Map(pages.map((p) => [`${p.space}/${p.slug}`, p])),
    app: new Map(apps.map((a) => [a.slug, a])),
    requestType: new Map(rts.map((r) => [r.slug, r])),
  };
}

const prettySlug = (slug: string) => slug.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function targetFor(
  type: string,
  cfg: JourneyStepConfig,
  refs: Awaited<ReturnType<typeof resolveRefs>>,
  people: Map<string, PersonLite>,
  run: { managerId: string | null; buddyId: string | null },
  stepRun: { ticketId: string | null; formAnswers: Record<string, string> | null },
  tickets: Map<string, { id: string; number: number; status: string }>,
): StepTarget {
  switch (type) {
    case "read_page":
    case "acknowledge_page": {
      if (!cfg.spaceSlug || !cfg.pageSlug) return null;
      const p = refs.page.get(`${cfg.spaceSlug}/${cfg.pageSlug}`);
      return {
        kind: "page",
        title: p?.title ?? prettySlug(cfg.pageSlug),
        space: p?.spaceName ?? prettySlug(cfg.spaceSlug),
        href: `/knowledge/${cfg.spaceSlug}/${cfg.pageSlug}`,
        found: !!p,
      };
    }
    case "launch_app": {
      if (!cfg.appSlug) return null;
      const a = refs.app.get(cfg.appSlug);
      return { kind: "app", name: a?.name ?? prettySlug(cfg.appSlug), icon: a?.icon ?? null, color: a?.color ?? null, href: `/apps/launch/${cfg.appSlug}`, found: !!a };
    }
    case "meet_person": {
      const id = cfg.personRole === "manager" ? run.managerId : cfg.personRole === "buddy" ? run.buddyId : cfg.personId;
      const person = id ? (people.get(id) ?? null) : null;
      return { kind: "person", person, role: cfg.personRole ?? null, href: person ? `/people/${person.id}` : null };
    }
    case "create_ticket": {
      const rt = cfg.requestTypeSlug ? refs.requestType.get(cfg.requestTypeSlug) : undefined;
      return {
        kind: "ticket",
        requestTypeName: rt?.name ?? (cfg.requestTypeSlug ? prettySlug(cfg.requestTypeSlug) : "Help request"),
        ticket: stepRun.ticketId ? (tickets.get(stepRun.ticketId) ?? null) : null,
        leadDays: Number(cfg.leadDays ?? 3),
      };
    }
    case "form":
      return { kind: "form", questions: cfg.questions ?? [], answers: stepRun.formAnswers };
    case "task":
      return cfg.linkUrl ? { kind: "link", href: cfg.linkUrl, label: cfg.linkLabel || "Open link" } : null;
    default:
      return null;
  }
}

/** Builds full timeline views for runs. Callers must have checked the viewer may see them. */
async function buildRunViews(ctx: UserContext, runIds: string[]): Promise<RunView[]> {
  if (!runIds.length) return [];
  const [clock, teams, manage] = await Promise.all([journeyClock(), teamsOf(ctx), canManageJourneys(ctx)]);
  const runs = await db
    .select({ run: s.journeyRuns, journey: s.journeys, subject: s.users })
    .from(s.journeyRuns)
    .innerJoin(s.journeys, eq(s.journeys.id, s.journeyRuns.journeyId))
    .innerJoin(s.users, eq(s.users.id, s.journeyRuns.subjectUserId))
    .where(inArray(s.journeyRuns.id, runIds));
  const stepRows = await db
    .select({ stepRun: s.journeyStepRuns, step: s.journeySteps })
    .from(s.journeyStepRuns)
    .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
    .where(inArray(s.journeyStepRuns.runId, runIds))
    .orderBy(asc(s.journeyStepRuns.dueDate), asc(s.journeySteps.position));

  const configs = stepRows.map((r) => r.step.config as JourneyStepConfig);
  const ticketIds = stepRows.map((r) => r.stepRun.ticketId).filter((x): x is string => !!x);
  const [refs, people, tickets] = await Promise.all([
    resolveRefs(configs),
    peopleById([
      ...runs.flatMap((r) => [r.subject.managerId, r.run.buddyUserId]),
      ...stepRows.flatMap((r) => [r.stepRun.assigneeId, r.stepRun.completedById, (r.step.config as JourneyStepConfig).personId]),
    ]),
    ticketIds.length
      ? db.select({ id: s.tickets.id, number: s.tickets.number, status: s.tickets.status }).from(s.tickets).where(inArray(s.tickets.id, ticketIds))
      : Promise.resolve([]),
  ]);
  const ticketMap = new Map(tickets.map((t) => [t.id, t]));
  const actor = { userId: ctx.user.id, isAdmin: ctx.has("admin"), teams };

  return runIds
    .map((runId) => runs.find((r) => r.run.id === runId))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map(({ run, journey, subject }) => {
      const kind = journey.kind;
      const labels = kind === "offboarding" ? OFFBOARDING_ASSIGNEE_LABELS : ASSIGNEE_LABELS;
      const isSubject = subject.id === ctx.user.id;
      const isManager = subject.managerId === ctx.user.id;
      const active = run.status === "active";
      const steps: TimelineStep[] = stepRows
        .filter((r) => r.stepRun.runId === run.id)
        .map(({ stepRun, step }) => {
          const cfg = step.config as JourneyStepConfig;
          const forSubject = step.assignee === "subject";
          const canAct =
            active &&
            canActOnStep(actor, { assigneeId: stepRun.assigneeId, assigneeTeam: stepRun.assigneeTeam, subjectManagerId: subject.managerId }) &&
            (step.type !== "acknowledge_page" || isSubject);
          const canSkip =
            active &&
            canActOnStep(actor, { assigneeId: stepRun.assigneeId, assigneeTeam: stepRun.assigneeTeam, subjectManagerId: subject.managerId }) &&
            (!isSubject || ctx.has("admin"));
          return {
            id: stepRun.id,
            runId: run.id,
            position: step.position,
            title: personalise(step.title, subject),
            description: step.description ? personalise(step.description, subject) : null,
            type: step.type,
            dayOffset: step.dayOffset,
            phase: phaseFor(step.dayOffset, kind),
            dueDate: stepRun.dueDate,
            status: stepRun.status,
            completedAt: stepRun.completedAt?.toISOString() ?? null,
            completedBy: stepRun.completedById ? (people.get(stepRun.completedById)?.name ?? null) : null,
            note: stepRun.note,
            overdue: stepRun.status === "pending" && stepRun.dueDate < clock.today,
            dueToday: stepRun.status === "pending" && stepRun.dueDate === clock.today,
            assignee: {
              kind: step.assignee,
              label: labels[step.assignee],
              person: stepRun.assigneeId ? (people.get(stepRun.assigneeId) ?? null) : null,
              team: stepRun.assigneeTeam,
              awaitingBuddy: step.assignee === "buddy" && !stepRun.assigneeId,
            },
            forSubject,
            mine: stepRun.assigneeId === ctx.user.id,
            canAct,
            canSkip,
            target: targetFor(step.type, cfg, refs, people, { managerId: subject.managerId, buddyId: run.buddyUserId }, stepRun, ticketMap),
            action: stepAction(step.type, cfg, run.id, isSubject),
          } satisfies TimelineStep;
        });
      const { done, total } = tallyRunSteps(steps);
      const newHire = tallyNewHireSteps(steps.map((st) => ({ status: st.status, assignee: st.assignee.kind })));
      return {
        run: {
          id: run.id,
          status: run.status,
          anchorDate: run.anchorDate,
          startedAt: run.startedAt.toISOString(),
          completedAt: run.completedAt?.toISOString() ?? null,
        },
        journey: { id: journey.id, name: journey.name, description: journey.description, kind },
        subject: { ...lite(subject), department: subject.department, location: subject.location, startDate: subject.startDate, endDate: subject.endDate },
        manager: subject.managerId ? (people.get(subject.managerId) ?? null) : null,
        buddy: run.buddyUserId ? (people.get(run.buddyUserId) ?? null) : null,
        steps,
        progress: { done, total, pct: pctOf({ done, total }), overdue: steps.filter((st) => st.overdue).length, newHire },
        today: clock.today,
        dayLabel: journeyDayLabel(run.anchorDate, clock.today, kind),
        hasBuddySteps: steps.some((st) => st.assignee.kind === "buddy"),
        viewer: { isSubject, isManager, canAssignBuddy: active && (isManager || manage), canManage: manage },
      };
    });
}

/** The signed-in person's own active journeys (onboarding first). */
export async function myJourneys(ctx: UserContext): Promise<RunView[]> {
  const runs = await db
    .select({ id: s.journeyRuns.id, kind: s.journeys.kind, anchor: s.journeyRuns.anchorDate })
    .from(s.journeyRuns)
    .innerJoin(s.journeys, eq(s.journeys.id, s.journeyRuns.journeyId))
    .where(and(eq(s.journeyRuns.subjectUserId, ctx.user.id), eq(s.journeyRuns.status, "active")))
    .orderBy(asc(s.journeys.kind), asc(s.journeyRuns.anchorDate));
  return buildRunViews(ctx, runs.map((r) => r.id));
}

/**
 * One run, for anyone with a reason to see it: the person, their manager, their buddy,
 * anyone with a step in it, the People team and admins. Returns null otherwise.
 */
export async function getRunView(ctx: UserContext, runId: string): Promise<RunView | null> {
  if (!(await canViewRun(ctx, runId))) return null;
  const [view] = await buildRunViews(ctx, [runId]);
  return view ?? null;
}

/**
 * Who may see a run: the person, their manager, their buddy, anyone with a step in it, the
 * People team and admins. The single rule behind getRunView and the canonical progress counts.
 */
export async function canViewRun(ctx: UserContext, runId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return false;
  const [row] = await db
    .select({ subjectId: s.journeyRuns.subjectUserId, buddyId: s.journeyRuns.buddyUserId, managerId: s.users.managerId })
    .from(s.journeyRuns)
    .innerJoin(s.users, eq(s.users.id, s.journeyRuns.subjectUserId))
    .where(eq(s.journeyRuns.id, runId));
  if (!row) return false;
  const uid = ctx.user.id;
  let allowed = row.subjectId === uid || row.managerId === uid || row.buddyId === uid || (await canManageJourneys(ctx));
  if (!allowed) {
    const teams = await teamsOf(ctx);
    const [mine] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.journeyStepRuns)
      .where(
        and(
          eq(s.journeyStepRuns.runId, runId),
          teams.length ? or(eq(s.journeyStepRuns.assigneeId, uid), inArray(s.journeyStepRuns.assigneeTeam, teams)) : eq(s.journeyStepRuns.assigneeId, uid),
        ),
      );
    allowed = (mine?.n ?? 0) > 0;
  }
  return allowed;
}

/**
 * A run plus the person's other journeys in the same state (e.g. Welcome + Engineering), for
 * viewers who may see the whole person: the subject, their manager, their buddy, People, admins.
 */
export async function getPersonRunViews(ctx: UserContext, runId: string): Promise<RunView[] | null> {
  const main = await getRunView(ctx, runId);
  if (!main) return null;
  const v = main.viewer;
  const wholePerson = v.isSubject || v.isManager || v.canManage || main.buddy?.id === ctx.user.id;
  if (!wholePerson) return [main];
  const siblings = await db
    .select({ id: s.journeyRuns.id })
    .from(s.journeyRuns)
    .where(and(eq(s.journeyRuns.subjectUserId, main.subject.id), eq(s.journeyRuns.status, main.run.status as "active"), ne(s.journeyRuns.id, runId)))
    .orderBy(asc(s.journeyRuns.startedAt));
  if (!siblings.length) return [main];
  return [main, ...(await buildRunViews(ctx, siblings.map((r) => r.id)))];
}

// ---------------------------------------------------------------------------------------------
// Tasks for everyone else
// ---------------------------------------------------------------------------------------------

export interface TaskItem {
  id: string;
  runId: string;
  title: string;
  description: string | null;
  type: string;
  dueDate: string;
  status: "pending" | "done" | "skipped";
  completedAt: string | null;
  overdue: boolean;
  dueToday: boolean;
  journeyName: string;
  kind: JourneyKind;
  subject: PersonLite;
  team: Team | null;
  target: StepTarget;
  action: { href: string; label: string };
  canSkip: boolean;
}

export interface BuddyNeeded {
  runId: string;
  subject: PersonLite;
  anchorDate: string;
  journeyName: string;
}

export interface TasksView {
  today: string;
  items: TaskItem[];
  buddyNeeded: BuddyNeeded[];
  teams: Team[];
}

/**
 * Steps the viewer owns in other people's journeys, plus the unowned steps in their team's
 * queue and any buddy still to pick for their reports. Includes the last week's completed
 * steps so a tick can be undone.
 */
export async function myTasks(ctx: UserContext): Promise<TasksView> {
  const uid = ctx.user.id;
  const [clock, teams] = await Promise.all([journeyClock(), teamsOf(ctx)]);
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const ownership = teams.length
    ? or(eq(s.journeyStepRuns.assigneeId, uid), and(isNull(s.journeyStepRuns.assigneeId), inArray(s.journeyStepRuns.assigneeTeam, teams)))
    : eq(s.journeyStepRuns.assigneeId, uid);
  const rows = await db
    .select({ stepRun: s.journeyStepRuns, step: s.journeySteps, journey: s.journeys, run: s.journeyRuns, subject: s.users })
    .from(s.journeyStepRuns)
    .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
    .innerJoin(s.journeyRuns, eq(s.journeyRuns.id, s.journeyStepRuns.runId))
    .innerJoin(s.journeys, eq(s.journeys.id, s.journeyRuns.journeyId))
    .innerJoin(s.users, eq(s.users.id, s.journeyRuns.subjectUserId))
    .where(
      and(
        ownership,
        ne(s.journeyRuns.subjectUserId, uid),
        or(
          and(eq(s.journeyStepRuns.status, "pending"), eq(s.journeyRuns.status, "active")),
          and(ne(s.journeyStepRuns.status, "pending"), gte(s.journeyStepRuns.completedAt, since), ne(s.journeyRuns.status, "cancelled")),
        ),
      ),
    )
    .orderBy(asc(s.journeyStepRuns.dueDate), asc(s.journeySteps.position))
    .limit(300);

  const configs = rows.map((r) => r.step.config as JourneyStepConfig);
  const ticketIds = rows.map((r) => r.stepRun.ticketId).filter((x): x is string => !!x);
  const [refs, people, tickets] = await Promise.all([
    resolveRefs(configs),
    peopleById(rows.flatMap((r) => [r.subject.managerId, r.run.buddyUserId, (r.step.config as JourneyStepConfig).personId])),
    ticketIds.length
      ? db.select({ id: s.tickets.id, number: s.tickets.number, status: s.tickets.status }).from(s.tickets).where(inArray(s.tickets.id, ticketIds))
      : Promise.resolve([]),
  ]);
  const ticketMap = new Map(tickets.map((t) => [t.id, t]));
  const items: TaskItem[] = rows.map(({ stepRun, step, journey, run, subject }) => {
    const cfg = step.config as JourneyStepConfig;
    return {
      id: stepRun.id,
      runId: run.id,
      title: personalise(step.title, subject),
      description: step.description ? personalise(step.description, subject) : null,
      type: step.type,
      dueDate: stepRun.dueDate,
      status: stepRun.status,
      completedAt: stepRun.completedAt?.toISOString() ?? null,
      overdue: stepRun.status === "pending" && stepRun.dueDate < clock.today,
      dueToday: stepRun.status === "pending" && stepRun.dueDate === clock.today,
      journeyName: journey.name,
      kind: journey.kind,
      subject: lite(subject),
      team: stepRun.assigneeTeam,
      target: targetFor(step.type, cfg, refs, people, { managerId: subject.managerId, buddyId: run.buddyUserId }, stepRun, ticketMap),
      action: stepAction(step.type, cfg, run.id, false),
      canSkip: run.status === "active",
    };
  });

  const buddyRows = await db
    .select({ runId: s.journeyRuns.id, anchor: s.journeyRuns.anchorDate, journeyName: s.journeys.name, subject: userCols })
    .from(s.journeyRuns)
    .innerJoin(s.journeys, eq(s.journeys.id, s.journeyRuns.journeyId))
    .innerJoin(s.users, eq(s.users.id, s.journeyRuns.subjectUserId))
    .where(
      and(
        eq(s.users.managerId, uid),
        eq(s.journeyRuns.status, "active"),
        isNull(s.journeyRuns.buddyUserId),
        sql`exists (select 1 from journey_steps js where js.journey_id = "journey_runs"."journey_id" and js.assignee = 'buddy')`,
      ),
    )
    .orderBy(asc(s.journeyRuns.anchorDate));

  return {
    today: clock.today,
    items,
    buddyNeeded: buddyRows.map((b) => ({ runId: b.runId, subject: lite(b.subject), anchorDate: b.anchor, journeyName: b.journeyName })),
    teams,
  };
}

// ---------------------------------------------------------------------------------------------
// Run overviews (manager and People team)
// ---------------------------------------------------------------------------------------------

export interface RunRow {
  runId: string;
  /** Every run folded into this row when rows are grouped per person. */
  runIds?: string[];
  status: string;
  journeyId: string;
  journeyName: string;
  kind: JourneyKind;
  anchorDate: string;
  dayLabel: string;
  subject: PersonLite & { department: string | null; location: string | null };
  manager: PersonLite | null;
  buddy: PersonLite | null;
  needsBuddy: boolean;
  /**
   * `done`/`total`/`pct` count EVERY step on the run (run progress, "across everyone").
   * `newHire` counts only the new hire's own steps: the canonical "their progress" number.
   */
  progress: { done: number; total: number; pct: number; newHire: StepTally };
  overdue: number;
  next: { title: string; dueDate: string; assigneeName: string | null } | null;
}

async function runRows(where: ReturnType<typeof and>, today: string): Promise<RunRow[]> {
  const runs = await db
    .select({ run: s.journeyRuns, journey: s.journeys, subject: s.users })
    .from(s.journeyRuns)
    .innerJoin(s.journeys, eq(s.journeys.id, s.journeyRuns.journeyId))
    .innerJoin(s.users, eq(s.users.id, s.journeyRuns.subjectUserId))
    .where(where)
    .orderBy(desc(s.journeyRuns.status), asc(s.journeyRuns.anchorDate))
    .limit(500);
  if (!runs.length) return [];
  const ids = runs.map((r) => r.run.id);
  const steps = await db
    .select({
      runId: s.journeyStepRuns.runId,
      status: s.journeyStepRuns.status,
      dueDate: s.journeyStepRuns.dueDate,
      assigneeId: s.journeyStepRuns.assigneeId,
      title: s.journeySteps.title,
      assignee: s.journeySteps.assignee,
      position: s.journeySteps.position,
    })
    .from(s.journeyStepRuns)
    .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
    .where(inArray(s.journeyStepRuns.runId, ids))
    .orderBy(asc(s.journeyStepRuns.dueDate), asc(s.journeySteps.position));
  const people = await peopleById([...runs.flatMap((r) => [r.subject.managerId, r.run.buddyUserId]), ...steps.map((st) => st.assigneeId)]);
  return runs.map(({ run, journey, subject }) => {
    const mine = steps.filter((st) => st.runId === run.id);
    const { done } = tallyRunSteps(mine);
    const pending = mine.filter((st) => st.status === "pending");
    const nextStep = pending.find((st) => st.assignee === "subject") ?? pending[0];
    const nextTitle = nextStep ? personalise(nextStep.title, subject) : "";
    return {
      runId: run.id,
      status: run.status,
      journeyId: journey.id,
      journeyName: journey.name,
      kind: journey.kind,
      anchorDate: run.anchorDate,
      dayLabel: journeyDayLabel(run.anchorDate, today, journey.kind),
      subject: { ...lite(subject), department: subject.department, location: subject.location },
      manager: subject.managerId ? (people.get(subject.managerId) ?? null) : null,
      buddy: run.buddyUserId ? (people.get(run.buddyUserId) ?? null) : null,
      needsBuddy: !run.buddyUserId && run.status === "active" && mine.some((st) => st.assignee === "buddy"),
      progress: { done, total: mine.length, pct: pctOf({ done, total: mine.length }), newHire: tallyNewHireSteps(mine) },
      overdue: pending.filter((st) => st.dueDate < today).length,
      next: nextStep ? { title: nextTitle, dueDate: nextStep.dueDate, assigneeName: nextStep.assigneeId ? (people.get(nextStep.assigneeId)?.name ?? null) : null } : null,
    };
  });
}

/** Journeys of the viewer's direct reports: active, plus those finished in the last 30 days. */
export async function teamRuns(ctx: UserContext): Promise<RunRow[]> {
  const { today } = await journeyClock();
  const recent = addDays(today, -30);
  return runRows(
    and(
      eq(s.users.managerId, ctx.user.id),
      or(eq(s.journeyRuns.status, "active"), and(eq(s.journeyRuns.status, "completed"), gte(s.journeyRuns.completedAt, new Date(`${recent}T00:00:00Z`)))),
    ),
    today,
  );
}

export interface RunFilters {
  status?: "active" | "completed" | "all";
  kind?: JourneyKind;
  journeyId?: string;
  department?: string;
  q?: string;
}

/** Every run, for the People team and admins. Returns null when the viewer may not see them. */
export async function allRuns(ctx: UserContext, filters: RunFilters = {}): Promise<RunRow[] | null> {
  if (!(await canManageJourneys(ctx))) return null;
  const { today } = await journeyClock();
  const status = filters.status ?? "active";
  const q = filters.q?.trim();
  return runRows(
    and(
      status === "all" ? ne(s.journeyRuns.status, "cancelled") : eq(s.journeyRuns.status, status),
      filters.kind ? eq(s.journeys.kind, filters.kind) : undefined,
      filters.journeyId && /^[0-9a-f-]{36}$/i.test(filters.journeyId) ? eq(s.journeyRuns.journeyId, filters.journeyId) : undefined,
      filters.department ? eq(s.users.department, filters.department) : undefined,
      q ? sql`${s.users.displayName} ilike ${`%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`}` : undefined,
    ),
    today,
  );
}


export interface Colleague {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  avatarUrl: string | null;
}

/** Active colleagues for the buddy picker (the directory is visible to every employee). */
export async function listColleagues(): Promise<Colleague[]> {
  return db
    .select({ id: s.users.id, name: s.users.displayName, title: s.users.title, department: s.users.department, avatarUrl: s.users.avatarUrl })
    .from(s.users)
    .where(and(eq(s.users.status, "active"), eq(s.users.isBreakGlass, false)))
    .orderBy(asc(s.users.displayName));
}

/**
 * Folds a person's journeys into one row (Welcome + Engineering onboarding become one line):
 * progress and overdue add up, the soonest next step wins, the earliest run is the link target.
 */
export function groupRunsByPerson(rows: RunRow[]): RunRow[] {
  const by = new Map<string, RunRow>();
  for (const r of rows) {
    const key = `${r.subject.id}:${r.status === "active" ? "active" : r.runId}`;
    const g = by.get(key);
    if (!g) {
      by.set(key, { ...r, runIds: [r.runId] });
      continue;
    }
    const { done, total } = addTallies(g.progress, r.progress);
    const newHire = addTallies(g.progress.newHire, r.progress.newHire);
    by.set(key, {
      ...g,
      runIds: [...(g.runIds ?? []), r.runId],
      journeyName: `${(g.runIds?.length ?? 1) + 1} journeys`,
      progress: { done, total, pct: pctOf({ done, total }), newHire },
      overdue: g.overdue + r.overdue,
      needsBuddy: g.needsBuddy || r.needsBuddy,
      buddy: g.buddy ?? r.buddy,
      next: !g.next ? r.next : !r.next ? g.next : r.next.dueDate < g.next.dueDate ? r.next : g.next,
    });
  }
  return [...by.values()];
}
