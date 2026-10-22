import Link from "next/link";
import { ArrowUpRight, ChevronRight, LifeBuoy } from "lucide-react";
import { CategoryBlock } from "@/components/ui/category-block";
import { HeroLight } from "@/components/ui/hero-light";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import { SlaDue } from "./badges";
import { HELPDESK_ICONS } from "./icons";
import { teamTone } from "./team-tone";
import type { RequestListRow } from "./request-list";
import { RequestTrack } from "./request-track";
import { buildStages } from "./track-data";
import type { TicketStatus } from "./status";

export interface InFlightRow extends RequestListRow {
  createdAt: Date;
  firstRespondedAt: Date | null;
}

/**
 * The lead of the Help page for anyone with something open: each request on its track, so
 * "where is my laptop" is answered before anyone opens a ticket. Each request is a block in its
 * team's colour (IT blue, People violet, Workplace teal), so three requests read as three teams at
 * a glance. One light lights the card: amber when something waits on your reply, teal while the
 * teams are working. The spark runs only on the first row, so three rows never shout at once.
 */
export function InFlight({ rows, total }: { rows: InFlightRow[]; total: number }) {
  const waiting = rows.some((r) => r.status === "waiting_on_requester");
  return (
    <section aria-labelledby="in-flight-title" className="relative isolate flex flex-col overflow-hidden rounded-panel panel dark:glass">
      <HeroLight tone={waiting ? "amber" : "teal"} position="top-left" />
      <div className="flex items-end justify-between gap-4 px-5 pb-4 pt-5 sm:px-7 sm:pt-7">
        <div className="flex flex-col gap-1.5">
          <h2 id="in-flight-title" className="text-hero font-medium text-fg">
            In flight
          </h2>
          <p className="text-body text-muted">
            {total === 1
              ? "Your one open request, and where it's up to."
              : rows.length < total
                ? `The latest ${rows.length} of your ${total} open requests, and where each is up to.`
                : `Your ${total} open requests, and where each is up to.`}
          </p>
        </div>
        <Link
          href="/help/requests"
          className="focus-ring press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-small font-medium text-fg cell hover:shadow-cell-hover"
        >
          <ArrowUpRight className="size-4 stroke-[1.75]" aria-hidden />
          See all
        </Link>
      </div>
      <TrackList rows={rows} className="px-3 pb-3 sm:px-5 sm:pb-5" />
    </section>
  );
}

/**
 * Requests as raised cells, each with its track: the request as a block in its team's colour,
 * where it is, and when it is due. Used by the in-flight panel and by Your requests.
 * The spark runs on the first row only.
 */
export function TrackList({ rows, className }: { rows: InFlightRow[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {rows.map((r, i) => {
        const status = r.status as TicketStatus;
        const open = status === "new" || status === "open" || status === "waiting_on_requester";
        const tone = teamTone(r.teamName);
        return (
          <li key={r.id}>
            <Link
              href={`/help/${r.number}`}
              className={cn(
                "focus-ring press group grid grid-cols-1 items-center gap-x-6 gap-y-3 rounded-card p-2 cell transition-shadow duration-160 ease-standard hover:shadow-cell-hover sm:p-2.5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_10rem_auto] lg:pr-4",
              )}
            >
              <CategoryBlock
                tone={tone}
                icon={<TypeIcon name={r.requestTypeIcon} />}
                title={r.subject}
                subtitle={
                  <>
                    <span className="tabular">#{r.number}</span> {r.requestTypeName ?? r.teamName}
                  </>
                }
                className="min-w-0"
              />
              <span className="min-w-0 px-1 lg:px-0">
                <RequestTrack
                  size="md"
                  tone={tone}
                  spark={i === 0}
                  stages={buildStages({
                    status,
                    createdAt: r.createdAt,
                    teamName: r.teamName,
                    assigneeName: r.assigneeName,
                    pickedUpAt: r.firstRespondedAt,
                    resolvedAt: r.resolvedAt,
                    approval:
                      status === "pending_approval" && r.approvalProgress
                        ? { state: "pending", progress: r.approvalProgress }
                        : undefined,
                  })}
                  label={`#${r.number} progress`}
                />
              </span>
              <span className="flex items-center gap-2 px-2 text-small text-muted lg:px-0">
                {open && r.resolutionDueAt ? (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span>Due</span>
                    <SlaDue due={r.resolutionDueAt} doneAt={r.resolvedAt} label="Resolution" variant="block" />
                  </span>
                ) : status === "pending_approval" ? (
                  <span className="whitespace-nowrap">After approval</span>
                ) : (
                  <span className="whitespace-nowrap">
                    {status === "rejected" ? "Not approved" : status === "resolved" || status === "closed" ? "Resolved" : "Updated"} {timeAgo(r.resolvedAt ?? r.updatedAt)}
                  </span>
                )}
              </span>
              <ChevronRight
                className="hidden size-4 shrink-0 stroke-[1.5] text-subtle transition-[color,transform] duration-120 group-hover:translate-x-0.5 group-hover:text-fg lg:block"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TypeIcon({ name }: { name: string | null }) {
  const Icon = (name && HELPDESK_ICONS[name]) || LifeBuoy;
  return <Icon />;
}
