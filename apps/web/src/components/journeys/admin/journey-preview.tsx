"use client";

import { HeroLight } from "@/components/ui/hero-light";
import * as React from "react";
import type { EditableStep } from "@lobby/core/journeys";
import { dueDateFor, formatDay, isIsoDate, phaseFor, type JourneyKind } from "@lobby/core/journeys/dates";
import { personalise, type AssigneeKind } from "@lobby/core/journeys/rules";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { PartyPopper } from "lucide-react";
import { cn } from "@/lib/cn";
import { StepIcon } from "../step-icon";
import { StageBar } from "./journey-list";

/** What the journey looks like for someone starting (or leaving) on a chosen date. */
export function JourneyPreview({
  steps,
  kind,
  workingDays,
  defaultDate,
  labels,
  people,
}: {
  steps: (EditableStep & { key: string })[];
  kind: JourneyKind;
  workingDays: number[];
  defaultDate: string;
  labels: Record<AssigneeKind, string>;
  people: { id: string; name: string }[];
}) {
  const [date, setDate] = React.useState(defaultDate);
  const anchor = isIsoDate(date) ? date : defaultDate;
  const rows = steps
    .map((s, i) => ({ s, i, due: dueDateFor(anchor, s.dayOffset, workingDays), phase: phaseFor(s.dayOffset, kind) }))
    .sort((a, b) => a.due.localeCompare(b.due) || a.i - b.i);
  const groups: { label: string; key: string; rows: typeof rows }[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.key === r.phase.key) last.rows.push(r);
    else groups.push({ key: r.phase.key, label: r.phase.label, rows: [r] });
  }
  const who = (s: EditableStep) => (s.assigneeUserId ? (people.find((p) => p.id === s.assigneeUserId)?.name ?? labels[s.assignee]) : labels[s.assignee]);

  return (
    <section aria-labelledby="preview-heading" className="panel relative isolate flex flex-col gap-4 overflow-hidden rounded-panel p-5">
      {/* The journey drawn for one imagined starter: lit violet, an onboarding (blue for offboarding). */}
      <HeroLight tone={kind === "offboarding" ? "blue" : "violet"} position="top-right" />
      <div className="flex flex-col gap-0.5">
        <h2 id="preview-heading" className="text-h4 font-medium text-fg">
          Preview
        </h2>
        <p className="text-small text-muted">Due dates skip weekends: prep moves earlier, follow-ups move later.</p>
      </div>
      <Field label={kind === "offboarding" ? "If their last day is" : "If they start on"}>
        <DateField value={date} onValueChange={(v) => setDate(v || defaultDate)} clearable={false} />
      </Field>
      {rows.length ? <StageBar stages={groups.map((g) => ({ key: g.key, label: g.label, count: g.rows.length }))} muted={false} kind={kind} /> : null}
      {rows.length ? (
        <ol className="relative flex flex-col gap-5" aria-label="Previewed timeline">
          <span aria-hidden className="absolute bottom-2 left-[13px] top-2 w-px bg-border" />
          {groups.map((g, gi) => {
            const anchor = g.key === "day-1";
            return (
              <li key={`${g.key}-${gi}`} className="relative flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5 [&_svg]:stroke-[1.75]",
                      anchor ? "cat-green shadow-cell" : kind === "onboarding" ? "cat-violet shadow-cell" : "cell text-muted",
                    )}
                  >
                    {anchor ? <PartyPopper /> : <span className="size-1.5 rounded-full bg-current" />}
                  </span>
                  <h3 className="text-small font-medium text-fg">{g.label}</h3>
                  <span className="tabular ml-auto text-caption text-muted">{g.rows.length}</span>
                </div>
                <ul className="flex flex-col pl-9">
                  {g.rows.map(({ s, due }) => (
                    <li key={s.key} className="flex items-start gap-2.5 rounded-cell py-1.5">
                      <span
                        className={cn(
                          "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full [&_svg]:size-3 [&_svg]:stroke-[1.75]",
                          anchor ? "bg-cat-green-soft text-cat-green-text" : kind === "onboarding" ? "bg-cat-violet-soft text-cat-violet-text" : "bg-sunken text-muted",
                        )}
                        aria-hidden
                      >
                        <StepIcon type={s.type} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="line-clamp-2 text-small text-fg">{s.title ? personalise(s.title, { displayName: "the new starter", firstName: "the new starter" }) : "Untitled step"}</span>
                        <span className="truncate text-caption text-muted">{who(s)}</span>
                      </span>
                      <span className="tabular shrink-0 text-caption text-muted">{formatDay(due)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-cell bg-raised/60 px-4 py-6 text-center text-small text-muted">Add steps to see the timeline.</p>
      )}
    </section>
  );
}
