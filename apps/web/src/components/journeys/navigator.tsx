import { Check, MessageCircle, Wrench } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { CellList, RowCell } from "@/components/ui/cells";
import { HeroLight } from "@/components/ui/hero-light";
import type { RunView } from "@lobby/core/journeys";
import { daysBetween, formatDay, journeyDayLabel } from "@lobby/core/journeys/dates";
import type { AppIconData } from "@/components/apps/app-icon";
import { Masthead, MastheadLink } from "@/components/ui/masthead";
import { Progress } from "@/components/ui/progress";
import { AvatarRing } from "./avatar-ring";
import { PendingPersonCell, PersonCell } from "./person-cell";
import { PhaseTrack } from "./phase-track";
import { buildTrack } from "./track";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { TasksPill } from "./tasks-pill";
import { Timeline, type TimelineEntry } from "./timeline";

/**
 * The new hire's front page for their first month. The masthead carries where they are
 * ("You start tomorrow") and what is theirs to do, as accent links; the timeline is the lead,
 * first in the DOM so a phone shows their day before anyone else's tasks; the rail holds them
 * (a person cell with their "3/16 tasks done" pill), their people, what is being prepared for
 * them, and their journeys. The one authored moment is the light that runs down the spine.
 */
export function Navigator({
  runs,
  companyName,
  appIcons,
  viewerName,
  tabs,
}: {
  runs: RunView[];
  companyName: string;
  appIcons: Record<string, AppIconData>;
  /** The viewer's display name, for "Done Thu 15 Oct" without "by <them>". */
  viewerName?: string;
  /** The view tabs, rendered inside the masthead. */
  tabs?: React.ReactNode;
}) {
  const primary = runs[0]!;
  const { subject, manager, buddy, today } = primary;
  const kind = primary.journey.kind;
  const multi = runs.length > 1;

  const mine: TimelineEntry[] = runs
    .flatMap((r) =>
      r.steps.filter((s) => s.forSubject).map((s) => ({ ...s, journeyName: r.journey.name })),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.position - b.position);
  const others = runs
    .flatMap((r) => r.steps.filter((s) => !s.forSubject))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.position - b.position);

  const done = mine.filter((s) => s.status !== "pending").length;
  const total = mine.length;
  const pending = mine.filter((s) => s.status === "pending");
  const overdue = pending.filter((s) => s.overdue);
  const dueToday = pending.filter((s) => s.dueToday);
  const firstPending = pending[0];
  const dueWithFirst = firstPending ? pending.filter((s) => s.dueDate === firstPending.dueDate) : [];
  const othersDone = others.filter((o) => o.status !== "pending").length;

  const dayLabel = journeyDayLabel(primary.run.anchorDate, today, kind);
  const title = kind === "offboarding" ? "Your last weeks" : "Your first month";
  const anchorLabel = kind === "offboarding" ? "Last day" : "First day";
  const anchorDate = kind === "offboarding" ? (subject.endDate ?? primary.run.anchorDate) : (subject.startDate ?? primary.run.anchorDate);
  const greeting = kind === "offboarding" ? title : `Welcome aboard, ${subject.firstName}`;
  const track = buildTrack(mine, today, firstPending?.id);
  const phasesLeft = track.phases.filter((p) => p.done < p.dots.length).length;
  const monthLine =
    total === 0
      ? "Your steps will appear here."
      : done === total
        ? "Every step is done."
        : `${total - done} steps to go across ${phasesLeft} ${phasesLeft === 1 ? "stage" : "stages"}. Pick a stage to jump to it.`;

  /* One sentence of facts; the parts that are for the reader are accent links to the step. */
  const todayLine = (
    <>
      {dayLabel}.{" "}
      {total === 0 ? (
        "Nothing for you to do yet."
      ) : done === total ? (
        "Every step is done. Nicely handled."
      ) : (
        <>
          {done} of {total} steps done
          {overdue.length ? (
            <>
              , <MastheadLink href={`#step-${overdue[0]!.id}`}>{overdue.length} overdue</MastheadLink>
            </>
          ) : null}
          {dueToday.length ? (
            <>
              , <MastheadLink href={`#step-${dueToday[0]!.id}`}>{dueToday.length} due today</MastheadLink>
            </>
          ) : null}
          {!overdue.length && !dueToday.length && firstPending ? (
            <>
              , <MastheadLink href={`#step-${firstPending.id}`}>{dueWithFirst.length} due {whenWord(firstPending.dueDate, today)}</MastheadLink>
            </>
          ) : null}
          .
        </>
      )}
    </>
  );

  return (
    <>
      <Masthead title={greeting} company={companyName} today={todayLine}>
        {tabs}
      </Masthead>

      {/* The hero: the whole month as one picture. Their face in their progress, every step a dot. */}
      <section
        aria-labelledby="month-heading"
        className="panel relative isolate mb-10 grid gap-6 overflow-hidden rounded-panel p-4 sm:p-6 lg:mb-12 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8"
      >
        {/* Violet: this is an onboarding journey, lit from behind the new hire's face. */}
        <HeroLight tone={kind === "offboarding" ? "blue" : "violet"} position="top-left" />
        <div className="flex items-center gap-4 lg:flex-col lg:justify-center lg:gap-3 lg:text-center">
          <AvatarRing person={subject} done={done} total={total} size={112} className="max-sm:size-[88px]" />
          <div className="flex min-w-0 flex-col gap-2 lg:items-center">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-h3 font-medium text-fg">{subject.name}</span>
              <span className="truncate text-small text-muted">{subject.title ?? (kind === "offboarding" ? "Leaving soon" : "New joiner")}</span>
            </div>
            <TasksPill done={done} total={total} count className="self-start lg:self-center" />
            <span className="text-caption text-muted">
              {anchorLabel} <span className="tabular text-fg">{formatDay(anchorDate)}</span>
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 id="month-heading" className="text-h2 font-medium text-fg md:text-hero">
                {title}
              </h2>
              <p className="text-body text-muted">{monthLine}</p>
            </div>
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted" aria-label="Key">
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-cat-violet" aria-hidden />
                Onboarding step
              </li>
              {kind === "onboarding" ? (
                <li className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-cat-green" aria-hidden />
                  First day
                </li>
              ) : null}
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-fg/45" aria-hidden />
                Done
              </li>
            </ul>
          </div>
          <PhaseTrack track={track} today={today} label={`${title}, phase by phase`} linkPhases />
        </div>
      </section>

      {/* On a phone, the two people a new hire needs come straight after the hero, not after every step. */}
      {manager || buddy ? (
        <section aria-label="Your people" className="-mt-4 mb-8 lg:hidden">
          <ul className="grid grid-cols-2 gap-2">
            {manager ? <PersonCell person={manager} role="Your manager" footer={<SayHi />} /> : null}
            {buddy ? <PersonCell person={buddy} role="Your buddy" footer={<SayHi />} /> : null}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <section aria-label="Your timeline" className="min-w-0">
          {mine.length ? (
            <Timeline
              steps={mine}
              today={today}
              mode="navigator"
              appIcons={appIcons}
              viewerIsSubject
              viewerName={viewerName}
              subject={{ id: subject.id, name: subject.name, firstName: subject.firstName }}
              showJourney={multi}
            />
          ) : (
            <p className="text-body text-muted">Your steps will appear here.</p>
          )}
        </section>

        <aside className="flex flex-col gap-8" aria-label="Your people and preparation">
          <Section tone="quiet" title="Your people" className={manager || buddy ? "max-lg:hidden" : undefined}>
            <ul className="grid grid-cols-2 gap-2">
              {manager ? <PersonCell person={manager} role="Your manager" footer={<SayHi />} /> : null}
              {buddy ? (
                <PersonCell person={buddy} role="Your buddy" footer={<SayHi />} />
              ) : kind === "onboarding" && primary.hasBuddySteps ? (
                <PendingPersonCell role="Your buddy" note={manager ? `${manager.firstName} is picking someone` : "Being picked for you"} />
              ) : null}
            </ul>
          </Section>

          {others.length ? (
            <Section
              id="getting-ready"
              tone="quiet"
              collapsible
              summary={`${othersDone} of ${others.length} done by the people setting you up`}
              title={kind === "offboarding" ? "Being handled for you" : "Getting ready for you"}
              description={`${othersDone} of ${others.length} done by the people setting you up`}
            >
              <CellList density="compact">
                {others.map((o) => {
                  const isDone = o.status !== "pending";
                  const who =
                    o.assignee.person?.firstName ??
                    (o.assignee.team === "it" ? "IT" : o.assignee.team === "people" ? "People team" : o.assignee.label);
                  return (
                    <RowCell
                      key={o.id}
                      leading={
                        o.assignee.person && !isDone ? (
                          <Avatar name={o.assignee.person.name} seed={o.assignee.person.id} src={o.assignee.person.avatarUrl} size="md" aria-hidden />
                        ) : (
                          <span
                            className={cn(
                              "inline-flex size-8 items-center justify-center rounded-full",
                              isDone ? "bg-success-soft text-success-text" : "bg-cat-blue-soft text-cat-blue-text",
                            )}
                            aria-hidden
                          >
                            {isDone ? <Check className="size-4 stroke-[2.25]" /> : <Wrench className="size-4 stroke-[1.75]" />}
                          </span>
                        )
                      }
                      title={<span className={isDone ? "text-muted line-through decoration-border-strong" : undefined}>{o.title}</span>}
                      meta={
                        isDone ? (
                          "Done"
                        ) : (
                          <span className="truncate">
                            {o.assignee.awaitingBuddy ? "Your buddy" : who}, {daysBetween(o.dueDate, today) > 0 ? "in progress" : `by ${formatDay(o.dueDate)}`}
                          </span>
                        )
                      }
                    />
                  );
                })}
              </CellList>
            </Section>
          ) : null}

          {multi ? (
            <Section id="your-journeys" tone="quiet" title="Your journeys" collapsible summary={`${runs.length} journeys, ${done} of ${total} of your steps done`}>
              <ul className="flex flex-col gap-3">
                {runs.map((r) => {
                  const own = r.steps.filter((s) => s.forSubject);
                  const d = own.filter((s) => s.status !== "pending").length;
                  return (
                    <li key={r.run.id} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-small">
                        <span className="truncate font-medium text-fg">{r.journey.name}</span>
                        <span className="tabular shrink-0 text-muted">
                          {d} of {own.length}
                        </span>
                      </div>
                      <Progress value={d} max={Math.max(1, own.length)} size="sm" aria-label={`${r.journey.name} progress`} />
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}
        </aside>
      </div>
    </>
  );
}

/** "today", "tomorrow", "Mon 19 Oct": the tail of "3 due ...". */
function whenWord(date: string, today: string) {
  const d = daysBetween(today, date);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return formatDay(date);
}

/** The quiet "Say hi" pill at the foot of a person cell; the cell's name link carries the action. */
function SayHi() {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-sunken px-2.5 text-caption font-medium text-fg transition-colors duration-160 group-hover/person:bg-accent-soft group-hover/person:text-accent-text" aria-hidden>
      <MessageCircle className="size-3.5 stroke-[1.75]" />
      Say hi
    </span>
  );
}
