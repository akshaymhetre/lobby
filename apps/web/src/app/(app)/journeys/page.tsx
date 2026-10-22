import Link from "next/link";
import { Compass, Settings2, Users } from "lucide-react";
import {
  allRuns,
  getPersonRunViews,
  canManageJourneys,
  completeAcknowledgedSteps,
  groupRunsByPerson,
  journeyClock,
  listColleagues,
  listJourneys,
  myJourneys,
  myTasks,
  teamRuns,
  type RunFilters,
  type RunRow,
} from "@lobby/core/journeys";
import { runTimingLabel } from "@lobby/core/journeys/dates";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Masthead, MastheadLink } from "@/components/ui/masthead";
import { appIconsFor } from "@/components/journeys/app-icons";
import { Navigator } from "@/components/journeys/navigator";
import { RunsFilters } from "@/components/journeys/runs-filters";
import { RunsList } from "@/components/journeys/runs-list";
import { StageBoard } from "@/components/journeys/stage-board";
import { TabLinks } from "@/components/journeys/tab-links";
import { TasksPanel } from "@/components/journeys/tasks-panel";
import { buildTrack, type Track } from "@/components/journeys/track";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Onboarding" };

type View = "journey" | "tasks" | "team" | "all";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function JourneysPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  const sp = await searchParams;
  // Pick up acknowledgements made on the Knowledge page itself.
  await completeAcknowledgedSteps(ctx.user.id).catch(() => 0);

  const [mine, tasks, team, manage, clock] = await Promise.all([
    myJourneys(ctx),
    myTasks(ctx),
    ctx.has("manager") ? teamRuns(ctx) : Promise.resolve([]),
    canManageJourneys(ctx),
    journeyClock(),
  ]);

  const pendingTasks = tasks.items.filter((i) => i.status === "pending");
  const openTasks = pendingTasks.length + tasks.buddyNeeded.length;
  const overdueTasks = pendingTasks.filter((i) => i.dueDate < clock.today).length;
  const activeTeam = team.filter((t) => t.status === "active");
  const teamPeople = [...new Map(activeTeam.map((t) => [t.subject.id, t])).values()];

  const tabs: { key: View; label: string; href: string; count?: number }[] = [];
  if (mine.length) tabs.push({ key: "journey", label: mine[0]!.journey.kind === "offboarding" ? "Your offboarding" : "Your journey", href: "/journeys" });
  if (!mine.length || tasks.items.length || tasks.buddyNeeded.length)
    tabs.push({ key: "tasks", label: "Your tasks", href: mine.length ? "/journeys?view=tasks" : "/journeys", count: openTasks });
  if (team.length || ctx.has("manager")) tabs.push({ key: "team", label: "Your team", href: "/journeys?view=team", count: teamPeople.length });
  if (manage) tabs.push({ key: "all", label: "All journeys", href: "/journeys?view=all" });

  const requested = one(sp.view) as View | undefined;
  const view: View = requested && tabs.some((t) => t.key === requested) ? requested : tabs[0]!.key;
  const tabNav = tabs.length > 1 ? <TabLinks tabs={tabs} active={view} label="Onboarding views" className="mt-6" /> : null;

  if (view === "journey") {
    const appIcons = appIconsFor(mine.flatMap((r) => r.steps.map((s) => s.target)));
    return (
      <Page width="wide">
        <Navigator runs={mine} companyName={clock.companyName} appIcons={appIcons} viewerName={ctx.user.displayName} tabs={tabNav} />
      </Page>
    );
  }

  /* The "Today" line: what is yours to do, and who on your team is starting. Links mean "for you". */
  const facts: React.ReactNode[] = [];
  if (openTasks) {
    facts.push(
      <>
        You have <MastheadLink href="/journeys?view=tasks">{openTasks} {openTasks === 1 ? "step" : "steps"} to do</MastheadLink>
        {overdueTasks ? `, ${overdueTasks} overdue` : ""}.
      </>,
    );
  }
  if (teamPeople.length === 1) {
    const t = teamPeople[0]!;
    facts.push(
      <>
        <MastheadLink href="/journeys?view=team">{t.subject.name}</MastheadLink> {runTimingLabel(t.anchorDate, clock.today, t.kind).replace(/^\w/, (c) => c.toLowerCase())}.
      </>,
    );
  } else if (teamPeople.length > 1) {
    facts.push(
      <>
        <MastheadLink href="/journeys?view=team">{teamPeople.length} people on your team</MastheadLink> are on a journey.
      </>,
    );
  }
  const today = facts.length ? (
    <>
      {facts.map((f, i) => (
        <span key={i}>
          {i ? " " : ""}
          {f}
        </span>
      ))}
    </>
  ) : null;

  const colleagues = await listColleagues();

  /** Each person's steps (every journey they are on), drawn as their month track. */
  const journeysFor = async (rows: RunRow[]) => {
    const tracks: Record<string, Track> = {};
    const found = await Promise.all(rows.slice(0, 16).map(async (r) => ({ r, views: await getPersonRunViews(ctx, r.runId) })));
    for (const { r, views } of found) {
      if (!views?.length) continue;
      // The new hire's own steps, so a stage reads "0/6" here exactly as it does on their navigator.
      tracks[r.runId] = buildTrack(views.flatMap((v) => v.steps.filter((st) => st.forSubject)), clock.today);
    }
    return { tracks };
  };
  const header = (
    <Masthead
      title="Onboarding"
      today={today}
      description={today ? undefined : "Steps you own in people's first weeks (and last ones), and how your team's new starters are getting on."}
      actions={
        ctx.has("admin") ? (
          <Button asChild variant="secondary">
            <Link href="/admin/journeys">
              <Settings2 aria-hidden />
              Manage journeys
            </Link>
          </Button>
        ) : null
      }
    >
      {tabNav}
    </Masthead>
  );

  if (view === "tasks") {
    return (
      <Page width="wide">
        {header}
        <TasksPanel view={tasks} colleagues={colleagues} appIcons={appIconsFor(tasks.items.map((i) => i.target))} viewerName={ctx.user.displayName} />
      </Page>
    );
  }

  if (view === "team") {
    // A manager's team is a handful of people: each person
    // with their whole journey drawn as a month track.
    const teamRows = groupRunsByPerson(team);
    const { tracks: teamTracks } = await journeysFor(teamRows);
    return (
      <Page width="wide">
        {header}
        {team.length ? (
          <RunsList runs={teamRows} today={clock.today} colleagues={colleagues} tracks={teamTracks} />
        ) : (
          <EmptyState
            icon={<Users />}
            title="Nobody on your team is onboarding"
            description="When someone who reports to you gets a start date, their journey starts automatically and appears here two weeks before day 1."
          />
        )}
      </Page>
    );
  }

  const filters: RunFilters = {
    q: one(sp.q),
    journeyId: one(sp.journey),
    department: one(sp.department),
    status: (["active", "completed", "all"].includes(one(sp.status) ?? "") ? one(sp.status) : "active") as RunFilters["status"],
  };
  const [runs, journeys] = await Promise.all([allRuns(ctx, filters), listJourneys(ctx)]);
  const departments = [...new Set(colleagues.map((c) => c.department).filter((d): d is string => !!d))].sort();
  const filtered = !!(filters.q || filters.journeyId || filters.department || filters.status !== "active");
  const allRows = runs ? groupRunsByPerson(runs) : [];
  const people = allRows.length;
  return (
    <Page width="wide">
      {header}
      <div className="section-content">
        <RunsFilters journeys={journeys.map((j) => ({ id: j.id, name: j.name }))} departments={departments} />
        {runs && runs.length ? (
          <>
            <p className="tabular text-small text-muted" aria-live="polite">
              {people} {people === 1 ? "person" : "people"}, {runs.length} {runs.length === 1 ? "journey" : "journeys"}, by the stage they are in today
            </p>
            <StageBoard runs={allRows} today={clock.today} colleagues={colleagues} />
          </>
        ) : (
          <EmptyState
            variant={filtered ? "filtered" : "first-run"}
            icon={<Compass />}
            title={filtered ? "No journeys match" : "No journeys in progress"}
            description={
              filtered
                ? "Try a different name, journey or department."
                : "Journeys start automatically two weeks before someone's first day. You can also start one by hand from Manage journeys."
            }
          />
        )}
      </div>
    </Page>
  );
}
