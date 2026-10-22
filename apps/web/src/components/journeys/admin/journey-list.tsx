"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Compass, DoorOpen, Route, Sparkles } from "lucide-react";
import type { JourneyListItem } from "@lobby/core/journeys";
import { conditionsSummary } from "@lobby/core/journeys/rules";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { EASE_OUT_EXPO, motion, useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { installStarterJourneysAction, setJourneyActiveAction } from "@/app/(app)/admin/journeys/_actions";

/** A journey's shape for the list: how many steps fall in each stage, and who is on it now. */
export interface JourneyShape {
  stages: { key: string; label: string; count: number }[];
  people: { id: string; name: string; avatarUrl: string | null }[];
}

export function JourneyList({
  journeys,
  groups,
  shapes = {},
}: {
  journeys: JourneyListItem[];
  groups: { id: string; name: string }[];
  shapes?: Record<string, JourneyShape>;
}) {
  const [pending, startTransition] = React.useTransition();
  const [active, setActive] = React.useState<Record<string, boolean>>(() => Object.fromEntries(journeys.map((j) => [j.id, j.active])));
  React.useEffect(() => setActive(Object.fromEntries(journeys.map((j) => [j.id, j.active]))), [journeys]);
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name;

  const toggle = (j: JourneyListItem, on: boolean) =>
    startTransition(async () => {
      setActive((a) => ({ ...a, [j.id]: on }));
      const res = await setJourneyActiveAction(j.id, on);
      if (!res.ok) {
        setActive((a) => ({ ...a, [j.id]: !on }));
        toast.error(res.error);
        return;
      }
      toast.success(on ? `${j.name} is on. It starts for new matches automatically.` : `${j.name} is off. Journeys already running carry on.`);
    });

  const install = () =>
    startTransition(async () => {
      const res = await installStarterJourneysAction();
      if (!res.ok) toast.error(res.error);
      else toast.success(res.created.length ? `Added ${res.created.join(" and ")}` : "The starter journeys are already here");
    });

  if (!journeys.length) {
    return (
      <EmptyState
        icon={<Route />}
        title="No journeys yet"
        description="A journey is a plan for someone's first weeks (or last ones): steps for them, their manager, IT and People, each due relative to their start date."
        action={
          <Button asChild>
            <Link href="/admin/journeys/new">New journey</Link>
          </Button>
        }
        secondary={
          <Button variant="secondary" onClick={install} loading={pending}>
            <Sparkles aria-hidden />
            Add starter journeys
          </Button>
        }
      />
    );
  }

  const sections = [
    { kind: "onboarding" as const, label: "Onboarding" },
    { kind: "offboarding" as const, label: "Offboarding" },
  ];

  return (
    <div className="section-stack">
      {sections.map((sec) => {
        const items = journeys.filter((j) => j.kind === sec.kind);
        if (!items.length) return null;
        return (
          <Section key={sec.kind} title={sec.label} count={items.length}>
            <ul className="flex flex-col gap-3">
              {items.map((j) => {
                const shape = shapes[j.id];
                const on = !!active[j.id];
                return (
                  <li
                    key={j.id}
                    className="cell group/row relative grid gap-x-5 gap-y-3 rounded-card px-4 py-4 transition-shadow duration-160 hover:shadow-cell-hover sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_292px] lg:gap-x-8 md:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden
                        className={cn(
                          "inline-flex size-11 shrink-0 items-center justify-center rounded-full shadow-cell [&_svg]:size-[18px] [&_svg]:stroke-[1.75]",
                          !on ? "bg-sunken text-subtle" : j.kind === "onboarding" ? "cat-violet" : "bg-raised text-muted",
                        )}
                      >
                        {j.kind === "onboarding" ? <Compass /> : <DoorOpen />}
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <Link
                            href={`/admin/journeys/${j.id}`}
                            className="focus-ring truncate rounded-[4px] py-0.5 text-row font-medium text-fg after:absolute after:inset-0 after:rounded-card after:content-[''] hover:underline hover:underline-offset-2"
                          >
                            {j.name}
                          </Link>
                          {!on ? (
                            <Badge tone="neutral" size="sm">
                              Off
                            </Badge>
                          ) : null}
                        </div>
                        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-small text-muted">
                          <span className="truncate">For {conditionsSummary(j.conditions, groupName).replace(/^Everyone$/, "everyone")}</span>
                          <span aria-hidden>·</span>
                          <span className="tabular">
                            {j.stepCount} {j.stepCount === 1 ? "step" : "steps"} ({j.newHireStepCount} for the new hire)
                          </span>
                        </p>
                      </div>
                    </div>

                    {shape?.stages.length ? <StageBar stages={shape.stages} muted={!on} kind={j.kind} /> : <span className="hidden md:block" />}

                    <div className="relative z-10 flex items-center justify-between gap-4 md:justify-end">
                      <span className="flex min-w-0 items-center gap-2 text-small text-muted">
                        {shape?.people.length ? (
                          <AvatarStack people={shape.people.map((p) => ({ name: p.name, src: p.avatarUrl, seed: p.id }))} max={4} size="md" />
                        ) : null}
                        <span className="tabular whitespace-nowrap">
                          {j.activeRuns ? `${j.activeRuns} on it` : "Nobody yet"}
                          {j.completedRuns ? <span className="hidden lg:inline">, {j.completedRuns} done</span> : null}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <label className="flex items-center gap-2 text-small text-muted">
                          <Switch checked={on} onCheckedChange={(v) => toggle(j, v)} aria-label={`${j.name} starts automatically`} />
                          <span className="hidden w-6 sm:inline">{on ? "On" : "Off"}</span>
                        </label>
                        <ChevronRight className="size-4 text-subtle transition-transform duration-160 group-hover/row:translate-x-0.5" aria-hidden />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}

/**
 * The journey's shape at a glance: one segment per stage, as wide as its share of the steps, in the
 * onboarding violet with the first day in green (offboarding stays neutral). The segments grow in from the left on first view.
 */
export function StageBar({ stages, muted, kind }: { stages: JourneyShape["stages"]; muted: boolean; kind: JourneyListItem["kind"] }) {
  const reduced = useMotionReduced();
  const total = stages.reduce((n, st) => n + st.count, 0) || 1;
  return (
    <div className="flex min-w-0 flex-col gap-1.5" role="img" aria-label={stages.map((st) => `${st.label}: ${st.count}`).join(", ")}>
      <div className={cn("flex h-2.5 gap-[3px] overflow-hidden rounded-full", muted && "opacity-40 saturate-0")}>
        {stages.map((st, i) => (
          <motion.span
            key={st.key}
            className={cn(
              "h-full origin-left rounded-full",
              kind === "offboarding" ? (st.key === "last-day" ? "bg-fg/55" : "bg-border-strong") : st.key === "day-1" ? "bg-cat-green" : "bg-cat-violet",
            )}
            style={{ flexGrow: st.count, flexBasis: 0 }}
            initial={reduced ? { scaleX: 1, opacity: 0 } : { scaleX: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={reduced ? { duration: 0.2 } : { duration: 0.6, delay: 0.15 + i * 0.07, ease: EASE_OUT_EXPO }}
          />
        ))}
      </div>
      <div className="flex min-w-0 gap-[3px] text-caption text-muted" aria-hidden>
        {/* A stage too narrow for its name keeps its width but drops the label (it is in the bar's name). */}
        {stages.map((st) => (
          <span key={st.key} className="min-w-0 truncate pr-2" style={{ flexGrow: st.count, flexBasis: 0 }}>
            {st.count / total >= 0.2 ? st.label.replace(/^Before the last week$/, "Before") : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
