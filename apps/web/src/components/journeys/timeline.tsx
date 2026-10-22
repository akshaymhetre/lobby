"use client";

import * as React from "react";
import { CalendarDays, Check, ChevronDown, ChevronUp, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Colleague } from "@lobby/core/journeys";
import { daysBetween, formatDay, type Phase } from "@lobby/core/journeys/dates";
import type { AppIconData } from "@/components/apps/app-icon";
import { AnimatedBeam } from "@/components/ui/effects/animated-beam";
import { cn } from "@/lib/cn";
import styles from "./timeline.module.css";
import { BuddyPicker } from "./buddy-picker";
import { StepCard, type StepCardData } from "./step-card";
import { StepIcon } from "./step-icon";

export type TimelineEntry = StepCardData & { phase: Phase; journeyName?: string };

interface TimelineProps {
  steps: TimelineEntry[];
  today: string;
  mode: "navigator" | "detail";
  appIcons?: Record<string, AppIconData>;
  viewerIsSubject?: boolean;
  /** The viewer's display name, so their own completions read "Done Thu 15 Oct" without "by <them>". */
  viewerName?: string;
  subject: { id: string; name: string; firstName: string; department?: string | null };
  /** Show which journey each step comes from (when a person has more than one). */
  showJourney?: boolean;
  /** When set, buddy steps waiting for a buddy offer "Assign a buddy". */
  buddy?: { runId: string; currentBuddyId: string | null; colleagues: Colleague[] } | null;
}

function dateRange(steps: TimelineEntry[]) {
  const dates = steps.map((s) => s.dueDate).sort();
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  return first === last ? formatDay(first) : `${formatDay(first)} to ${formatDay(last)}`;
}

/** The first-day phase (Day 1 / Last day) is the one drawn in the first-day green. */
const ANCHOR_PHASES = new Set(["day-1", "last-day"]);

/**
 * The journey timeline: steps grouped under day markers (Before day 1, Day 1, Week 1...), each
 * marker showing its dates and how much of it is done. Today is printed on the line itself in the
 * vivid "now" blue, so the reader always knows where on the calendar they stand.
 *
 * Colour means something here and nowhere else: violet is an onboarding step (the discs on the
 * spine and the current phase), green is the first day (the Day 1 marker), blue is today, and red
 * is only ever "overdue". Finished steps collapse to rows; the open ones keep their cell.
 */
export function Timeline({ steps, today, mode, appIcons, viewerIsSubject, viewerName, subject, showJourney, buddy }: TimelineProps) {
  const [buddyOpen, setBuddyOpen] = React.useState(false);
  const groups = React.useMemo(() => {
    const map = new Map<string, { phase: Phase; steps: TimelineEntry[] }>();
    for (const st of steps) {
      const g = map.get(st.phase.key) ?? { phase: st.phase, steps: [] };
      g.steps.push(st);
      map.set(st.phase.key, g);
    }
    return [...map.values()].sort((a, b) => a.phase.order - b.phase.order);
  }, [steps]);

  /* Where "Today" sits: before the first step due today or later; after everything when all is past. */
  const todayAt = React.useMemo(() => {
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi]!;
      for (let si = 0; si < g.steps.length; si++) {
        if (daysBetween(today, g.steps[si]!.dueDate) >= 0) return { gi, si };
      }
    }
    return { gi: groups.length, si: 0 };
  }, [groups, today]);

  const currentKey = React.useMemo(() => {
    // The phase "you are in": the last phase whose first date is on or before today.
    let key: string | undefined;
    for (const g of groups) {
      const first = g.steps.map((s) => s.dueDate).sort()[0]!;
      if (daysBetween(first, today) >= 0) key = g.phase.key;
    }
    return key ?? groups[0]?.phase.key;
  }, [groups, today]);

  const nextId = React.useMemo(() => (viewerIsSubject ? steps.find((s) => s.status === "pending")?.id : undefined), [steps, viewerIsSubject]);

  // The light that runs down the spine once, on first view: from the start of the journey,
  // through today, to the step that is up next (the new hire's progress and where to go on). For
  // a reader who is not the subject it stops at today. On day 1, with nothing behind today, it
  // starts at the today marker. When there is nowhere to run, nothing runs.
  const listRef = React.useRef<HTMLOListElement>(null);
  const startRef = React.useRef<HTMLSpanElement>(null);
  const todayRef = React.useRef<HTMLSpanElement>(null);
  const nextRef = React.useRef<HTMLSpanElement>(null);
  const todayFirst = todayAt.gi === 0 && todayAt.si === 0;
  const hasProgress = groups.length > 0 && (nextId !== undefined || !todayFirst);
  // The "Up next" cell pulses once the light arrives (the beam reports its end).
  const [arrived, setArrived] = React.useState(false);

  // Wave 3: only the stage you are in stays open. Later stages (and finished earlier ones) fold
  // into stage tiles; a tile opens its stage in place. A link to a step or a stage opens it too.
  const curIndex = groups.findIndex((x) => x.phase.key === currentKey);
  const [opened, setOpened] = React.useState<Set<string>>(() => new Set());
  const isCollapsed = (gi: number) => {
    const g = groups[gi]!;
    if (opened.has(g.phase.key)) return false;
    if (gi > curIndex) return true;
    if (gi < curIndex) return g.steps.every((s) => s.status !== "pending");
    return false;
  };
  const openStage = (key: string) => setOpened((prev) => new Set(prev).add(key));
  const closeStage = (key: string) =>
    setOpened((prev) => {
      const n = new Set(prev);
      n.delete(key);
      return n;
    });
  React.useEffect(() => {
    const onHash = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      if (!h) return;
      const g = groups.find((x) => `phase-${x.phase.key}` === h || x.steps.some((st) => `step-${st.id}` === h));
      if (!g) return;
      setOpened((prev) => (prev.has(g.phase.key) ? prev : new Set(prev).add(g.phase.key)));
      // Once the stage has rendered open, land on the target.
      requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView({ block: "start" })));
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [groups]);

  const marker = <TodayMarker date={today} dotRef={todayRef} />;
  const insetMarker = <TodayMarker date={today} inset dotRef={todayRef} />;

  const renderGroup = (g: (typeof groups)[number], gi: number) => {
          // Stages more than one past the one you are in read as a short list: title, date, tick.
          const far = curIndex >= 0 && gi > curIndex + 1;
          const done = g.steps.filter((s) => s.status !== "pending").length;
          const allDone = done === g.steps.length;
          const isCurrent = g.phase.key === currentKey && !allDone;
          const isAnchor = ANCHOR_PHASES.has(g.phase.key);
          return (
            <React.Fragment key={g.phase.key}>
              {todayAt.gi === gi && todayAt.si === 0 ? marker : null}
              <li className="relative" aria-labelledby={`phase-${g.phase.key}`}>
                {isCurrent ? (
                  // The stage you are in: a filled category block (green on the first day, violet for
                  // any other onboarding stage), the page's one coloured header.
                  <div
                    className={cn(
                      isAnchor ? "cat-green" : "cat-violet",
                      "relative isolate mb-4 flex min-h-16 items-center gap-3 overflow-hidden rounded-card p-2.5 pr-4",
                      "shadow-[inset_0_1px_0_rgb(255_255_255/0.32),0_12px_26px_-14px_var(--lb-cat-violet-from)]",
                      isAnchor && "shadow-[inset_0_1px_0_rgb(255_255_255/0.32),0_12px_26px_-14px_var(--lb-cat-green-from)]",
                    )}
                  >
                    <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(255_255_255/0.22),transparent_55%)]" />
                    <span
                      ref={gi === 0 ? startRef : undefined}
                      className="relative z-10 ml-px inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/35 backdrop-blur-sm [&_svg]:size-4 [&_svg]:stroke-[1.75]"
                      aria-hidden
                    >
                      {isAnchor ? <PartyPopper /> : <CalendarDays />}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h2 id={`phase-${g.phase.key}`} className="scroll-mt-24 text-h3 font-medium">
                        {g.phase.label}
                        {isAnchor && mode === "navigator" ? <span className="font-normal opacity-90">, your first day</span> : null}
                      </h2>
                      <span className="tabular text-caption opacity-90">{dateRange(g.steps)}</span>
                    </div>
                    <span className="tabular inline-flex h-7 shrink-0 items-center rounded-full bg-white/95 px-3 text-small font-medium shadow-[0_1px_2px_rgb(0_0_0/0.12)]" style={{ color: isAnchor ? "var(--lb-cat-green-to)" : "var(--lb-cat-violet-to)" }}>
                      {done} of {g.steps.length} done{mode === "detail" ? ", everyone" : ""}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pb-3">
                    <span
                      ref={gi === 0 ? startRef : undefined}
                      className={cn(
                        "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4 [&_svg]:stroke-[2]",
                        allDone ? "bg-success-soft text-success-text" : isAnchor ? "cat-green shadow-cell" : "cell text-muted",
                      )}
                      aria-hidden
                    >
                      {allDone ? <Check /> : isAnchor ? <PartyPopper className="stroke-[1.75]" /> : <span className="size-1.5 rounded-full bg-current" />}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <h2 id={`phase-${g.phase.key}`} className="scroll-mt-24 text-h3 font-medium text-fg">
                        {g.phase.label}
                      </h2>
                      <span className="tabular text-small text-muted">{dateRange(g.steps)}</span>
                    </div>
                    <span className="tabular shrink-0 text-small text-muted">
                      {done} of {g.steps.length}
                      {mode === "detail" ? <span className="max-sm:hidden"> across everyone</span> : null}
                    </span>
                    {opened.has(g.phase.key) ? (
                      <Button variant="ghost" size="sm" onClick={() => closeStage(g.phase.key)} aria-label={`Fold ${g.phase.label}`}>
                        <ChevronUp aria-hidden />
                        Fold
                      </Button>
                    ) : null}
                  </div>
                )}

                <ol className={cn("relative flex flex-col pl-11", far ? "gap-1.5" : "gap-2.5")}>
                  <span aria-hidden className="absolute bottom-0 left-[15px] top-[-12px] w-px bg-border" />
                  {g.steps.map((st, si) => {
                    const isDone = st.status !== "pending";
                    const isNext = st.id === nextId;
                    return (
                      <React.Fragment key={st.id}>
                        {todayAt.gi === gi && todayAt.si === si && si > 0 ? insetMarker : null}
                        <li className={cn("relative", isNext && arrived && styles.arrive)}>
                          <span
                            ref={isNext ? nextRef : undefined}
                            aria-hidden
                            className={cn(
                              "absolute left-[-40px] z-10 inline-flex size-6 items-center justify-center rounded-full [&_svg]:size-3 [&_svg]:stroke-[1.75]",
                              isDone ? "top-2.5" : far && !st.overdue ? "top-3" : "top-4",
                              isDone
                                ? "bg-success-soft text-success-text"
                                : st.overdue
                                  ? "bg-danger-soft text-danger-text"
                                  : isNext
                                    ? "cat-violet shadow-cell [&_svg]:stroke-[2]"
                                    : "bg-cat-violet-soft text-cat-violet-text",
                            )}
                          >
                            {isDone ? <Check /> : <StepIcon type={st.type} />}
                          </span>
                          {showJourney && st.journeyName ? (
                            <span className="sr-only">From {st.journeyName}</span>
                          ) : null}
                          <StepCard
                            step={st}
                            today={today}
                            mode={mode}
                            appIcons={appIcons}
                            viewerIsSubject={viewerIsSubject}
                            viewerName={viewerName}
                            subjectFirstName={subject.firstName}
                            journeyName={undefined}
                            onAssignBuddy={buddy ? () => setBuddyOpen(true) : undefined}
                            isNext={isNext}
                            filled={isNext && mode === "navigator"}
                            compact={far && !st.overdue}
                          />
                        </li>
                      </React.Fragment>
                    );
                  })}
                </ol>
              </li>
            </React.Fragment>
          );
        };

  return (
    <>
      <ol ref={listRef} className="relative flex flex-col gap-9" aria-label="Timeline">
        {hasProgress ? (
          <AnimatedBeam
            containerRef={listRef}
            fromRef={todayFirst ? todayRef : startRef}
            toRef={nextId !== undefined ? nextRef : todayRef}
            tone="now"
            quiet={false}
            draw="with"
            repeat={1}
            delay={0.35}
            width={1.5}
            className="z-[1]"
            onSparkEnd={() => setArrived(true)}
          />
        ) : null}
        {(() => {
          const out: React.ReactNode[] = [];
          let batch: number[] = [];
          const flush = () => {
            if (!batch.length) return;
            const idx = batch;
            batch = [];
            out.push(
              <StageTiles
                key={`tiles-${idx[0]}`}
                stages={idx.map((gi) => ({ gi, phase: groups[gi]!.phase, steps: groups[gi]!.steps, anchor: ANCHOR_PHASES.has(groups[gi]!.phase.key) }))}
                startRef={idx[0] === 0 ? startRef : undefined}
                marker={idx.includes(todayAt.gi) ? marker : null}
                markerAt={todayAt.gi}
                onOpen={openStage}
                everyone={mode === "detail"}
              />,
            );
          };
          groups.forEach((g, gi) => {
            if (isCollapsed(gi)) {
              batch.push(gi);
              return;
            }
            flush();
            out.push(renderGroup(g, gi));
          });
          flush();
          return out;
        })()}
        {todayAt.gi >= groups.length ? marker : null}
      </ol>
      {buddy ? (
        <BuddyPicker
          runId={buddy.runId}
          subject={subject}
          currentBuddyId={buddy.currentBuddyId}
          colleagues={buddy.colleagues}
          open={buddyOpen}
          onOpenChange={setBuddyOpen}
        />
      ) : null}
    </>
  );
}

/**
 * The dateline printed on the timeline: a "now" blue dot on the line, "TODAY · THU 15 OCT" in the
 * caption capitals, and a dashed rule across in the same blue as the planner's today line. Works
 * as a list item at either level: between phases (the outer list, where the dot sits in the 32px
 * marker column) and between steps (the inner list, where it sits on the 24px bullet column).
 */
function TodayMarker({ date, inset = false, dotRef }: { date: string; inset?: boolean; dotRef?: React.Ref<HTMLSpanElement> }) {
  return (
    <li className="relative flex min-h-8 items-center gap-3" aria-label={`Today, ${formatDay(date)}`}>
      <span
        className={cn(
          "relative z-10 inline-flex shrink-0 items-center justify-center",
          inset ? "ml-[-40px] size-6" : "size-8",
        )}
      >
        <span ref={dotRef} className="now-dot size-3" aria-hidden />
      </span>
      <span className={cn("tabular inline-flex h-7 items-center whitespace-nowrap rounded-full bg-now px-3 text-small font-medium text-now-fg shadow-cell", inset && "ml-1")}>
        Today, {formatDay(date)}
      </span>
      {/* The lit now rail, laid flat: the same glowing blue as the planner's today line. */}
      <span className="now-rail-x h-0.5 min-w-6 flex-1" aria-hidden />
    </li>
  );
}

/**
 * Later stages, folded: one raised tile per stage (its name, dates, how much is done and its first
 * steps), side by side, so the month reads as a short strip instead of a 3,000px checklist. A tile
 * opens its stage in place. Finished earlier stages fold the same way.
 */
function StageTiles({
  stages,
  startRef,
  marker,
  markerAt,
  onOpen,
  everyone = false,
}: {
  /** The counts include other people's steps (a manager's view), so say so. */
  everyone?: boolean;
  stages: { gi: number; phase: Phase; steps: TimelineEntry[]; anchor: boolean }[];
  startRef?: React.Ref<HTMLSpanElement>;
  marker: React.ReactNode;
  markerAt: number;
  onOpen: (key: string) => void;
}) {
  const before = marker && stages[0]!.gi === markerAt ? marker : null;
  const after = marker && !before ? marker : null;
  return (
    <>
      {before}
      <li className="relative flex flex-wrap items-center gap-2 pl-11">
        <span className="mr-1 text-small text-muted">Later</span>
        <ul className="contents" aria-label="Later stages">
          {stages.map(({ phase, steps, anchor }, i) => {
            const done = steps.filter((s) => s.status !== "pending").length;
            const allDone = done === steps.length;
            const late = steps.some((s) => s.status === "pending" && s.overdue);
            return (
              <li key={phase.key} id={`phase-${phase.key}`} className="scroll-mt-24">
                {/* Folded stage: one pill. The strip at the top of the page opens the same stage. */}
                <button
                  type="button"
                  onClick={() => onOpen(phase.key)}
                  aria-expanded={false}
                  aria-label={`${phase.label}, ${dateRange(steps)}, ${done} of ${steps.length} done${everyone ? " across everyone" : ""}. Show its steps`}
                  className="cell focus-ring press group/tile inline-flex h-11 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-small hover:shadow-cell-hover"
                >
                  <span
                    ref={i === 0 ? startRef : undefined}
                    aria-hidden
                    className={cn(
                      "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4 [&_svg]:stroke-[2]",
                      allDone ? "bg-success-soft text-success-text" : anchor ? "cat-green" : "bg-cat-violet-soft text-cat-violet-text",
                    )}
                  >
                    {allDone ? <Check /> : anchor ? <PartyPopper className="stroke-[1.75]" /> : <CalendarDays className="stroke-[1.75]" />}
                  </span>
                  <span className="font-medium text-fg">{phase.label}</span>
                  <span className={cn("tabular", late ? "font-medium text-danger-text" : "text-muted")}>
                    {done}/{steps.length}
                    {everyone ? " everyone" : ""}
                  </span>
                  <ChevronDown className="size-4 text-muted transition-transform duration-160 group-hover/tile:translate-y-0.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </li>
      {after}
    </>
  );
}
