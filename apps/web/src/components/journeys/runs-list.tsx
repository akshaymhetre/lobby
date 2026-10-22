"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, PartyPopper, UserRoundPlus } from "lucide-react";
import type { Colleague, RunRow } from "@lobby/core/journeys";
import { dueLabel, runTimingLabel } from "@lobby/core/journeys/dates";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { HeroLight } from "@/components/ui/hero-light";
import { AvatarRing } from "./avatar-ring";
import { PhaseTrack } from "./phase-track";
import type { Track } from "./track";
import { BuddyPicker } from "./buddy-picker";
import { TasksPill } from "./tasks-pill";

/**
 * Journeys in progress as person cells, in the Home onboarding card's language: the person's
 * generated face inside their progress ring, their "3/26 tasks done" pill (the count tweens up),
 * where they are, what is up next, how much is late, and their buddy (pickable inline). The cells
 * build in with a short stagger. Used for a manager's team and the People team's view.
 */
export function RunsList({
  runs,
  today,
  colleagues,
  showManager = false,
  canAssignBuddy = true,
  tracks,
}: {
  runs: RunRow[];
  today: string;
  colleagues: Colleague[];
  showManager?: boolean;
  canAssignBuddy?: boolean;
  /**
   * Month tracks by run id. When given (a manager's own team, a handful of people), each person
   * gets a wide row with their whole journey drawn as the month track instead of a cell.
   */
  tracks?: Record<string, Track>;
}) {
  const [picking, setPicking] = React.useState<RunRow | null>(null);
  return (
    <>
      {tracks ? (
        <Reveal className="flex flex-col gap-3" stagger={0.08}>
          {runs.map((r) => {
            const track = tracks[r.runId];
            const complete = r.status === "completed";
            return (
              <RevealItem key={r.runId} from="up" className="panel group/run relative isolate grid gap-6 overflow-hidden rounded-panel p-4 sm:p-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-8">
                <HeroLight tone={r.overdue ? "red" : r.kind === "offboarding" ? "blue" : "violet"} position="top-left" />
                <div className="flex items-center gap-4 lg:flex-col lg:justify-center lg:gap-3 lg:text-center">
                  <AvatarRing person={r.subject} done={r.progress.newHire.done} total={r.progress.newHire.total} size={104} className="max-sm:size-[84px]" />
                  <div className="flex min-w-0 flex-col gap-2 lg:items-center">
                    <div className="flex min-w-0 flex-col">
                      <Link
                        href={`/journeys/runs/${r.runId}`}
                        className="focus-ring truncate rounded-[4px] text-h3 font-medium text-fg hover:underline hover:underline-offset-2"
                      >
                        {r.subject.name}
                      </Link>
                      <span className="truncate text-small text-muted">{r.subject.title ?? r.subject.department}</span>
                    </div>
                    <span className="flex flex-wrap items-center gap-1.5 lg:justify-center">
                      <TasksPill done={r.progress.newHire.done} total={r.progress.newHire.total} count size="sm" />
                      {r.overdue ? (
                        <Badge tone="danger" dot size="sm">
                          <span className="tabular">{r.overdue}</span> overdue across everyone
                        </Badge>
                      ) : complete ? null : (
                        <Badge tone="success" dot size="sm">
                          On track
                        </Badge>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-caption text-muted">
                        {r.journeyName} · {complete ? "Completed" : runTimingLabel(r.anchorDate, today, r.kind)}
                      </span>
                      {r.next ? (
                        <span className="min-w-0 text-body text-fg">
                          <span className="font-medium text-cat-violet-text">Up next</span> {r.next.title}{" "}
                          <span className={cn("text-small", r.next.dueDate < today ? "text-danger-text" : "text-muted")}>
                            {dueLabel(r.next.dueDate, today).replace(/^\w/, (c) => c.toLowerCase())}
                          </span>
                        </span>
                      ) : (
                        <span className="text-body text-muted">Nothing left to do</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.buddy ? (
                        <span className="flex min-w-0 items-center gap-2 text-small">
                          <Avatar name={r.buddy.name} seed={r.buddy.id} src={r.buddy.avatarUrl} size="md" />
                          <span className="flex min-w-0 flex-col leading-tight">
                            <span className="text-caption text-muted">Buddy</span>
                            <span className="truncate text-fg">{r.buddy.name}</span>
                          </span>
                          {canAssignBuddy && !complete ? (
                            <Button variant="link" size="sm" className="text-caption" onClick={() => setPicking(r)} aria-label={`Change ${r.subject.firstName}'s buddy`}>
                              Change
                            </Button>
                          ) : null}
                        </span>
                      ) : r.needsBuddy && canAssignBuddy ? (
                        <Button variant="secondary" size="sm" onClick={() => setPicking(r)}>
                          <UserRoundPlus aria-hidden />
                          Assign a buddy
                        </Button>
                      ) : null}
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/journeys/runs/${r.runId}`} aria-label={`View ${r.subject.name}'s journey`}>
                          View
                          <ChevronRight aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  </div>
                  {track ? (
                    <>
                      <PhaseTrack track={track} today={today} label={`${r.subject.firstName}'s journey, phase by phase`} />
                      <p className="text-caption text-muted">Each stage counts {r.subject.firstName}&apos;s own steps. The whole journey, with everyone helping, is one click away.</p>
                    </>
                  ) : null}
                </div>
              </RevealItem>
            );
          })}
        </Reveal>
      ) : (
      <Reveal className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" stagger={0.07}>
        {runs.map((r) => {
          const complete = r.status === "completed";
          const late = !!r.next && r.next.dueDate < today;
          return (
            <RevealItem
              key={r.runId}
              from="scale"
              className="group/run cell relative isolate flex flex-col gap-4 rounded-panel p-4 transition-shadow duration-160 hover:shadow-cell-hover sm:p-5"
            >
              <SpotlightLayer />
              <div className="flex min-w-0 items-center gap-4">
                <AvatarRing person={r.subject} done={r.progress.newHire.done} total={r.progress.newHire.total} size={76} stroke={4} delay={0.35} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={`/journeys/runs/${r.runId}`}
                    className="focus-ring truncate rounded-[4px] text-body-lg font-medium text-fg after:absolute after:inset-0 after:rounded-panel after:content-['']"
                    aria-label={`View ${r.subject.name}'s journey`}
                  >
                    {r.subject.name}
                  </Link>
                  <span className="truncate text-small text-muted">{r.subject.title ?? r.subject.department}</span>
                  <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                    {/* Green is a first day and nothing else: the chip turns green only on the day itself. */}
                    <span
                      className={cn(
                        "inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-caption font-medium",
                        complete
                          ? "bg-success-soft text-success-text"
                          : r.anchorDate === today
                            ? "cat-green shadow-cell"
                            : "bg-sunken text-fg dark:bg-surface/60",
                      )}
                    >
                      {r.anchorDate === today && !complete ? (
                        <PartyPopper className="size-3 stroke-[1.75]" aria-hidden />
                      ) : (
                        <CalendarDays className="size-3 stroke-[1.75] text-muted" aria-hidden />
                      )}
                      {complete ? "Completed" : runTimingLabel(r.anchorDate, today, r.kind)}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <TasksPill done={r.progress.newHire.done} total={r.progress.newHire.total} count size="sm" />
                {r.overdue ? (
                  <Badge tone="danger" dot size="sm">
                    <span className="tabular">{r.overdue}</span> overdue across everyone
                  </Badge>
                ) : complete ? null : (
                  <Badge tone="success" dot size="sm">
                    On track
                  </Badge>
                )}
                <span className="min-w-0 truncate text-caption text-muted">{r.journeyName}</span>
              </div>

              <div className="flex min-w-0 flex-col gap-0.5 rounded-cell bg-sunken px-3 py-2.5 dark:bg-surface/60">
                <span className="text-caption text-muted">Up next</span>
                {r.next ? (
                  <>
                    <span className="truncate text-small font-medium text-fg">{r.next.title}</span>
                    <span className={cn("truncate text-caption", late ? "text-danger-text" : "text-muted")}>
                      {dueLabel(r.next.dueDate, today)}
                      {r.next.assigneeName && r.next.assigneeName !== r.subject.name ? ` · ${r.next.assigneeName}` : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-small text-muted">Nothing left</span>
                )}
              </div>

              <div className="relative z-10 mt-auto flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2 text-small">
                {showManager && r.manager ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Avatar name={r.manager.name} seed={r.manager.id} src={r.manager.avatarUrl} size="sm" />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="text-caption text-muted">Manager</span>
                      <span className="truncate text-fg">{r.manager.name}</span>
                    </span>
                  </span>
                ) : null}
                {r.buddy ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Avatar name={r.buddy.name} seed={r.buddy.id} src={r.buddy.avatarUrl} size="sm" />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="text-caption text-muted">Buddy</span>
                      <span className="truncate text-fg">{r.buddy.name}</span>
                    </span>
                    {canAssignBuddy && !complete ? (
                      <Button variant="link" size="sm" className="ml-1 text-caption" onClick={() => setPicking(r)} aria-label={`Change ${r.subject.firstName}'s buddy`}>
                        Change
                      </Button>
                    ) : null}
                  </span>
                ) : r.needsBuddy && canAssignBuddy ? (
                  <Button variant="secondary" size="sm" onClick={() => setPicking(r)}>
                    <UserRoundPlus aria-hidden />
                    Assign a buddy
                  </Button>
                ) : (
                  <span className="text-caption text-muted">{r.needsBuddy ? "Buddy not chosen yet" : "No buddy needed"}</span>
                )}
                <ChevronRight className="ml-auto size-4 text-subtle transition-transform duration-160 group-hover/run:translate-x-0.5" aria-hidden />
              </div>
            </RevealItem>
          );
        })}
      </Reveal>
      )}
      {picking ? (
        <BuddyPicker
          runId={picking.runId}
          subject={{ id: picking.subject.id, name: picking.subject.name, firstName: picking.subject.firstName, department: picking.subject.department }}
          currentBuddyId={picking.buddy?.id ?? null}
          colleagues={colleagues}
          open={!!picking}
          onOpenChange={(o) => !o && setPicking(null)}
        />
      ) : null}
    </>
  );
}
