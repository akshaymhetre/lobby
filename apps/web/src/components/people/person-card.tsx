import Link from "next/link";
import { isNewJoiner, isUpcomingStarter, isWorkingNow } from "@lobby/core/people/format";
import type { PersonSummary } from "@lobby/core/people";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { cn } from "@/lib/cn";
import { CellList, RowCell } from "@/components/ui/cells";
import { Section } from "@/components/ui/section";
import { PersonDay } from "./day-track";

export type PersonCardData = Pick<
  PersonSummary,
  "id" | "displayName" | "title" | "department" | "location" | "avatarUrl" | "timezone" | "workingHours" | "startDate" | "pronouns"
>;

/** "New" is the first-day category (green); "Starting soon" is a quiet info pill. */
export function JoinerBadge({ startDate }: { startDate: string | null }) {
  if (isUpcomingStarter(startDate)) return <Badge tone="info" size="sm">Starting soon</Badge>;
  if (isNewJoiner(startDate)) return <Badge tone="green" size="sm">New</Badge>;
  return null;
}

/*
 * The person cell: the one object the whole People area is built from. A raised white tile
 * (tone + soft shadow + 1px top highlight) that carries a face, a name and a role, lifts 1px under
 * the pointer and presses to 0.97. The directory, the grid, the org chart and the profile's
 * reporting line all use this shape, so a person looks the same everywhere.
 */
export const personCellClass =
  "group relative isolate cell press rounded-cell hover:shadow-cell-hover " +
  "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent-ring";

/**
 * One directory cell (wave 3): a separate raised RowCell with a 40px face, the name at 15px over
 * the role, and on the right their day: local time over a slim track of their working hours in the
 * reader's clock, green while they are working. The whole cell opens the profile.
 */
export function PersonRow({
  person,
  viewerTimezone,
  showDepartment = false,
  index = 0,
}: {
  person: PersonCardData;
  viewerTimezone: string | null;
  /** Show the department (flat search results). Grouped lists leave it out. */
  showDepartment?: boolean;
  /** Position in the list, for the day tracks' staggered wipe. */
  index?: number;
}) {
  const sub = [showDepartment ? person.department : null, person.title].filter(Boolean).join(", ");
  return (
    <RowCell
      href={`/people/${person.id}`}
      chevron={false}
      leading={<Face person={person} />}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{person.displayName}</span>
          <JoinerBadge startDate={person.startDate} />
        </span>
      }
      meta={<span className="truncate">{sub || "No title yet"}</span>}
      trailing={
        <>
          <span className="hidden w-[96px] truncate text-right text-caption text-muted lg:block">{person.location ?? ""}</span>
          <PersonDay timezone={person.timezone} workingHours={person.workingHours} viewerTimezone={viewerTimezone} delay={120 + Math.min(index, 12) * 30} />
        </>
      }
    />
  );
}

/**
 * The face in a person cell, with a small green dot while they are inside their working hours
 * (the same green as "working now" on the Around the clock board). Read on the server per request.
 */
function Face({ person, className }: { person: PersonCardData; className?: string }) {
  const working = isWorkingNow(person.timezone, person.workingHours) === true;
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar name={person.displayName} seed={person.id} src={person.avatarUrl} size="lg" aria-hidden />
      {working ? (
        <span className="absolute -bottom-px -right-px block size-3 rounded-full bg-cat-green ring-[2.5px] ring-raised" role="img" aria-label="Working now" />
      ) : null}
    </span>
  );
}

/**
 * A department group in the directory: a sentence-case section title with a count chip, then the
 * person cells two up from xl. On a phone the group folds behind its heading (summary: who is
 * working now), so the directory is a short list of teams rather than 4,000px of rows.
 */
export function PersonGroup({
  id,
  title,
  count,
  summary,
  defaultOpen = false,
  children,
  className,
}: {
  id: string;
  title: string;
  count: number;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Section id={id} as="h3" title={title} count={count} collapsible defaultOpen={defaultOpen} summary={summary} className={className}>
      <CellList layout="grid" min="420px">
        {children}
      </CellList>
    </Section>
  );
}

/** Grid card: the secondary layout at `md` and up. The same cell, with the role and team under the name. */
export function PersonCard({ person, className }: { person: PersonCardData; className?: string }) {
  return (
    <li className={cn(personCellClass, "flex items-center gap-3 rounded-card px-3.5 py-3.5", className)}>
      <SpotlightLayer />
      <Face person={person} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <Link href={`/people/${person.id}`} className="-my-1 truncate py-1 text-row font-medium text-fg outline-none after:absolute after:inset-0 after:rounded-card">
            {person.displayName}
          </Link>
          <JoinerBadge startDate={person.startDate} />
        </span>
        <span className="truncate text-small text-muted">{person.title ?? <span className="text-subtle">No title yet</span>}</span>
        <span className="truncate text-caption text-muted">{person.location ?? person.department ?? ""}</span>
      </div>
    </li>
  );
}
