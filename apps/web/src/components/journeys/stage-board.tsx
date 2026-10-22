"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Flag, PartyPopper, Plane, UserRoundPlus } from "lucide-react";
import type { Colleague, RunRow } from "@lobby/core/journeys";
import { daysBetween, dueLabel, phaseFor, runTimingLabel, type Phase } from "@lobby/core/journeys/dates";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryBlock, type CategoryTone } from "@/components/ui/category-block";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { AvatarRing } from "./avatar-ring";
import { BuddyPicker } from "./buddy-picker";
import { TasksPill } from "./tasks-pill";

/** The onboarding stages, always drawn as columns so the board reads as a pipeline even when one is empty. */
const ONBOARDING: Phase[] = [
  { key: "before", label: "Before day 1", order: 0 },
  { key: "day-1", label: "Day 1", order: 1 },
  { key: "week-1", label: "Week 1", order: 2 },
  { key: "week-2", label: "Week 2", order: 3 },
  { key: "month-1", label: "Month 1", order: 4 },
];

function toneOf(key: string): CategoryTone {
  if (key === "day-1" || key === "last-day") return "green";
  if (key === "before" || key === "before-last-week") return "blue";
  return "violet";
}
function iconOf(key: string) {
  if (key === "day-1") return <PartyPopper />;
  if (key === "before") return <Plane />;
  if (key === "last-day" || key === "after") return <Flag />;
  return <CalendarDays />;
}

/**
 * Everyone on a journey as a board of stage columns (wave 3): where each person is in their first
 * month, read left to right. A column's head is a filled category block (blue before the start,
 * green on a first day, violet for the onboarding weeks); each person is a raised cell with their
 * face inside their own progress ring, their "0/16 tasks done" (their own steps), what is up next
 * and their buddy. On a phone the columns stack, and empty ones fold into one line.
 */
export function StageBoard({
  runs,
  today,
  colleagues,
  canAssignBuddy = true,
}: {
  runs: RunRow[];
  today: string;
  colleagues: Colleague[];
  canAssignBuddy?: boolean;
}) {
  const [picking, setPicking] = React.useState<RunRow | null>(null);

  const columns = React.useMemo(() => {
    const by = new Map<string, { phase: Phase; kind: RunRow["kind"]; runs: RunRow[] }>();
    for (const p of ONBOARDING) by.set(`onboarding:${p.key}`, { phase: p, kind: "onboarding", runs: [] });
    for (const r of runs) {
      const phase = r.status === "completed" ? { key: "done", label: "Completed", order: 99 } : phaseFor(daysBetween(r.anchorDate, today), r.kind);
      const k = `${r.kind}:${phase.key}`;
      const col = by.get(k) ?? { phase, kind: r.kind, runs: [] };
      col.runs.push(r);
      by.set(k, col);
    }
    return [...by.values()].sort((a, b) => (a.kind === b.kind ? a.phase.order - b.phase.order : a.kind === "onboarding" ? -1 : 1));
  }, [runs, today]);
  const empty = columns.filter((c) => !c.runs.length);

  return (
    <>
      <section aria-label="Everyone by stage" className="flex flex-col gap-3">
        <div
          className="grid gap-3 max-lg:!grid-cols-1"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {columns.map((c) => (
            <section
              key={`${c.kind}:${c.phase.key}`}
              aria-label={`${c.phase.label}, ${c.runs.length} ${c.runs.length === 1 ? "person" : "people"}`}
              className={cn("flex min-w-0 flex-col gap-3 rounded-panel bg-sunken/70 p-2 dark:bg-sunken/60", !c.runs.length && "max-lg:hidden")}
            >
              {!c.runs.length ? (
                // The same stage colour, turned down: nobody is here today, but it is still that stage.
                <div className="opacity-55 saturate-[0.7]">
                  <CategoryBlock size="md" tone={toneOf(c.phase.key)} icon={iconOf(c.phase.key)} title={c.phase.label} status="0" className="min-w-0 shadow-none" />
                </div>
              ) : (
              <CategoryBlock
                size="md"
                tone={c.phase.key === "done" ? "green" : toneOf(c.phase.key)}
                icon={iconOf(c.phase.key)}
                title={c.phase.label}
                subtitle={c.kind === "offboarding" ? "Offboarding" : undefined}
                status={String(c.runs.length)}
                className="min-w-0"
              />
              )}
              {c.runs.length ? (
                <Reveal className="flex flex-col gap-3" stagger={0.06}>
                  {c.runs.map((r) => (
                    <RevealItem key={r.runId} from="up">
                      <PersonCard r={r} today={today} canAssignBuddy={canAssignBuddy} onPick={() => setPicking(r)} tone={c.phase.key === "done" ? "green" : toneOf(c.phase.key)} />
                    </RevealItem>
                  ))}
                </Reveal>
              ) : (
                <p className="flex min-h-24 items-center justify-center rounded-card border border-dashed border-border-strong px-3 text-center text-small text-muted">Nobody in this stage today</p>
              )}
            </section>
          ))}
        </div>
        {empty.length ? (
          <p className="text-small text-muted lg:hidden">Nobody is in {empty.map((c) => c.phase.label).join(", ")} right now.</p>
        ) : null}
      </section>
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

const NEXT_TINT: Record<CategoryTone, string> = {
  blue: "bg-cat-blue-soft text-cat-blue-text",
  green: "bg-cat-green-soft text-cat-green-text",
  violet: "bg-cat-violet-soft text-cat-violet-text",
  amber: "bg-cat-amber-soft text-cat-amber-text",
  coral: "bg-cat-coral-soft text-cat-coral-text",
  teal: "bg-cat-teal-soft text-cat-teal-text",
};

function PersonCard({ r, today, canAssignBuddy, onPick, tone }: { r: RunRow; today: string; canAssignBuddy: boolean; onPick: () => void; tone: CategoryTone }) {
  const complete = r.status === "completed";
  const late = !!r.next && r.next.dueDate < today;
  const mine = r.progress.newHire;
  return (
    <article className="group/run cell relative isolate flex min-w-0 flex-col gap-3 rounded-card p-3.5 transition-shadow duration-160 hover:shadow-cell-hover">
      <SpotlightLayer />
      <div className="flex min-w-0 items-center gap-3">
        <AvatarRing person={r.subject} done={mine.done} total={mine.total} size={56} stroke={3.5} delay={0.3} />
        <div className="flex min-w-0 flex-col">
          <Link
            href={`/journeys/runs/${r.runId}`}
            className="focus-ring truncate rounded-[4px] text-row font-medium text-fg after:absolute after:inset-0 after:rounded-card after:content-['']"
            aria-label={`View ${r.subject.name}'s journey`}
          >
            {r.subject.name}
          </Link>
          <span className="truncate text-caption text-muted">{complete ? "Completed" : runTimingLabel(r.anchorDate, today, r.kind)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <TasksPill done={mine.done} total={mine.total} count size="sm" />
        {r.overdue ? (
          <Badge tone="danger" dot size="sm">
            <span className="tabular">{r.overdue}</span> overdue across everyone
          </Badge>
        ) : null}
      </div>
      {r.next ? (
        <div className={cn("flex min-w-0 flex-col rounded-cell px-3 py-2", NEXT_TINT[tone])}>
          <span className="text-caption font-medium">Up next</span>
          <span className="line-clamp-2 text-small font-medium text-fg">{r.next.title}</span>
          <span className={cn("truncate text-caption", late ? "font-medium text-danger-text" : "text-muted")}>{dueLabel(r.next.dueDate, today)}</span>
        </div>
      ) : null}
      <div className="relative z-10 flex min-h-8 items-center gap-2">
        {r.buddy ? (
          <span className="flex min-w-0 items-center gap-2 text-caption text-muted">
            <Avatar name={r.buddy.name} seed={r.buddy.id} src={r.buddy.avatarUrl} size="sm" />
            <span className="truncate">Buddy {r.buddy.firstName}</span>
          </span>
        ) : r.needsBuddy && canAssignBuddy && !complete ? (
          <Button variant="secondary" size="sm" onClick={onPick}>
            <UserRoundPlus aria-hidden />
            Assign a buddy
          </Button>
        ) : null}
      </div>
    </article>
  );
}
