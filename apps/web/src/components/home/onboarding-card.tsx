import Link from "next/link";
import { ArrowUpRight, CalendarDays, ListChecks } from "lucide-react";
import type { OnboardingPerson } from "@/server/planner";
import { Avatar } from "@/components/ui/avatar";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { HeroLight } from "@/components/ui/hero-light";
import { CountUp } from "@/components/ui/motion";
import { daysUntil } from "@lobby/core/home";
import { CollapsibleSectionBody, CollapsibleSectionToggle } from "@/components/ui/section-collapse";
import { cn } from "@/lib/cn";

/** "Starts tomorrow", "In 14 days", "Day 3", "Week 3": short enough for a pill. */
function shortStart(day: string): string {
  const n = daysUntil(day);
  if (n === 0) return "Starts today";
  if (n === 1) return "Starts tomorrow";
  if (n > 1) return `In ${n} days`;
  if (n > -7) return `Day ${1 - n}`;
  return `Week ${Math.floor(-n / 7) + 1}`;
}

/** The folded card's one line on a phone: "Ravi, Carlos and 2 more". */
function summaryFor(people: OnboardingPerson[]): string {
  if (!people.length) return "Nobody right now";
  const names = people.map((p) => p.name.split(" ")[0]);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/**
 * Onboarding: the people being onboarded, each with their generated avatar and a
 * "5/10 tasks done" pill (or their start day when the viewer may not see progress).
 */
export function OnboardingCard({ people, className }: { people: OnboardingPerson[]; className?: string }) {
  return (
    <section id="onboarding" aria-labelledby="onboarding-heading" className={cn("@container relative isolate flex scroll-mt-24 flex-col overflow-hidden rounded-panel panel p-5", className)}>
      {/* Onboarding's violet, as the card's one light. */}
      <HeroLight tone="violet" position="top-right" />
      {/* Phones fold the card behind its heading (a short Home); from md up it is always open. */}
      <div className="relative flex items-center justify-between gap-3 max-md:min-h-11 max-md:pr-12 md:mb-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="onboarding-heading" className="text-h3 font-medium text-fg @[380px]:text-h2">
            Onboarding
          </h2>
          <CollapsibleSectionToggle
            sectionId="onboarding"
            bodyId="onboarding-body"
            defaultOpen={false}
            label="Onboarding"
            summary={summaryFor(people)}
          />
        </div>
        <Link href="/journeys" className="focus-ring touch-target press inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-raised px-3 text-small font-medium text-fg shadow-cell max-md:hidden">
          <ArrowUpRight className="size-3.5 stroke-[1.75]" aria-hidden />
          <span className="@max-[340px]:sr-only">View all</span>
        </Link>
      </div>
      <CollapsibleSectionBody sectionId="onboarding" bodyId="onboarding-body" defaultOpen={false}>
      {people.length ? (
        <ul className="grid grid-cols-2 gap-2">
          {people.slice(0, 4).map((p) => {
            const href = p.runId ? `/journeys/runs/${p.runId}` : `/people/${p.id}`;
            const progress = p.done !== null && p.total !== null && p.total > 0;
            return (
              <li key={p.id}>
                <Link href={href} className="focus-ring press relative isolate flex h-full flex-col items-center gap-2 rounded-card bg-raised px-3 pb-3 pt-4 text-center shadow-cell hover:shadow-cell-hover">
                  <SpotlightLayer />
                  <Avatar name={p.name} seed={p.id} src={p.avatarUrl} size="xl" className="size-14" />
                  <span className="flex w-full min-w-0 flex-col">
                    <span className="truncate text-body font-medium text-fg">{p.name}</span>
                    <span className="truncate text-caption text-muted">{p.title ?? "New joiner"}</span>
                  </span>
                  <span className="mt-auto inline-flex h-7 w-full max-w-full items-center justify-center gap-1.5 rounded-full bg-cat-violet-soft px-2.5 text-caption font-medium text-cat-violet-text">
                    {progress ? (
                      <>
                        <ListChecks className="size-3.5 shrink-0 stroke-[1.75]" aria-hidden />
                        <span className="truncate">
                          <CountUp value={p.done!} duration={0.8} />
                          {`/${p.total} tasks done`}
                        </span>
                      </>
                    ) : (
                      <>
                        <CalendarDays className="size-3.5 shrink-0 stroke-[1.75]" aria-hidden />
                        <span className="truncate">{p.startDate ? shortStart(p.startDate) : "Onboarding"}</span>
                      </>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-card bg-raised/60 px-4 py-8 text-center text-body text-muted">Nobody is being onboarded right now. New joiners will appear here with their progress.</p>
      )}
      </CollapsibleSectionBody>
    </section>
  );
}
