"use client";

import * as React from "react";
import type { TaskItem } from "@lobby/core/journeys";
import { addDays, daysBetween, dueLabel, isoWeekday } from "@lobby/core/journeys/dates";
import { Avatar } from "@/components/ui/avatar";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { cn } from "@/lib/cn";

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const dayName = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`));
const dayNum = (iso: string) => Number(iso.slice(8, 10));

/**
 * The tasks hero: your open steps laid out on the next seven days, in the Home planner's language.
 * Day chips across the top (today in the vivid "now" blue, weekends hatched), each step a violet
 * onboarding block on the day it is due with the face of the person it is for. Late steps stack
 * in their own column on the left, in red, and anything past the week waits in "Later".
 * Each block jumps to the step's row below.
 */
export function WeekStrip({ items, today, workingDays = [1, 2, 3, 4, 5] }: { items: TaskItem[]; today: string; workingDays?: number[] }) {
  const open = items.filter((i) => i.status === "pending");
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const late = open.filter((i) => i.dueDate < today);
  const later = open.filter((i) => daysBetween(today, i.dueDate) >= 7);
  const people = new Set(open.map((i) => i.subject.id)).size;
  const agenda = [
    { key: "late", label: "Late", items: late },
    { key: "today", label: "Today", items: open.filter((t) => t.dueDate === today) },
    { key: "week", label: "This week", items: open.filter((t) => t.dueDate > today && daysBetween(today, t.dueDate) < 7) },
    { key: "later", label: "Later", items: later },
  ];
  const cols: { key: string; head: React.ReactNode; label: string; items: TaskItem[]; tone: "late" | "today" | "day" | "weekend" | "later" }[] = [
    { key: "late", head: <HeadText top="Late" bottom={String(late.length)} />, label: `Late, ${late.length}`, items: late, tone: "late" },
    ...days.map((d, i) => ({
      key: d,
      head: <HeadText top={dayName(d)} bottom={String(dayNum(d))} />,
      label: `${i === 0 ? "Today, " : ""}${dayName(d)} ${dayNum(d)}`,
      items: open.filter((t) => t.dueDate === d),
      tone: (i === 0 ? "today" : workingDays.includes(isoWeekday(d)) ? "day" : "weekend") as "today" | "day" | "weekend",
    })),
    { key: "later", head: <HeadText top="Later" bottom={String(later.length)} />, label: `Later, ${later.length}`, items: later, tone: "later" },
  ];

  return (
    <section aria-labelledby="week-heading" className="panel flex flex-col gap-4 rounded-panel p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="week-heading" className="text-h3 font-medium text-fg">
            Your week
          </h2>
          <p className="text-small text-muted">
            <span className="tabular font-medium text-fg">{open.length}</span> {open.length === 1 ? "step" : "steps"} for{" "}
            {people} {people === 1 ? "person" : "people"}
            {late.length ? (
              <>
                , <span className="text-danger-text">{late.length} late</span>
              </>
            ) : null}
            .
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted" aria-label="Key">
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-cat-violet" aria-hidden />
            Onboarding step
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-danger" aria-hidden />
            Late
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-now" aria-hidden />
            Today
          </li>
        </ul>
      </div>

      {/* md and up: the nine columns. Below md: an agenda (Late, Today, This week, Later). */}
      <div className="hidden md:block">
        <Reveal className="grid grid-cols-[repeat(9,minmax(0,1fr))] gap-1.5" stagger={0.035}>
          {cols.map((c) => (
            <RevealItem key={c.key} from="up" className="flex min-w-0 flex-col gap-1.5" role="group" aria-label={`${c.label}: ${c.items.length} ${c.items.length === 1 ? "step" : "steps"}`}>
              <div
                aria-hidden
                className={cn(
                  "flex h-12 flex-col items-center justify-center rounded-cell text-center",
                  c.tone === "today" && "bg-now text-now-fg shadow-cell",
                  c.tone === "day" && "cell text-fg",
                  c.tone === "weekend" && "hatch text-muted",
                  c.tone === "late" && (c.items.length ? "bg-danger-soft text-danger-text" : "bg-sunken text-muted"),
                  c.tone === "later" && "bg-sunken text-muted dark:bg-surface/60",
                )}
              >
                {c.head}
              </div>
              <ul
                className={cn(
                  "flex min-h-[132px] flex-1 flex-col gap-1.5 rounded-cell p-1",
                  c.tone === "weekend" ? "hatch" : c.tone === "today" ? "bg-now-soft/60" : "bg-raised/50 dark:bg-raised/40",
                )}
              >
                {c.items.slice(0, 3).map((t) => (
                  <li key={t.id} className="min-w-0">
                    <a
                      href={`#step-${t.id}`}
                      className={cn(
                        "focus-ring press flex min-w-0 flex-col gap-1 rounded-[10px] p-2 text-left",
                        c.tone === "late"
                          ? "bg-danger text-danger-fg shadow-cell"
                          : c.tone === "later"
                            ? "bg-raised text-fg shadow-cell ring-1 ring-inset ring-cat-violet/35"
                            : "cat-violet shadow-cell",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Avatar name={t.subject.name} seed={t.subject.id} src={t.subject.avatarUrl} size="xs" className="rounded-full ring-2 ring-white/60" />
                        <span className={cn("truncate text-caption", c.tone === "later" ? "text-muted" : "")}>{t.subject.firstName}</span>
                      </span>
                      <span className="line-clamp-2 text-caption font-medium leading-snug">{t.title}</span>
                    </a>
                  </li>
                ))}
                {c.items.length > 3 ? <li className="px-1 text-caption text-muted">+{c.items.length - 3} more</li> : null}
              </ul>
            </RevealItem>
          ))}
        </Reveal>
      </div>
      <ol className="flex flex-col gap-3 md:hidden">
        {agenda.map((g) =>
          g.items.length ? (
            <li key={g.key} className="flex flex-col gap-1.5">
              <h3 className={cn("text-small font-medium", g.key === "late" ? "text-danger-text" : g.key === "today" ? "text-now-text" : "text-muted")}>
                {g.label} <span className="tabular">{g.items.length}</span>
              </h3>
              <ul className="flex flex-col gap-1.5">
                {g.items.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#step-${t.id}`}
                      className={cn(
                        "focus-ring press flex min-h-12 items-center gap-2.5 rounded-cell px-3 py-2",
                        g.key === "late" ? "bg-danger text-danger-fg shadow-cell" : g.key === "later" ? "bg-raised text-fg shadow-cell ring-1 ring-inset ring-cat-violet/35" : "cat-violet shadow-cell",
                      )}
                    >
                      <Avatar name={t.subject.name} seed={t.subject.id} src={t.subject.avatarUrl} size="md" className="rounded-full ring-2 ring-white/60" />
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="text-small font-medium text-pretty">{t.title}</span>
                        <span className={cn("text-caption", g.key === "later" ? "text-muted" : "")}>
                          {t.subject.firstName} · {dueLabel(t.dueDate, today)}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ) : null,
        )}
      </ol>
    </section>
  );
}

function HeadText({ top, bottom }: { top: string; bottom: string }) {
  return (
    <>
      <span className="text-caption leading-tight">{top}</span>
      <span className="tabular text-body font-medium leading-tight">{bottom}</span>
    </>
  );
}
