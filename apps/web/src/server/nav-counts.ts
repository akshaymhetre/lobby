import "server-only";
import { and, count, db, eq, inArray, isNull, or, s, sql } from "@lobby/db";
import type { UserContext } from "@lobby/core";
import { teamsOf } from "@lobby/core/journeys";
import { countMyPendingApprovals } from "@lobby/core/helpdesk";
import { openRequestCount } from "@lobby/core/counts";
import type { NavCounts } from "@/lib/nav";


export async function getNavCounts(ctx: UserContext): Promise<NavCounts> {
  const uid = ctx.user.id;
  // Steps assigned to me, plus unclaimed steps sitting in my team's queue (IT, People).
  const teams = await teamsOf(ctx).catch(() => [] as string[]);
  const [tasks, tickets, approvals, queue] = await Promise.all([
    db.select({ n: count() }).from(s.journeyStepRuns)
      .innerJoin(s.journeyRuns, eq(s.journeyRuns.id, s.journeyStepRuns.runId))
      .where(and(
        teams.length
          ? or(eq(s.journeyStepRuns.assigneeId, uid), and(isNull(s.journeyStepRuns.assigneeId), inArray(s.journeyStepRuns.assigneeTeam, teams as ("it" | "people")[])))
          : eq(s.journeyStepRuns.assigneeId, uid),
        eq(s.journeyStepRuns.status, "pending"),
        eq(s.journeyRuns.status, "active"),
      )),
    // Canonical "open requests (mine)": the same number as the Home sentence and the Help page.
    openRequestCount(ctx).then((n) => [{ n }]),
    countMyPendingApprovals(ctx).then((n) => [{ n }]),
    ctx.has("agent")
      ? db.select({ n: count() }).from(s.tickets)
          .innerJoin(s.teams, eq(s.teams.id, s.tickets.teamId))
          .where(and(
            isNull(s.tickets.assigneeId),
            inArray(s.tickets.status, ["new", "open"]),
            ctx.has("admin") ? undefined : (ctx.groupIds.length ? inArray(s.teams.agentGroupId, ctx.groupIds) : sql`false`),
          ))
      : Promise.resolve([{ n: 0 }]),
  ]);
  return {
    myTasks: tasks[0]?.n ?? 0,
    myOpenTickets: tickets[0]?.n ?? 0,
    myApprovals: approvals[0]?.n ?? 0,
    queueUnassigned: queue[0]?.n ?? 0,
  };
}
