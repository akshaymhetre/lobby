import Link from "next/link";
import { CircleCheck, Inbox, Search, SearchX } from "lucide-react";
import { assignableAgents, listQueue, type QueueSort, type QueueView } from "@lobby/core/helpdesk";
import { Page } from "@/components/page";
import { MastheadLink } from "@/components/ui/masthead";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueueTable, type QueueRow } from "@/components/helpdesk/queue-table";
import { SlaClock } from "@/components/helpdesk/sla-clock";
import { approvalProgressFor } from "@/components/helpdesk/approval-progress.server";
import { FilterChipLink, ViewTabs } from "@/components/helpdesk/view-tabs";
import { requireRole } from "@/server/auth";

export const metadata = { title: "Help queue" };

const VIEWS: { key: QueueView; label: string }[] = [
  { key: "unassigned", label: "Unassigned" },
  { key: "mine", label: "Mine" },
  { key: "open", label: "All open" },
  { key: "breaching", label: "Breaching soon" },
  { key: "resolved", label: "Resolved" },
];
const SORTS: QueueSort[] = ["number", "subject", "requester", "type", "priority", "status", "due"];

type SP = { view?: string; sort?: string; dir?: string; team?: string; q?: string };

export default async function QueuePage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireRole("agent");
  const sp = await searchParams;
  const view = (VIEWS.find((v) => v.key === sp.view)?.key ?? "open") as QueueView;
  const sort = SORTS.includes(sp.sort as QueueSort) ? (sp.sort as QueueSort) : undefined;
  const dir = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : undefined;
  const q = sp.q?.slice(0, 100);

  const data = await listQueue(ctx, { view, sort, dir, teamSlug: sp.team, q });
  const agents = await assignableAgents(
    ctx,
    data.teams.map((t) => t.id),
  );

  // The effective sort, mirroring listQueue's defaults, so headers show the right arrow.
  const effSort: QueueSort = sort ?? (view === "resolved" ? "number" : "due");
  const effDir =
    dir ??
    (effSort === "due" ? "asc" : effSort === "priority" || effSort === "number" ? "desc" : "asc");
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged: SP = { view, team: sp.team, q, sort, dir, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    if (merged.view === "open") p.delete("view");
    const s = p.toString();
    return `/queue${s ? `?${s}` : ""}`;
  };
  const hrefFor = Object.fromEntries(
    SORTS.map((k) => [
      k,
      href({
        sort: k,
        dir:
          effSort === k
            ? effDir === "asc"
              ? "desc"
              : "asc"
            : k === "due" || k === "subject" || k === "requester" || k === "type"
              ? "asc"
              : "desc",
      }),
    ]),
  ) as Record<QueueSort, string>;

  const progress = await approvalProgressFor(data.items.filter((i) => i.status === "pending_approval").map((i) => i.id));
  const rows: QueueRow[] = data.items.map((i) => ({
    approvalProgress: progress.get(i.id) ?? null,
    id: i.id,
    number: i.number,
    subject: i.subject,
    status: i.status,
    priority: i.priority,
    requesterName: i.requesterName,
    requesterAvatar: i.requesterAvatar,
    requestTypeName: i.requestTypeName,
    teamName: i.teamName,
    assigneeId: i.assigneeId,
    assigneeName: i.assigneeName,
    dueAt: i.dueAt ? i.dueAt.toISOString() : null,
    firstRespondedAt: i.firstRespondedAt ? i.firstRespondedAt.toISOString() : null,
    resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
  }));

  const teamLabel =
    data.teams.length === 1 ? data.teams[0]!.name : ctx.has("admin") ? "every team" : "your teams";
  const c = data.counts;
  const today = (
    <>
      {c.open} open for {teamLabel}
      {c.unassigned || c.breaching ? (
        <>
          :{" "}
          {c.unassigned ? (
            <MastheadLink href={href({ view: "unassigned", sort: undefined, dir: undefined })}>
              {c.unassigned} unassigned
            </MastheadLink>
          ) : null}
          {c.unassigned && c.breaching ? " and " : null}
          {c.breaching ? (
            <MastheadLink href={href({ view: "breaching", sort: undefined, dir: undefined })}>
              {c.breaching} breaching soon
            </MastheadLink>
          ) : null}
        </>
      ) : null}
      . Oldest due first, so nothing quietly misses its target.
    </>
  );

  return (
    <Page width="wide" title="Help queue" today={today}>
      {view !== "resolved" && rows.length ? <SlaClock rows={rows} meId={ctx.user.id} now0={Date.now()} /> : null}
      <div className={`section-content ${view !== "resolved" && rows.length ? "mt-8" : ""}`}>
        <ViewTabs
          label="Queue views"
          active={view}
          tabs={VIEWS.map((v) => ({
            key: v.key,
            label: v.label,
            href: href({ view: v.key, sort: undefined, dir: undefined }),
            count: data.counts[v.key],
            tone: v.key === "breaching" ? "warning" : "neutral",
          }))}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {data.teams.length > 1 ? (
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Filter by team"
            >
              <FilterChipLink href={href({ team: undefined })} selected={!sp.team}>
                All teams
              </FilterChipLink>
              {data.teams.map((t) => (
                <FilterChipLink
                  key={t.id}
                  href={href({ team: sp.team === t.slug ? undefined : t.slug })}
                  selected={sp.team === t.slug}
                >
                  {t.name}
                </FilterChipLink>
              ))}
            </div>
          ) : (
            <span />
          )}
          <form action="/queue" className="flex w-full items-center gap-2 sm:w-auto">
            {view !== "open" ? <input type="hidden" name="view" value={view} /> : null}
            {sp.team ? <input type="hidden" name="team" value={sp.team} /> : null}
            <label htmlFor="queue-q" className="sr-only">
              Search the queue
            </label>
            <Input
              id="queue-q"
              name="q"
              type="search"
              defaultValue={q ?? ""}
              placeholder="Subject or #number"
              leading={<Search />}
              className="sm:w-64"
            />
          </form>
        </div>

        {rows.length ? (
          <QueueTable
            rows={rows}
            agents={agents}
            meId={ctx.user.id}
            sort={effSort}
            dir={effDir}
            hrefFor={hrefFor}
          />
        ) : q || sp.team ? (
          <EmptyState
            variant="filtered"
            icon={<SearchX />}
            title="Nothing matches"
            description="Try another search, or clear the filters."
            action={
              <Button variant="secondary" asChild>
                <Link href={href({ q: undefined, team: undefined })}>Clear filters</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={view === "resolved" ? <Inbox /> : <CircleCheck />}
            title={
              view === "unassigned"
                ? "Everything has an owner"
                : view === "mine"
                  ? "Nothing assigned to you"
                  : view === "breaching"
                    ? "Nothing is close to its target"
                    : view === "resolved"
                      ? "Nothing resolved yet"
                      : "The queue is clear"
            }
            description={
              view === "mine"
                ? "Pick something up from Unassigned and it'll show here."
                : view === "breaching"
                  ? "Requests due within two hours, or already overdue, show up here."
                  : "New requests land here the moment someone raises them."
            }
            action={
              view === "mine" ? (
                <Button variant="secondary" asChild>
                  <Link href={href({ view: "unassigned" })}>See unassigned</Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </Page>
  );
}
