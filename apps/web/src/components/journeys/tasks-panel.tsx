"use client";

import * as React from "react";
import { CheckCheck, UserRoundPlus } from "lucide-react";
import type { Colleague, TasksView } from "@lobby/core/journeys";
import { addDays, runTimingLabel } from "@lobby/core/journeys/dates";
import type { AppIconData } from "@/components/apps/app-icon";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { BuddyPicker } from "./buddy-picker";
import { StepCard } from "./step-card";
import { PhaseTrack } from "./phase-track";
import type { Track } from "./track";
import { WeekStrip } from "./week-strip";

type Item = TasksView["items"][number];

/**
 * "Your tasks": every step you own in someone else's journey, grouped by when it is due, each
 * group a panel of rows, under the "Your week" planner. The authored moment is the planner's
 * build; late steps are the strongest fill on the page.
 */
export function TasksPanel({
  view,
  colleagues,
  appIcons,
  viewerName,
}: {
  view: TasksView;
  colleagues: Colleague[];
  appIcons: Record<string, AppIconData>;
  /** The viewer's display name, so their own completions do not read "by <them>". */
  viewerName?: string;
}) {
  const [buddyFor, setBuddyFor] = React.useState<TasksView["buddyNeeded"][number] | null>(null);
  const { today } = view;
  const weekEnd = addDays(today, 7);
  const pending = view.items.filter((i) => i.status === "pending");
  const groups: { key: string; label: string; items: Item[]; tone?: "danger" | "now" }[] = [
    { key: "overdue", label: "Overdue", items: pending.filter((i) => i.dueDate < today), tone: "danger" },
    { key: "today", label: "Today", items: pending.filter((i) => i.dueDate === today), tone: "now" },
    { key: "week", label: "Next 7 days", items: pending.filter((i) => i.dueDate > today && i.dueDate <= weekEnd) },
    { key: "later", label: "Later", items: pending.filter((i) => i.dueDate > weekEnd) },
    { key: "done", label: "Done this week", items: view.items.filter((i) => i.status !== "pending") },
  ].filter((g) => g.items.length) as { key: string; label: string; items: Item[]; tone?: "danger" | "now" }[];

  if (!view.items.length && !view.buddyNeeded.length) return <NothingOnYourPlate today={today} />;

  return (
    <div className="section-stack">
      {pending.length ? <WeekStrip items={view.items} today={today} /> : null}
      {view.buddyNeeded.length ? (
        <Section title="Pick a buddy" as="h2">
          <ul className="flex flex-col gap-3">
            {view.buddyNeeded.map((b) => (
              <li key={b.runId} className="cell flex min-h-16 items-center gap-3 rounded-card px-3 py-2 sm:px-4">
                <Avatar name={b.subject.name} seed={b.subject.id} src={b.subject.avatarUrl} size="md" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-row font-medium text-fg">{b.subject.name}</span>
                  <span className="truncate text-small text-muted">
                    {runTimingLabel(b.anchorDate, today)}, and their buddy steps are waiting
                  </span>
                </div>
                <Button size="sm" onClick={() => setBuddyFor(b)}>
                  <UserRoundPlus aria-hidden />
                  Pick
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {groups.map((g) => (
        <Section
          key={g.key}
          title={
            <span className="inline-flex items-center gap-2">
              {g.label}
              {g.tone === "danger" ? (
                <Badge tone="danger" dot>
                  <span className="tabular">{g.items.length}</span>
                </Badge>
              ) : g.tone === "now" ? (
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-now-soft px-2.5 text-caption font-medium text-now-text">
                  <span className="size-1.5 rounded-full bg-now" aria-hidden />
                  <span className="tabular">{g.items.length}</span>
                </span>
              ) : null}
            </span>
          }
          count={g.tone ? undefined : g.items.length}
        >
          {/* Open steps are separate raised cells; finished ones sit in one quiet well. */}
          <div className={cn("relative isolate", g.key === "done" ? "rounded-card bg-surface/60 px-3 sm:px-4" : "flex flex-col gap-3")}>
            {g.items.map((i) => (
              <StepCard
                key={i.id}
                mode="task"
                today={today}
                appIcons={appIcons}
                forPerson={i.subject}
                journeyName={i.journeyName}
                subjectFirstName={i.subject.firstName}
                viewerName={viewerName}
                step={{
                  ...i,
                  canAct: true,
                  completedBy: null,
                  note: null,
                  assignee: undefined,
                }}
              />
            ))}
          </div>
        </Section>
      ))}

      {buddyFor ? (
        <BuddyPicker
          runId={buddyFor.runId}
          subject={{ id: buddyFor.subject.id, name: buddyFor.subject.name, firstName: buddyFor.subject.firstName }}
          currentBuddyId={null}
          colleagues={colleagues}
          open={!!buddyFor}
          onOpenChange={(o) => !o && setBuddyFor(null)}
        />
      ) : null}
    </div>
  );
}

/** The shape of a typical first month, drawn for the empty state. Illustrative, and labelled so. */
const EXAMPLE: Track = {
  todayAt: 0,
  phases: [
    { key: "before", label: "Before day 1", first: "Laptop, accounts", last: "", anchor: false, current: false, done: 0, nextTitle: "Order the laptop", dots: dots("b", 4) },
    { key: "day-1", label: "Day 1", first: "Welcome", last: "", anchor: true, current: false, done: 0, nextTitle: "Take them for coffee", dots: dots("d", 6) },
    { key: "week-1", label: "Week 1", first: "Settling in", last: "", anchor: false, current: false, done: 0, nextTitle: "Pair on a first task", dots: dots("w", 5) },
    { key: "month-1", label: "Month 1", first: "Check-in", last: "", anchor: false, current: false, done: 0, nextTitle: "30-day conversation", dots: dots("m", 2) },
  ],
};
function dots(prefix: string, n: number): Track["phases"][number]["dots"] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, status: "pending" as const, overdue: false, next: false }));
}

/**
 * The empty state for someone with no onboarding steps: a calm "nothing for you" with the shape
 * of a journey drawn beside it, so the reader learns what will land here and when.
 */
function NothingOnYourPlate({ today }: { today: string }) {
  return (
    <section aria-labelledby="empty-heading" className="panel grid items-center gap-8 overflow-hidden rounded-panel p-5 sm:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:gap-12">
      <div className="flex flex-col items-start gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-success-soft text-success-text shadow-cell" aria-hidden>
          <CheckCheck className="size-6 stroke-[1.75]" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 id="empty-heading" className="text-h2 font-medium text-fg">
            Nothing on your plate
          </h2>
          <p className="max-w-[44ch] text-body text-muted text-pretty">
            When someone joins your team, or a journey gives you a step like ordering a laptop, it lands here with a due date.
          </p>
        </div>
      </div>
      <figure className="flex min-w-0 flex-col gap-2">
        <PhaseTrack track={EXAMPLE} today={today} label="Example: the shape of a new starter's first month" illustrative className="!pt-0" />
        <figcaption className="px-1 text-caption text-muted">An example first month. Yours will show real people and dates.</figcaption>
      </figure>
    </section>
  );
}
