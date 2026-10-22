"use client";

import * as React from "react";
import { Check, LifeBuoy, PartyPopper, UsersRound } from "lucide-react";
import type { TimelineStep } from "@lobby/core/journeys";
import { daysBetween, formatDay } from "@lobby/core/journeys/dates";
import { Avatar } from "@/components/ui/avatar";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { cn } from "@/lib/cn";

type Step = Pick<TimelineStep, "id" | "title" | "phase" | "dueDate" | "status" | "overdue" | "assignee">;

/**
 * Who does what, when: one person's journey as a grid of owners (the new starter, their manager,
 * their buddy, IT, the People team) by stage (Before day 1, Day 1, Week 1...). Every step sits in
 * its owner's lane under its stage as a chip: violet while open, red once late, a quiet check once
 * done. The stage that holds today carries the "now" blue pin; Day 1 is the green column.
 * Each chip jumps to the step's card below.
 */
export function RunMatrix({ steps, today, subject }: { steps: Step[]; today: string; subject: { id: string; firstName: string } }) {
  const phases = React.useMemo(() => {
    const m = new Map<string, { key: string; label: string; order: number; first: string; last: string }>();
    for (const s of steps) {
      const p = m.get(s.phase.key) ?? { key: s.phase.key, label: s.phase.label, order: s.phase.order, first: s.dueDate, last: s.dueDate };
      if (s.dueDate < p.first) p.first = s.dueDate;
      if (s.dueDate > p.last) p.last = s.dueDate;
      m.set(s.phase.key, p);
    }
    return [...m.values()].sort((a, b) => a.order - b.order);
  }, [steps]);

  const lanes = React.useMemo(() => {
    const m = new Map<string, { key: string; label: string; role: string; person: Step["assignee"]["person"]; team: Step["assignee"]["team"]; order: number; steps: Step[] }>();
    const ORDER: Record<string, number> = { subject: 0, manager: 1, buddy: 2, specific: 3, it: 4, people: 5 };
    for (const s of steps) {
      const a = s.assignee;
      const key = a.kind === "it" || a.kind === "people" ? a.kind : `${a.kind}:${a.person?.id ?? "none"}`;
      const lane =
        m.get(key) ??
        {
          key,
          label: a.kind === "subject" ? subject.firstName : a.kind === "it" ? "IT" : a.kind === "people" ? "People team" : (a.person?.name ?? a.label),
          role: a.kind === "subject" ? "New starter" : a.kind === "it" || a.kind === "people" ? "Queue" : a.label,
          person: a.kind === "it" || a.kind === "people" ? null : a.person,
          team: a.team,
          order: ORDER[a.kind] ?? 9,
          steps: [],
        };
      lane.steps.push(s);
      m.set(key, lane);
    }
    return [...m.values()].sort((a, b) => a.order - b.order);
  }, [steps, subject.firstName]);

  const nowKey = phases.find((p) => daysBetween(p.first, today) >= 0 && daysBetween(today, p.last) >= 0)?.key ?? phases.find((p) => p.first > today)?.key;
  const cols = `minmax(132px,168px) repeat(${phases.length}, minmax(0,1fr))`;

  return (
    <div className="flex flex-col gap-1.5" role="table" aria-label="Who does what, by stage">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: cols }} role="row">
        <span role="columnheader" className="self-end pb-1 text-small text-muted">
          Who
        </span>
        {phases.map((p) => {
          const anchor = p.key === "day-1";
          const now = p.key === nowKey;
          return (
            <span
              key={p.key}
              role="columnheader"
              className={cn(
                "relative flex h-12 min-w-0 flex-col justify-center rounded-cell px-2.5 leading-tight",
                anchor ? "cat-green shadow-cell" : now ? "cat-violet shadow-cell" : "cell",
              )}
            >
              <span className={cn("flex items-center gap-1 truncate text-small font-medium", anchor || now ? "text-white" : "text-fg")}>
                {anchor ? <PartyPopper className="size-3.5 shrink-0 stroke-[1.75]" aria-hidden /> : null}
                {p.label}
              </span>
              <span className={cn("truncate text-caption", anchor || now ? "text-white/80" : "text-muted")}>{formatDay(p.first)}</span>
              {now ? (
                <span className="absolute -top-3 right-2 inline-flex h-6 items-center rounded-full bg-now px-2.5 text-caption font-medium text-now-fg shadow-cell">
                  Today
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      <Reveal className="flex flex-col gap-1.5" stagger={0.06} delay={0.1}>
        {lanes.map((l) => (
          <RevealItem key={l.key} from="fade" className="grid gap-1.5" style={{ gridTemplateColumns: cols }} role="row">
            <span role="rowheader" className="flex min-w-0 items-center gap-2 rounded-cell bg-raised px-2.5 py-2 shadow-cell">
              {l.person ? (
                <Avatar name={l.person.name} seed={l.person.id} src={l.person.avatarUrl} size="md" />
              ) : (
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-muted" aria-hidden>
                  {l.key === "it" ? <LifeBuoy className="size-4 stroke-[1.75]" /> : <UsersRound className="size-4 stroke-[1.75]" />}
                </span>
              )}
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-small font-medium text-fg">{l.label}</span>
                <span className="truncate text-caption text-muted">{l.role}</span>
              </span>
            </span>
            {phases.map((p) => {
              const cell = l.steps.filter((s) => s.phase.key === p.key).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
              return (
                <span
                  key={p.key}
                  role="cell"
                  className={cn("flex min-h-12 min-w-0 flex-col gap-1 rounded-cell p-1", p.key === nowKey ? "bg-now-soft/50" : "bg-raised/50 dark:bg-raised/40")}
                >
                  {cell.slice(0, 3).map((s) => {
                    const done = s.status !== "pending";
                    const late = !done && s.overdue;
                    return (
                      <a
                        key={s.id}
                        href={`#step-${s.id}`}
                        title={s.title}
                        className={cn(
                          "focus-ring press flex min-h-7 min-w-0 items-start gap-1.5 rounded-[9px] px-2 py-1 text-caption leading-snug",
                          done
                            ? "bg-sunken text-muted dark:bg-surface/60"
                            : late
                              ? "bg-danger font-medium text-danger-fg shadow-cell"
                              : p.key === "day-1"
                                ? "bg-cat-green-soft font-medium text-cat-green-text"
                                : "bg-cat-violet-soft font-medium text-cat-violet-text",
                        )}
                      >
                        {done ? <Check className="mt-0.5 size-3 shrink-0 stroke-[2.25] text-fg/60" aria-hidden /> : null}
                        <span className="line-clamp-2 min-w-0 text-pretty">{s.title}</span>
                        <span className="sr-only">{done ? ", done" : late ? ", late" : ", open"}</span>
                      </a>
                    );
                  })}
                  {cell.length > 3 ? <span className="px-2 text-caption text-muted">+{cell.length - 3} more</span> : null}
                </span>
              );
            })}
          </RevealItem>
        ))}
      </Reveal>
    </div>
  );
}
