import Link from "next/link";
import { daysUntil, startLabel } from "@lobby/core/people/format";
import type { NewJoiner } from "@lobby/core/people";
import { Avatar } from "@/components/ui/avatar";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { SectionHeading } from "@/components/ui/section";
import { personCellClass } from "./person-card";
import { SayHiButton } from "./say-hi-button";

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

/** "Starts Thu 29 Oct" instead of the long "Starts on Thursday 29 October", so the card keeps two lines. */
function shortStart(date: string | null): string | null {
  const label = startLabel(date);
  if (!date || !label?.startsWith("Starts on")) return label;
  const d = new Date(`${date}T12:00:00Z`);
  return `Starts ${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d).replace(",", "")}`;
}

/**
 * "New faces": one strip of person cells under the masthead, joined-recently first, then
 * starting-soon, each with a one-click "Say hi". This is the directory's authored moment: the
 * cells build in with a short stagger, and the person whose first day is today carries a green
 * border beam (the first-day category colour), two trips, then it settles.
 * On a phone the strip scrolls sideways instead of stacking.
 */
export function NewJoiners({ recent, upcoming, viewerId }: { recent: NewJoiner[]; upcoming: NewJoiner[]; viewerId: string }) {
  const people = [...recent, ...upcoming];
  if (!people.length) return null;
  // Only the first "today" cell gets the beam: never more than one per viewport.
  const todayId = people.find((p) => p.startDate && daysUntil(p.startDate) === 0)?.id ?? null;
  return (
    <section id="new-faces" aria-labelledby="new-joiners-heading" className="flex scroll-mt-24 flex-col gap-4">
      <SectionHeading id="new-joiners-heading" count={people.length} description="Say hi so their first weeks feel less quiet.">
        New faces
      </SectionHeading>
      <Reveal
        stagger={0.05}
        className="-mx-4 grid snap-x auto-cols-[minmax(264px,1fr)] grid-flow-col gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:grid-flow-row sm:grid-cols-[repeat(auto-fill,minmax(264px,1fr))] sm:overflow-visible sm:px-0 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {people.map((p) => (
          <RevealItem key={p.id} from="up" duration={0.45} className="h-full min-w-0">
            <div className={cn(personCellClass, "flex h-full min-h-[68px] min-w-0 snap-start items-center gap-3 rounded-card py-2 pl-3 pr-2")}>
              {p.id === todayId ? <BorderBeam tone="green" loops={2} delay={0.6} settle="none" /> : null}
              <SpotlightLayer />
              <Avatar name={p.displayName} seed={p.id} src={p.avatarUrl} size="lg" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <Link href={`/people/${p.id}`} className="-my-1 truncate py-1 text-row font-medium text-fg outline-none after:absolute after:inset-0 after:rounded-card">
                  {p.displayName}
                </Link>
                <span className="line-clamp-2 text-small text-muted" title={p.title ?? undefined}>
                  {shortStart(p.startDate) ?? p.title ?? p.department ?? ""}
                </span>
              </div>
              {p.id === viewerId ? (
                <span className="shrink-0 pr-1 text-small text-subtle">That is you</span>
              ) : (
                // Above the stretched link, so the button wins the click.
                <SayHiButton personId={p.id} firstName={firstName(p.displayName)} greeted={p.greetedByMe} variant="secondary" className="relative z-10 shrink-0" />
              )}
            </div>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}
