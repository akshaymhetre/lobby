import Link from "next/link";
import { ChevronLeft, ChevronRight, Network, SearchX, Upload, Users } from "lucide-react";
import { getOrgSettings } from "@lobby/core";
import { listDirectory, listNewJoiners, type PersonSummary } from "@lobby/core/people";
import { Page } from "@/components/page";
import { MastheadLink } from "@/components/ui/masthead";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ClockBoard, type ClockZone } from "@/components/people/day-track";
import { DirectoryToolbar } from "@/components/people/directory-toolbar";
import { NewJoiners } from "@/components/people/new-joiners";
import { PersonCard, PersonGroup, PersonRow } from "@/components/people/person-card";
import { CellList } from "@/components/ui/cells";
import { isWorkingNow } from "@lobby/core/people/format";
import { requireUser } from "@/server/auth";

export const metadata = { title: "People" };

type SP = Record<string, string | string[] | undefined>;
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean).slice(0, 20);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const PAGE_SIZE = 48;
const NO_DEPARTMENT = "No department yet";
/** A department shows its first six people; the rest are one click away, so the page stays a page. */
const GROUP_PREVIEW = 6;

/**
 * The Around the clock board's rows: everyone grouped by time zone, labelled by the offices in it
 * (most people first), with the zone's most common working hours as its band.
 */
function zonesOf(people: PersonSummary[]): ClockZone[] {
  const byTz = new Map<string, PersonSummary[]>();
  for (const p of people) if (p.timezone) byTz.set(p.timezone, [...(byTz.get(p.timezone) ?? []), p]);
  const top = <T,>(xs: T[]) => {
    const n = new Map<T, number>();
    for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x);
  };
  return [...byTz.entries()].map(([tz, members]) => {
    const places = top(members.map((m) => m.location).filter((l): l is string => !!l));
    const main = places[0] ?? null;
    return {
      tz,
      label: places.slice(0, 2).join(" and ") || tz.split("/").pop()!.replace(/_/g, " "),
      href: main ? `/people?location=${encodeURIComponent(main)}` : null,
      hours: top(members.map((m) => m.workingHours).filter((h): h is string => !!h))[0] ?? null,
      people: members.map((m) => ({ id: m.id, name: m.displayName, avatarUrl: m.avatarUrl, workingHours: m.workingHours })),
    };
  });
}

/** Groups a page of people by department, alphabetical, with the department-less at the end. */
function groupByDepartment(people: PersonSummary[]): { title: string; people: PersonSummary[] }[] {
  const groups = new Map<string, PersonSummary[]>();
  for (const p of people) {
    const key = p.department ?? NO_DEPARTMENT;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === NO_DEPARTMENT ? 1 : b === NO_DEPARTMENT ? -1 : a.localeCompare(b)))
    .map(([title, members]) => ({ title, people: members }));
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 100);
  const department = list(sp.department);
  const location = list(sp.location);
  const page = Number.parseInt(one(sp.page), 10) || 1;
  // The list, grouped by department, is the directory (audit C1). The grid is an opt-in at `md` and up.
  const view = one(sp.view) === "grid" ? "grid" : "list";
  const filtered = !!(q || department.length || location.length);

  const showBoard = !filtered && page === 1;
  const [dir, joiners, org, all] = await Promise.all([
    listDirectory(ctx, { q, department, location, page, pageSize: PAGE_SIZE }),
    listNewJoiners(ctx),
    getOrgSettings(),
    // Everyone (not just this page) for the Around the clock board.
    showBoard ? listDirectory(ctx, { pageSize: 200 }) : null,
  ]);
  const viewerTimezone = ctx.user.timezone || org.timezone || null;
  const showJoiners = !filtered && page === 1 && (joiners.recent.length > 0 || joiners.upcoming.length > 0);

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of list(v)) next.append(k, x);
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
    return `/people?${next.toString()}`;
  };
  const from = (dir.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(dir.page * PAGE_SIZE, dir.total);

  // The Today line: company facts in plain text, the parts that are for the reader as links.
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const headcount = dir.everyone === 1 ? "1 person" : `${dir.everyone} people`;
  // Facet counts shrink under a filter, so the sentence drops them rather than quoting a filtered number.
  const facts = filtered
    ? `${headcount}.`
    : `${headcount} across ${plural(dir.departments.length, "department")} and ${plural(dir.locations.length, "location")}.`;
  const joinerLinks: React.ReactNode[] = [];
  if (joiners.recent.length) joinerLinks.push(<MastheadLink key="recent" href="/people#new-faces">{joiners.recent.length} joined recently</MastheadLink>);
  if (joiners.upcoming.length) joinerLinks.push(<MastheadLink key="upcoming" href="/people#new-faces">{joiners.upcoming.length} start soon</MastheadLink>);
  const today =
    dir.everyone === 0 ? undefined : (
      <>
        {facts}
        {joinerLinks.length ? (
          <>
            {" "}
            {joinerLinks[0]}
            {joinerLinks.length > 1 ? <> and {joinerLinks[1]}</> : null}.
          </>
        ) : null}
      </>
    );

  const groups = q ? null : groupByDepartment(dir.people);
  const workingIn = (people: PersonSummary[]) => people.filter((p) => isWorkingNow(p.timezone, p.workingHours) === true).length;
  // Separate raised cells grouped by department (or flat search results), straight on the slab.
  let n = 0;
  const rows = groups ? (
    <div className="flex flex-col gap-8 max-md:gap-2">
      {groups.map((g, gi) => {
        const w = workingIn(g.people);
        return (
          <PersonGroup
            key={g.title}
            id={`team-${g.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            title={g.title}
            count={g.people.length}
            defaultOpen={gi === 0}
            summary={`${g.people.length} ${g.people.length === 1 ? "person" : "people"}${w ? `, ${w} working now` : ""}`}
          >
            {g.people.slice(0, g.people.length > GROUP_PREVIEW + 2 && g.title !== NO_DEPARTMENT ? GROUP_PREVIEW : undefined).map((p) => (
              <PersonRow key={p.id} person={p} viewerTimezone={viewerTimezone} index={n++} />
            ))}
            {/* Fold only when it saves real room: hiding one or two people behind a link is silly. */}
            {g.people.length > GROUP_PREVIEW + 2 && g.title !== NO_DEPARTMENT ? (
              <li className="list-none">
                <Link
                  href={`/people?department=${encodeURIComponent(g.title)}`}
                  className="focus-ring press flex min-h-16 items-center justify-center gap-2 rounded-card border border-dashed border-border-strong px-4 text-row font-medium text-accent-text hover:bg-raised"
                >
                  {g.people.length - GROUP_PREVIEW} more in {g.title}
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </li>
            ) : null}
          </PersonGroup>
        );
      })}
    </div>
  ) : (
    <CellList layout="grid" min="420px">
      {dir.people.map((p, i) => (
        <PersonRow key={p.id} person={p} viewerTimezone={viewerTimezone} showDepartment index={i} />
      ))}
    </CellList>
  );

  return (
    <Page
      width="wide"
      title="People"
      today={today}
      description={today ? undefined : "Find anyone at the company, see what they work on and when they are around."}
      inlineActions
      actions={
        <>
          {ctx.has("admin") ? (
            <Button asChild variant="ghost" size="icon" aria-label="Import people" className="sm:w-auto sm:px-2.5 md:w-auto">
              <Link href="/admin/people/import">
                <Upload aria-hidden />
                <span className="hidden sm:inline">Import</span>
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary" size="icon" aria-label="Org chart" className="sm:w-auto sm:px-2.5 md:w-auto">
            <Link href="/org-chart">
              <Network aria-hidden />
              <span className="hidden sm:inline">Org chart</span>
            </Link>
          </Button>
        </>
      }
    >
      <div className="section-stack">
        {all && all.people.length ? (
          <ClockBoard
            zones={zonesOf(all.people)}
            viewerTimezone={viewerTimezone}
            everyone={dir.everyone}
            viewerPlace={all.people.find((p) => p.id === ctx.user.id)?.location ?? null}
          />
        ) : null}
        {showJoiners ? <NewJoiners recent={joiners.recent} upcoming={joiners.upcoming} viewerId={ctx.user.id} /> : null}

        <section aria-label="Directory" className="section-content">
          <DirectoryToolbar departments={dir.departments} locations={dir.locations} total={dir.total} everyone={dir.everyone} />

          {dir.everyone === 0 ? (
            <EmptyState
              icon={<Users />}
              title="Nobody here yet"
              description="People appear here once they sign in, or when an admin connects SCIM or imports a CSV."
              action={
                ctx.has("admin") ? (
                  <Button asChild size="sm">
                    <Link href="/admin/people/import">Import people</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : dir.total === 0 ? (
            <EmptyState
              variant="filtered"
              icon={<SearchX />}
              title={q ? `No one matches "${q}"` : "No one matches these filters"}
              description="Try a first name, a team or a skill, or clear the filters to see everyone."
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/people">Clear search and filters</Link>
                </Button>
              }
            />
          ) : view === "grid" ? (
            <>
              {/* The grid is a desktop option; below `md` the directory is always the list (audit C2). */}
              <ul className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {dir.people.map((p) => (
                  <PersonCard key={p.id} person={p} />
                ))}
              </ul>
              <div className="md:hidden">{rows}</div>
            </>
          ) : (
            rows
          )}

          {dir.pageCount > 1 ? (
            <nav aria-label="Pages" className="flex items-center justify-between gap-3 pt-1">
              <p className="tabular text-small text-muted">
                {from} to {to} of {dir.total}
              </p>
              <div className="flex items-center gap-2">
                <Button asChild variant="secondary" size="sm" disabled={dir.page <= 1}>
                  <Link href={pageHref(dir.page - 1)} aria-disabled={dir.page <= 1} tabIndex={dir.page <= 1 ? -1 : undefined}>
                    <ChevronLeft aria-hidden />
                    Previous
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="sm" disabled={dir.page >= dir.pageCount}>
                  <Link href={pageHref(dir.page + 1)} aria-disabled={dir.page >= dir.pageCount} tabIndex={dir.page >= dir.pageCount ? -1 : undefined}>
                    Next
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </nav>
          ) : null}
        </section>
      </div>
    </Page>
  );
}
