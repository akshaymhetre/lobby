/**
 * The journeys engine: starting runs, completing and skipping steps, buddies and run completion.
 * Every function that acts for a person takes their UserContext and re-checks access itself.
 */
import { and, asc, db, eq, gte, inArray, isNull, lte, ne, or, s, sql } from "@lobby/db";
import type { JourneyStepConfig } from "@lobby/db/schema";
import { audit } from "../audit";
import { loadUserContext, type UserContext } from "../identity/context";
import { notify } from "../notify";
import { getOrgSettings } from "../settings";
import { addDays, daysBetween, dueDateFor, todayIn, type JourneyKind } from "./dates";
import { loadKnowledge, pageIdOf } from "./deps";
import { anchorFor, canActOnStep, matchesConditions, personalise, resolveAssignee } from "./rules";

export class JourneyError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "forbidden" | "invalid" | "conflict" = "invalid",
  ) {
    super(message);
    this.name = "JourneyError";
  }
}

export type Team = "it" | "people";

/** The company's "today" and working week. */
export async function journeyClock(now: Date = new Date()) {
  const org = await getOrgSettings();
  return { today: todayIn(org.timezone, now), workingDays: org.workingDays, companyName: org.companyName };
}

/**
 * Group ids behind the IT and People queues: the helpdesk team's agent group when the helpdesk
 * module has configured one, otherwise the conventional `it-team` / `people-team` groups.
 */
export async function teamGroupIds(): Promise<Record<Team, string | null>> {
  const [teams, groups] = await Promise.all([
    db.select({ slug: s.teams.slug, groupId: s.teams.agentGroupId }).from(s.teams).where(inArray(s.teams.slug, ["it", "people"])),
    db.select({ id: s.groups.id, name: s.groups.name }).from(s.groups).where(inArray(s.groups.name, ["it-team", "people-team"])),
  ]);
  const pick = (team: Team) =>
    teams.find((t) => t.slug === team)?.groupId ?? groups.find((g) => g.name === `${team}-team`)?.id ?? null;
  return { it: pick("it"), people: pick("people") };
}

export async function teamsOf(ctx: Pick<UserContext, "groupIds">): Promise<Team[]> {
  const ids = await teamGroupIds();
  return (["it", "people"] as const).filter((t) => ids[t] && ctx.groupIds.includes(ids[t]!));
}

/** Admins and the People team build journeys and see every run. */
export async function canManageJourneys(ctx: UserContext): Promise<boolean> {
  return ctx.has("admin") || (await teamsOf(ctx)).includes("people");
}

// ---------------------------------------------------------------------------------------------
// Starting runs
// ---------------------------------------------------------------------------------------------

export interface StartOptions {
  /** Overrides the person's start (or end) date. Used by the manual "Start for a person" action. */
  anchorDate?: string;
  buddyUserId?: string | null;
  /** The person starting it by hand; null when the worker starts it. */
  startedById?: string | null;
  /** Restrict automatic picking to these kinds. */
  kinds?: JourneyKind[];
  now?: Date;
}

export interface StartResult {
  started: { runId: string; journeyId: string; name: string }[];
  skipped: { journeyId: string; name: string; reason: string }[];
}

const AUTO_START_LOOKBACK_DAYS = 30;

/**
 * Starts journeys for a person. With a journeyId, starts exactly that journey (conditions are
 * not checked: it is a deliberate choice). Without one, starts every active journey whose
 * conditions match and whose anchor date is set and recent. A journey is never started twice
 * for the same person; a unique index backs this up under concurrency.
 */
export async function startJourneyFor(userId: string, journeyId?: string, opts: StartOptions = {}): Promise<StartResult> {
  const result: StartResult = { started: [], skipped: [] };
  const user = await db.query.users.findFirst({ where: eq(s.users.id, userId) });
  if (!user || user.status !== "active") throw new JourneyError("That person is not an active employee.", "not_found");

  const memberships = await db.select({ id: s.groupMembers.groupId }).from(s.groupMembers).where(eq(s.groupMembers.userId, userId));
  const subject = {
    department: user.department,
    location: user.location,
    startDate: user.startDate,
    endDate: user.endDate,
    groupIds: memberships.map((m) => m.id),
  };
  const clock = await journeyClock(opts.now);

  const candidates = journeyId
    ? await db.select().from(s.journeys).where(eq(s.journeys.id, journeyId))
    : await db.select().from(s.journeys).where(eq(s.journeys.active, true)).orderBy(asc(s.journeys.createdAt));
  if (journeyId && candidates.length === 0) throw new JourneyError("That journey no longer exists.", "not_found");

  const existing = await db
    .select({ journeyId: s.journeyRuns.journeyId })
    .from(s.journeyRuns)
    .where(and(eq(s.journeyRuns.subjectUserId, userId), ne(s.journeyRuns.status, "cancelled")));
  const already = new Set(existing.map((r) => r.journeyId));

  for (const journey of candidates) {
    const skip = (reason: string) => result.skipped.push({ journeyId: journey.id, name: journey.name, reason });
    if (!journeyId) {
      if (opts.kinds && !opts.kinds.includes(journey.kind)) continue;
      if (!matchesConditions(subject, journey.conditions)) continue;
    }
    const anchor = opts.anchorDate ?? anchorFor(subject, journey.kind);
    if (!anchor) {
      skip(journey.kind === "offboarding" ? "No last working day is set." : "No start date is set.");
      continue;
    }
    if (!journeyId && daysBetween(anchor, clock.today) > AUTO_START_LOOKBACK_DAYS) continue;
    if (already.has(journey.id)) {
      skip("Already started for this person.");
      continue;
    }
    const runId = await materialiseRun({
      journeyId: journey.id,
      subjectUserId: userId,
      managerId: user.managerId,
      buddyUserId: opts.buddyUserId ?? null,
      anchorDate: anchor,
      startedById: opts.startedById ?? null,
      workingDays: clock.workingDays,
    });
    if (!runId) {
      skip("Already started for this person.");
      continue;
    }
    already.add(journey.id);
    result.started.push({ runId, journeyId: journey.id, name: journey.name });
    await announceRun(runId).catch((err) => console.error("[journeys] announce failed", err));
    await audit(opts.startedById ?? null, "journeys.run_started", { type: "journey_run", id: runId }, {
      journeyId: journey.id,
      subjectUserId: userId,
      anchorDate: anchor,
      automatic: !opts.startedById,
    });
  }
  return result;
}

async function materialiseRun(input: {
  journeyId: string;
  subjectUserId: string;
  managerId: string | null;
  buddyUserId: string | null;
  anchorDate: string;
  startedById: string | null;
  workingDays: number[];
}): Promise<string | null> {
  try {
    return await db.transaction(async (tx) => {
      const [run] = await tx
        .insert(s.journeyRuns)
        .values({
          journeyId: input.journeyId,
          subjectUserId: input.subjectUserId,
          buddyUserId: input.buddyUserId,
          anchorDate: input.anchorDate,
          startedById: input.startedById,
        })
        .returning({ id: s.journeyRuns.id });
      const steps = await tx
        .select()
        .from(s.journeySteps)
        .where(and(eq(s.journeySteps.journeyId, input.journeyId), isNull(s.journeySteps.archivedAt)))
        .orderBy(asc(s.journeySteps.position));
      if (steps.length) {
        await tx.insert(s.journeyStepRuns).values(
          steps.map((step) => {
            const who = resolveAssignee(step, input);
            return {
              runId: run!.id,
              stepId: step.id,
              assigneeId: who.assigneeId,
              assigneeTeam: who.assigneeTeam,
              dueDate: dueDateFor(input.anchorDate, step.dayOffset, input.workingDays),
            };
          }),
        );
      } else {
        await tx.update(s.journeyRuns).set({ status: "completed", completedAt: new Date() }).where(eq(s.journeyRuns.id, run!.id));
      }
      return run!.id;
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505" || /journey_runs_once_idx/.test(String(err))) return null;
    throw err;
  }
}

/** Tells the manager (and the new hire) that a journey has started. */
async function announceRun(runId: string) {
  const info = await runSummary(runId);
  if (!info) return;
  const { run, journey, subject } = info;
  const first = subject.firstName || subject.displayName;
  const pending = await db
    .select({ assigneeId: s.journeyStepRuns.assigneeId, assignee: s.journeySteps.assignee })
    .from(s.journeyStepRuns)
    .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
    .where(eq(s.journeyStepRuns.runId, runId));
  if (subject.managerId) {
    const mine = pending.filter((p) => p.assigneeId === subject.managerId).length;
    const needsBuddy = !run.buddyUserId && pending.some((p) => p.assignee === "buddy");
    const bits = [mine ? `${mine} ${mine === 1 ? "step is" : "steps are"} yours.` : null, needsBuddy ? `Pick a buddy for ${first}.` : null];
    await notify(subject.managerId, {
      kind: "journeys.run_started",
      title: `${subject.displayName}'s ${journey.kind === "offboarding" ? "offboarding" : "onboarding"} has started`,
      body: [journey.name, ...bits].filter(Boolean).join(". ").replace(/\.\./g, "."),
      href: `/journeys/runs/${runId}`,
    });
  }
  if (journey.kind === "onboarding") {
    await notify(subject.id, {
      kind: "journeys.run_started",
      title: "Your first weeks are planned out",
      body: `${journey.name}: see what happens before and after day 1.`,
      href: "/journeys",
    });
  }
  if (run.buddyUserId) await notifyBuddy(run.buddyUserId, subject.displayName, runId);
}

async function notifyBuddy(buddyId: string, subjectName: string, runId: string) {
  await notify(buddyId, {
    kind: "journeys.buddy_assigned",
    title: `You are ${subjectName}'s onboarding buddy`,
    body: "Be their go-to person for the small questions in the first weeks.",
    href: `/journeys/runs/${runId}`,
  });
}

async function runSummary(runId: string) {
  const run = await db.query.journeyRuns.findFirst({ where: eq(s.journeyRuns.id, runId) });
  if (!run) return null;
  const [journey, subject] = await Promise.all([
    db.query.journeys.findFirst({ where: eq(s.journeys.id, run.journeyId) }),
    db.query.users.findFirst({ where: eq(s.users.id, run.subjectUserId) }),
  ]);
  if (!journey || !subject) return null;
  return { run, journey, subject };
}

// ---------------------------------------------------------------------------------------------
// Acting on steps
// ---------------------------------------------------------------------------------------------

async function loadStepRun(stepRunId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(stepRunId)) throw new JourneyError("That step no longer exists.", "not_found");
  const [row] = await db
    .select({
      stepRun: s.journeyStepRuns,
      step: s.journeySteps,
      run: s.journeyRuns,
      subjectManagerId: s.users.managerId,
      subjectName: s.users.displayName,
      subjectFirst: s.users.firstName,
    })
    .from(s.journeyStepRuns)
    .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
    .innerJoin(s.journeyRuns, eq(s.journeyRuns.id, s.journeyStepRuns.runId))
    .innerJoin(s.users, eq(s.users.id, s.journeyRuns.subjectUserId))
    .where(eq(s.journeyStepRuns.id, stepRunId));
  if (!row) throw new JourneyError("That step no longer exists.", "not_found");
  return row;
}

async function assertCanAct(ctx: UserContext, row: Awaited<ReturnType<typeof loadStepRun>>) {
  const ok = canActOnStep(
    { userId: ctx.user.id, isAdmin: ctx.has("admin"), teams: await teamsOf(ctx) },
    { assigneeId: row.stepRun.assigneeId, assigneeTeam: row.stepRun.assigneeTeam, subjectManagerId: row.subjectManagerId },
  );
  if (!ok) throw new JourneyError("This step belongs to someone else.", "forbidden");
}

export interface CompleteOptions {
  /** Answers for a form step, keyed by question key. */
  answers?: Record<string, string>;
}

/**
 * Ticks a step off. Allowed for the assignee, the subject's manager, an admin, the People team,
 * or a member of the queue a team step sits in. Acknowledgement steps can only be completed by
 * the person themselves, and record the acknowledgement in Knowledge when it is installed.
 */
export async function completeStep(ctx: UserContext, stepRunId: string, opts: CompleteOptions = {}) {
  const row = await loadStepRun(stepRunId);
  await assertCanAct(ctx, row);
  if (row.run.status !== "active") throw new JourneyError("This journey is no longer active.", "conflict");
  if (row.stepRun.status !== "pending") return { status: row.stepRun.status };

  const cfg = row.step.config as JourneyStepConfig;
  const isSubject = ctx.user.id === row.run.subjectUserId;
  let formAnswers: Record<string, string> | undefined;

  if (row.step.type === "acknowledge_page") {
    if (!isSubject) {
      throw new JourneyError(`Only ${row.subjectFirst || row.subjectName} can acknowledge this page. You can skip the step instead.`, "forbidden");
    }
    if (cfg.spaceSlug && cfg.pageSlug) {
      const knowledge = await loadKnowledge();
      if (knowledge) {
        const pageId = pageIdOf(await knowledge.getPageBySlug(ctx, cfg.spaceSlug, cfg.pageSlug).catch(() => null));
        if (pageId) await knowledge.acknowledgePage(ctx, pageId);
      }
    }
  }

  if (row.step.type === "form") {
    const questions = cfg.questions ?? [];
    formAnswers = {};
    for (const q of questions) {
      const raw = opts.answers?.[q.key];
      const value = typeof raw === "string" ? raw.trim().slice(0, 4000) : "";
      if (q.required && !value) throw new JourneyError(`Please answer "${q.label}".`, "invalid");
      if (value && q.type === "select" && q.options?.length && !q.options.includes(value)) {
        throw new JourneyError(`Pick one of the options for "${q.label}".`, "invalid");
      }
      if (value) formAnswers[q.key] = value;
    }
  }

  const updated = await db
    .update(s.journeyStepRuns)
    .set({ status: "done", completedAt: new Date(), completedById: ctx.user.id, ...(formAnswers ? { formAnswers } : {}) })
    .where(and(eq(s.journeyStepRuns.id, stepRunId), eq(s.journeyStepRuns.status, "pending")))
    .returning({ id: s.journeyStepRuns.id });
  if (updated.length && row.stepRun.assigneeId && row.stepRun.assigneeId !== ctx.user.id && !isSubject) {
    await audit(ctx.user.id, "journeys.step_completed_for", { type: "journey_step_run", id: stepRunId }, {
      assigneeId: row.stepRun.assigneeId,
      title: row.step.title,
    });
  }
  const runCompleted = await maybeCompleteRun(row.run.id);
  return { status: "done" as const, runCompleted };
}

/** Puts a done or skipped step back to pending (the checkbox's undo). */
export async function reopenStep(ctx: UserContext, stepRunId: string) {
  const row = await loadStepRun(stepRunId);
  await assertCanAct(ctx, row);
  if (row.run.status === "cancelled") throw new JourneyError("This journey was cancelled.", "conflict");
  if (row.stepRun.status === "pending") return;
  await db
    .update(s.journeyStepRuns)
    .set({ status: "pending", completedAt: null, completedById: null, note: null })
    .where(eq(s.journeyStepRuns.id, stepRunId));
  if (row.run.status === "completed") {
    await db.update(s.journeyRuns).set({ status: "active", completedAt: null }).where(eq(s.journeyRuns.id, row.run.id));
  }
}

/**
 * Skips a step that does not apply. The person themselves cannot skip their own steps;
 * their manager, the People team or an admin can.
 */
export async function skipStep(ctx: UserContext, stepRunId: string, reason?: string) {
  const row = await loadStepRun(stepRunId);
  await assertCanAct(ctx, row);
  if (ctx.user.id === row.run.subjectUserId && !ctx.has("admin")) {
    throw new JourneyError("Ask your manager if a step does not apply to you.", "forbidden");
  }
  if (row.run.status !== "active") throw new JourneyError("This journey is no longer active.", "conflict");
  if (row.stepRun.status !== "pending") return { status: row.stepRun.status };
  await db
    .update(s.journeyStepRuns)
    .set({ status: "skipped", completedAt: new Date(), completedById: ctx.user.id, note: reason?.trim().slice(0, 500) || null })
    .where(and(eq(s.journeyStepRuns.id, stepRunId), eq(s.journeyStepRuns.status, "pending")));
  await audit(ctx.user.id, "journeys.step_skipped", { type: "journey_step_run", id: stepRunId }, {
    title: row.step.title,
    reason: reason ?? null,
  });
  const runCompleted = await maybeCompleteRun(row.run.id);
  return { status: "skipped" as const, runCompleted };
}

/** Marks a run completed once nothing is pending, and says well done. */
export async function maybeCompleteRun(runId: string): Promise<boolean> {
  const [pending] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.journeyStepRuns)
    .where(and(eq(s.journeyStepRuns.runId, runId), eq(s.journeyStepRuns.status, "pending")));
  if ((pending?.n ?? 0) > 0) return false;
  const done = await db
    .update(s.journeyRuns)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(s.journeyRuns.id, runId), eq(s.journeyRuns.status, "active")))
    .returning({ id: s.journeyRuns.id });
  if (!done.length) return false;
  const info = await runSummary(runId);
  if (info) {
    const { journey, subject } = info;
    await notify(subject.id, {
      kind: "journeys.run_completed",
      title: `You finished ${journey.name}`,
      body: journey.kind === "onboarding" ? "Every step is done. Glad you are here." : "Every step is done. Thank you, and all the best.",
      href: "/journeys",
    });
    if (subject.managerId) {
      await notify(subject.managerId, {
        kind: "journeys.run_completed",
        title: `${subject.displayName} finished ${journey.name}`,
        href: `/journeys/runs/${runId}`,
      });
    }
  }
  return true;
}

/**
 * Sets (or clears) a run's buddy and hands them any buddy steps still pending. The subject's
 * manager, the People team and admins may do this.
 */
export async function assignBuddy(ctx: UserContext, runId: string, buddyUserId: string | null) {
  const info = await runSummary(runId);
  if (!info) throw new JourneyError("That journey no longer exists.", "not_found");
  const { run, subject } = info;
  const allowed = ctx.has("admin") || subject.managerId === ctx.user.id || (await teamsOf(ctx)).includes("people");
  if (!allowed) throw new JourneyError("Only their manager or the People team can choose a buddy.", "forbidden");
  if (run.status !== "active") throw new JourneyError("This journey is no longer active.", "conflict");
  if (buddyUserId) {
    if (buddyUserId === subject.id) throw new JourneyError("Someone cannot be their own buddy.", "invalid");
    const buddy = await db.query.users.findFirst({ where: eq(s.users.id, buddyUserId) });
    if (!buddy || buddy.status !== "active") throw new JourneyError("Pick an active colleague as the buddy.", "invalid");
  }
  // A buddy is per person, so every active journey they are on gets the same one.
  const runs = await db
    .select({ id: s.journeyRuns.id, journeyId: s.journeyRuns.journeyId })
    .from(s.journeyRuns)
    .where(and(eq(s.journeyRuns.subjectUserId, subject.id), eq(s.journeyRuns.status, "active")));
  for (const r of runs) {
    await db.update(s.journeyRuns).set({ buddyUserId }).where(eq(s.journeyRuns.id, r.id));
    const buddySteps = db
      .select({ id: s.journeySteps.id })
      .from(s.journeySteps)
      .where(and(eq(s.journeySteps.journeyId, r.journeyId), eq(s.journeySteps.assignee, "buddy")));
    await db
      .update(s.journeyStepRuns)
      .set({ assigneeId: buddyUserId, dueNotifiedAt: null, overdueNotifiedAt: null })
      .where(and(eq(s.journeyStepRuns.runId, r.id), eq(s.journeyStepRuns.status, "pending"), inArray(s.journeyStepRuns.stepId, buddySteps)));
  }
  await audit(ctx.user.id, "journeys.buddy_assigned", { type: "journey_run", id: runId }, {
    subjectUserId: subject.id,
    buddyUserId,
    previous: run.buddyUserId,
    runs: runs.map((r) => r.id),
  });
  if (buddyUserId && buddyUserId !== run.buddyUserId) await notifyBuddy(buddyUserId, subject.displayName, runId);
}

/** Cancels a run (e.g. the hire fell through). People team and admins only. */
export async function cancelRun(ctx: UserContext, runId: string) {
  if (!(await canManageJourneys(ctx))) throw new JourneyError("Only the People team can cancel a journey.", "forbidden");
  const updated = await db
    .update(s.journeyRuns)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(and(eq(s.journeyRuns.id, runId), eq(s.journeyRuns.status, "active")))
    .returning({ id: s.journeyRuns.id });
  if (updated.length) await audit(ctx.user.id, "journeys.run_cancelled", { type: "journey_run", id: runId });
}

// ---------------------------------------------------------------------------------------------
// Open steps (the cross-module contract)
// ---------------------------------------------------------------------------------------------

export interface OpenStep {
  id: string;
  runId: string;
  title: string;
  description: string | null;
  type: string;
  dueDate: string;
  overdue: boolean;
  dueToday: boolean;
  journeyName: string;
  kind: JourneyKind;
  subject: { id: string; name: string; isMe: boolean };
  /** Where the step's action happens (a page, an app launch, or the journeys page). */
  href: string;
  actionLabel: string;
  /** Set for steps waiting in a team queue rather than with you personally. */
  team: Team | null;
}

export function stepAction(type: string, cfg: JourneyStepConfig, runId: string, isSubject: boolean): { href: string; label: string } {
  switch (type) {
    case "read_page":
      return cfg.spaceSlug && cfg.pageSlug ? { href: `/knowledge/${cfg.spaceSlug}/${cfg.pageSlug}`, label: "Read" } : { href: "/journeys", label: "Open" };
    case "acknowledge_page":
      return cfg.spaceSlug && cfg.pageSlug ? { href: `/knowledge/${cfg.spaceSlug}/${cfg.pageSlug}`, label: "Read and acknowledge" } : { href: "/journeys", label: "Open" };
    case "launch_app":
      return cfg.appSlug ? { href: `/apps/launch/${cfg.appSlug}`, label: "Open app" } : { href: "/journeys", label: "Open" };
    case "meet_person":
      return cfg.personId ? { href: `/people/${cfg.personId}`, label: "View profile" } : { href: isSubject ? "/journeys" : `/journeys/runs/${runId}`, label: "Open" };
    default:
      return { href: isSubject ? "/journeys" : `/journeys/runs/${runId}`, label: "Open" };
  }
}

/**
 * Pending steps for the signed-in person across active journeys, soonest first. With
 * `includeTeam`, also the unowned steps sitting in the IT or People queue they work.
 */
export async function myOpenSteps(ctx: UserContext, opts: { includeTeam?: boolean; limit?: number; now?: Date } = {}): Promise<OpenStep[]> {
  const uid = ctx.user.id;
  const teams = opts.includeTeam ? await teamsOf(ctx) : [];
  const { today } = await journeyClock(opts.now);
  const rows = await db
    .select({
      id: s.journeyStepRuns.id,
      runId: s.journeyStepRuns.runId,
      dueDate: s.journeyStepRuns.dueDate,
      team: s.journeyStepRuns.assigneeTeam,
      title: s.journeySteps.title,
      description: s.journeySteps.description,
      type: s.journeySteps.type,
      config: s.journeySteps.config,
      journeyName: s.journeys.name,
      kind: s.journeys.kind,
      subjectId: s.users.id,
      subjectName: s.users.displayName,
      subjectFirst: s.users.firstName,
    })
    .from(s.journeyStepRuns)
    .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
    .innerJoin(s.journeyRuns, eq(s.journeyRuns.id, s.journeyStepRuns.runId))
    .innerJoin(s.journeys, eq(s.journeys.id, s.journeyRuns.journeyId))
    .innerJoin(s.users, eq(s.users.id, s.journeyRuns.subjectUserId))
    .where(
      and(
        eq(s.journeyStepRuns.status, "pending"),
        eq(s.journeyRuns.status, "active"),
        teams.length
          ? or(eq(s.journeyStepRuns.assigneeId, uid), and(isNull(s.journeyStepRuns.assigneeId), inArray(s.journeyStepRuns.assigneeTeam, teams)))
          : eq(s.journeyStepRuns.assigneeId, uid),
      ),
    )
    .orderBy(asc(s.journeyStepRuns.dueDate), asc(s.journeySteps.position))
    .limit(opts.limit ?? 200);
  return rows.map((r) => {
    const isSubject = r.subjectId === uid;
    const action = stepAction(r.type, r.config, r.runId, isSubject);
    return {
      id: r.id,
      runId: r.runId,
      title: personalise(r.title, { displayName: r.subjectName, firstName: r.subjectFirst }),
      description: r.description ? personalise(r.description, { displayName: r.subjectName, firstName: r.subjectFirst }) : null,
      type: r.type,
      dueDate: r.dueDate,
      overdue: r.dueDate < today,
      dueToday: r.dueDate === today,
      journeyName: r.journeyName,
      kind: r.kind,
      subject: { id: r.subjectId, name: r.subjectName, isMe: isSubject },
      href: action.href,
      actionLabel: action.label,
      team: r.team,
    };
  });
}

/** Load the context of a user acting in the background (e.g. the requester of a journey ticket). */
export async function contextFor(userId: string | null | undefined): Promise<UserContext | null> {
  return userId ? loadUserContext(userId) : null;
}

/** People whose start (or end) date falls in the auto-start window. Used by the worker tick. */
export async function peopleInStartWindow(today: string, aheadDays = 14, behindDays = 7) {
  const from = addDays(today, -behindDays);
  const to = addDays(today, aheadDays);
  return db
    .select({ id: s.users.id, startDate: s.users.startDate, endDate: s.users.endDate })
    .from(s.users)
    .where(
      and(
        eq(s.users.status, "active"),
        or(and(gte(s.users.startDate, from), lte(s.users.startDate, to)), and(gte(s.users.endDate, from), lte(s.users.endDate, to))),
      ),
    );
}
