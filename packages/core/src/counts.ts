/**
 * Canonical counts. Every screen that shows one of these numbers reads it from here (or from a
 * read model that uses the same pure definition), so Home, Help, People, Apps, Knowledge,
 * Onboarding and Admin never disagree. Each function's doc comment IS the definition; the label a
 * screen prints must match it.
 *
 * Access: each function applies the same visibility rules as the module it counts (apps by
 * group, pages by space and page audience, runs by getRunView's rule). Functions that would reveal
 * something a reader may not otherwise see return null for that reader instead of a number.
 *
 * Cross-screen agreement is checked against the seeded database by
 * `packages/core/scripts/check-counts.ts` (`pnpm --filter @lobby/core check:counts`).
 */
import { and, count, db, eq, inArray, isNull, s } from "@lobby/db";
import type { UserContext } from "./identity/context";
import { isAppVisible } from "./apps/logic";
import { canViewPage, effectiveAudience } from "./knowledge/access";
import { canManageJourneys } from "./journeys/engine";
import { canViewRun } from "./journeys/views";
import { tallyNewHireSteps, tallyRunSteps, type StepTally } from "./journeys/progress";
import { DONE_STATUSES, OPEN_STATUSES } from "./helpdesk/internal";
import { directoryPersonWhere } from "./people/directory";

// ---------------------------------------------------------------------------------------------
// Requests

/**
 * Statuses that make a request "open": anything not finished. Finished means resolved, closed or
 * rejected (DONE_STATUSES). Includes pending approval and waiting on the requester.
 */
export const OPEN_REQUEST_STATUSES = OPEN_STATUSES;
export const FINISHED_REQUEST_STATUSES = DONE_STATUSES;

/**
 * Open requests (mine): tickets the reader requested whose status is not resolved, closed or
 * rejected. Includes pending approval and waiting on me. The same number belongs on the Home
 * sentence, the Help nav badge and the Help page.
 */
export async function openRequestCount(ctx: UserContext): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(s.tickets)
    .where(and(eq(s.tickets.requesterId, ctx.user.id), inArray(s.tickets.status, [...OPEN_REQUEST_STATUSES])));
  return r?.n ?? 0;
}

// ---------------------------------------------------------------------------------------------
// People and accounts

export { directoryPersonWhere };

/**
 * People: active people in the directory. Excludes deactivated people and the break-glass admin
 * account, which has no directory profile. Every employee may see the directory, so no ctx.
 */
export async function directoryPeopleCount(): Promise<number> {
  const [r] = await db.select({ n: count() }).from(s.users).where(directoryPersonWhere());
  return r?.n ?? 0;
}

export interface AccountCounts {
  /** Active accounts that can sign in: people plus admin accounts. */
  accounts: number;
  /** Active people in the directory (same as directoryPeopleCount). */
  people: number;
  /** Active break-glass admin accounts (no directory profile). */
  admin: number;
  /** Deactivated accounts (cannot sign in, not in the directory). */
  deactivated: number;
}

/** Unchecked tally behind accountCounts; for admin-only surfaces that already checked access. */
export async function tallyAccounts(): Promise<AccountCounts> {
  const rows = await db
    .select({ status: s.users.status, breakGlass: s.users.isBreakGlass, n: count() })
    .from(s.users)
    .groupBy(s.users.status, s.users.isBreakGlass);
  const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((n, r) => n + r.n, 0);
  const people = sum((r) => r.status === "active" && !r.breakGlass);
  const admin = sum((r) => r.status === "active" && r.breakGlass);
  return { accounts: people + admin, people, admin, deactivated: sum((r) => r.status !== "active") };
}

/**
 * Accounts, for admins only (null otherwise). Label exactly, e.g.
 * "41 accounts: 40 people and 1 admin account", plus "N deactivated" when non-zero.
 */
export async function accountCounts(ctx: UserContext): Promise<AccountCounts | null> {
  if (!ctx.has("admin")) return null;
  return tallyAccounts();
}

// ---------------------------------------------------------------------------------------------
// Apps

/**
 * Apps: `visible` is the apps this reader may see and launch (by group); `total` is every app in
 * the catalogue. A reader sees "11 of 13 apps"; admin sees "13 apps in the catalogue" (total).
 */
export async function appCounts(ctx: UserContext): Promise<{ visible: number; total: number }> {
  const [apps, vis] = await Promise.all([db.select({ id: s.apps.id }).from(s.apps), db.select().from(s.appVisibility)]);
  const groupsByApp = new Map<string, string[]>();
  for (const v of vis) groupsByApp.set(v.appId, [...(groupsByApp.get(v.appId) ?? []), v.groupId]);
  const visible = apps.filter((a) => isAppVisible(groupsByApp.get(a.id) ?? [], ctx.groupIds)).length;
  return { visible, total: apps.length };
}

// ---------------------------------------------------------------------------------------------
// Knowledge pages

export interface PageCounts {
  /** Published pages this reader may read (space and page audience applied). Never drafts. */
  visible: number;
  /** Every published page. Null unless the reader may see content health (admin, content editor). */
  published: number | null;
  /** Published pages with a restricted audience (restricted space or page). Null as above. */
  restricted: number | null;
}

/**
 * Pages: a reader sees `visible` ("28 pages"). Content health shows all published pages, worded
 * as "30 published pages, including 2 in restricted spaces".
 */
export async function pageCounts(ctx: UserContext): Promise<PageCounts> {
  const rows = await db
    .select({ pageGroups: s.pages.visibilityGroupIds, spaceGroups: s.spaces.visibilityGroupIds, spaceEditors: s.spaces.editorGroupIds })
    .from(s.pages)
    .innerJoin(s.spaces, eq(s.spaces.id, s.pages.spaceId))
    .where(eq(s.pages.status, "published"));
  const visible = rows.filter((r) =>
    canViewPage(ctx, { visibilityGroupIds: r.spaceGroups, editorGroupIds: r.spaceEditors }, { visibilityGroupIds: r.pageGroups }),
  ).length;
  const health = ctx.has("admin") || ctx.has("content-editor");
  const restricted = rows.filter(
    (r) => effectiveAudience({ visibilityGroupIds: r.spaceGroups, editorGroupIds: r.spaceEditors }, { visibilityGroupIds: r.pageGroups }) !== null,
  ).length;
  return { visible, published: health ? rows.length : null, restricted: health ? restricted : null };
}

// ---------------------------------------------------------------------------------------------
// Journeys

export type RunTarget = { runId: string } | { userId: string };

/** Run ids a target covers, or null when the reader may not see them. */
async function runsFor(ctx: UserContext, target: RunTarget): Promise<string[] | null> {
  if ("runId" in target) return (await canViewRun(ctx, target.runId)) ? [target.runId] : null;
  if (!/^[0-9a-f-]{36}$/i.test(target.userId)) return null;
  const [person] = await db.select({ managerId: s.users.managerId }).from(s.users).where(eq(s.users.id, target.userId));
  if (!person) return null;
  const runs = await db
    .select({ id: s.journeyRuns.id, buddyId: s.journeyRuns.buddyUserId })
    .from(s.journeyRuns)
    .where(and(eq(s.journeyRuns.subjectUserId, target.userId), eq(s.journeyRuns.status, "active")));
  // The whole person (every journey at once) is for the same viewers as getPersonRunViews:
  // the person, their manager, their buddy, the People team and admins.
  const uid = ctx.user.id;
  const whole =
    target.userId === uid || person.managerId === uid || runs.some((r) => r.buddyId === uid) || (await canManageJourneys(ctx));
  return whole ? runs.map((r) => r.id) : null;
}

async function stepsOf(runIds: string[]) {
  if (!runIds.length) return [];
  return db
    .select({ status: s.journeyStepRuns.status, assignee: s.journeySteps.assignee })
    .from(s.journeyStepRuns)
    .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
    .where(inArray(s.journeyStepRuns.runId, runIds));
}

/**
 * A new hire's progress: steps assigned to the new hire themself, done (or skipped) of total.
 * For `{ userId }` it spans every ACTIVE journey of that person (Welcome + Engineering), which is
 * the one number on the navigator hero, its rail, the team view and all journeys. For `{ runId }`
 * it is that run alone. Null when the reader may not see the run or person.
 */
export async function newHireProgress(ctx: UserContext, target: RunTarget): Promise<StepTally | null> {
  const ids = await runsFor(ctx, target);
  if (!ids) return null;
  return tallyNewHireSteps(await stepsOf(ids));
}

/**
 * Run progress: EVERY step on the run(s), whoever it is assigned to. Any screen showing it labels
 * it as such, e.g. "26 steps across everyone, 3 done". Same targets and access as newHireProgress.
 */
export async function runProgress(ctx: UserContext, target: RunTarget): Promise<StepTally | null> {
  const ids = await runsFor(ctx, target);
  if (!ids) return null;
  return tallyRunSteps(await stepsOf(ids));
}

/**
 * A journey's length in the builder: all live (not archived) steps on the template, and how many
 * are for the new hire,
 * labelled "17 steps (10 for the new hire)". Templates are not sensitive, so no ctx.
 */
export async function journeyLength(journeyId: string): Promise<{ total: number; forNewHire: number }> {
  if (!/^[0-9a-f-]{36}$/i.test(journeyId)) return { total: 0, forNewHire: 0 };
  const rows = await db
    .select({ assignee: s.journeySteps.assignee })
    .from(s.journeySteps)
    .where(and(eq(s.journeySteps.journeyId, journeyId), isNull(s.journeySteps.archivedAt)));
  return { total: rows.length, forNewHire: rows.filter((r) => r.assignee === "subject").length };
}
