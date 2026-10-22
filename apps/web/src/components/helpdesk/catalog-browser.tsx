"use client";

import * as React from "react";
import Link from "next/link";
import { LifeBuoy, Search, SearchX, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryBlock, CategoryChip, type CategoryTone } from "@/components/ui/category-block";
import { CellList, RowCell } from "@/components/ui/cells";
import { Reveal, RevealItem, useMotionReduced } from "@/components/ui/motion";
import { Orb } from "@/components/ui/effects/orb";
import { openAssistant } from "@/components/shell/shell-events";
import { cn } from "@/lib/cn";
import { HELPDESK_ICONS, ToneDisc } from "./icons";
import { teamTone } from "./team-tone";

export interface CatalogTeam {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  types: {
    slug: string;
    name: string;
    description: string | null;
    icon: string | null;
    needsApproval: boolean;
  }[];
}

const PHONE_FIRST = 4;
/* The open team's list sits on its own colour, so it reads as the inside of the tile above. Literal names for Tailwind. */
const SOFT: Record<string, string> = {
  blue: "bg-cat-blue-soft/70",
  violet: "bg-cat-violet-soft/70",
  teal: "bg-cat-teal-soft/70",
  green: "bg-cat-green-soft/70",
};
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function TeamIcon({ name }: { name: string | null }) {
  const Icon = (name && HELPDESK_ICONS[name]) || LifeBuoy;
  return <Icon />;
}

/**
 * The service catalogue (wave 3): each team is a big filled tile in its own colour, carrying its
 * three most asked-for requests as chips, so the common case is one click from the page. The tile
 * you pick opens that team's whole list underneath as raised cells; IT is open to start with.
 * Typing in the search replaces both with the matching requests across every team.
 * The tiles build on first load, team by team: the catalogue's one authored moment.
 */
export function CatalogBrowser({ teams }: { teams: CatalogTeam[] }) {
  const reduced = useMotionReduced();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(teams[0]?.slug ?? "");
  const listRef = React.useRef<HTMLElement>(null);
  const q = norm(query.trim());
  const matches = React.useMemo(() => {
    if (!q) return [];
    const words = q.split(/\s+/);
    return teams.flatMap((t) =>
      t.types
        .filter((rt) => {
          const hay = norm(`${rt.name} ${rt.description ?? ""} ${t.name}`);
          return words.every((w) => hay.includes(w));
        })
        .map((rt) => ({ team: t, rt })),
    );
  }, [teams, q]);
  const [near, setNear] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const current = teams.find((t) => t.slug === open) ?? teams[0];

  const showTeam = (slug: string) => {
    setOpen(slug);
    setExpanded(false);
    // On a phone the list sits under four tiles; bring it into view.
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight - 120)
        el.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
  };

  return (
    <Reveal className="section-stack" stagger={0.07}>
      {/* The search is the lead of the catalogue: one big question, with the assistant beside it. */}
      <RevealItem
        className="flex flex-col gap-3 rounded-panel panel p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5 dark:glass"
        onPointerEnter={() => setNear(true)}
        onPointerLeave={() => setNear(false)}
      >
        <div className="relative flex min-w-0 flex-1 items-center">
          <label htmlFor="catalog-search" className="sr-only">
            Search the catalogue
          </label>
          <Search
            className="pointer-events-none absolute left-4 size-5 stroke-[1.75] text-muted"
            aria-hidden
          />
          <input
            id="catalog-search"
            type="search"
            placeholder="What do you need?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setNear(true)}
            onBlur={() => setNear(false)}
            autoComplete="off"
            className="focus-ring h-14 w-full min-w-0 rounded-full bg-raised pl-12 pr-4 text-h4 text-fg shadow-inset outline-none placeholder:text-subtle dark:bg-sunken/60"
          />
        </div>
        <div className="flex items-center gap-3 sm:shrink-0">
          <Orb size={44} state={q ? "typing" : near ? "typing" : "idle"} />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className="text-small text-muted">Not sure what to pick?</span>
            <AskAssistantButton prompt={query.trim() || undefined} />
          </div>
        </div>
      </RevealItem>

      {q ? (
        <RevealItem>
          <section aria-labelledby="catalog-matches" className="flex flex-col gap-4">
            <h2
              id="catalog-matches"
              className="text-h2 font-medium tracking-tight text-fg"
              aria-live="polite"
            >
              {matches.length} {matches.length === 1 ? "match" : "matches"} for &ldquo;
              {query.trim()}&rdquo;
            </h2>
            {matches.some((m) => m.rt.needsApproval) ? <ApprovalLegend /> : null}
            {matches.length ? (
              <CellList layout="grid" min="340px">
                {matches.map(({ team, rt }) => (
                  <TypeCell
                    key={`${team.slug}/${rt.slug}`}
                    rt={rt}
                    tone={teamTone(team.slug)}
                    teamName={team.name}
                  />
                ))}
              </CellList>
            ) : (
              <EmptyState
                variant="filtered"
                icon={<SearchX />}
                title={`Nothing matches "${query.trim()}"`}
                description="Try a different word, raise it under Something else, or ask the assistant to point you in the right direction."
                action={
                  <Button asChild>
                    <Link href="/help/new?type=something-else">Raise it anyway</Link>
                  </Button>
                }
                secondary={
                  <Button variant="secondary" onClick={() => openAssistant(query.trim())}>
                    <Sparkles />
                    Ask the assistant
                  </Button>
                }
              />
            )}
          </section>
        </RevealItem>
      ) : (
        <>
          <section aria-labelledby="catalog-title" className="flex flex-col gap-4">
            <RevealItem>
              <h2 id="catalog-title" className="text-h2 font-medium tracking-tight text-fg">
                Who can help
              </h2>
            </RevealItem>
            {/* Phones: a sideways deck of tiles (one and a bit in view) instead of four full-width slabs. */}
            <ul
              aria-label="Teams"
              className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 pt-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4"
            >
              {teams.map((team) => {
                const tone = teamTone(team.slug);
                const top = team.types.slice(0, 3);
                const selected = team.slug === current?.slug;
                return (
                  <li key={team.slug} className="w-[78%] min-w-0 shrink-0 snap-start sm:w-auto">
                    <RevealItem className="h-full">
                      <CategoryBlock
                        size="lg"
                        tone={tone}
                        icon={<TeamIcon name={team.icon} />}
                        title={<span id={`team-${team.slug}`}>{team.name}</span>}
                        subtitle={
                          team.types.length === 1
                            ? "1 thing to ask for"
                            : `${team.types.length} things to ask for`
                        }
                        className={cn(
                          "h-full transition-[box-shadow,transform] duration-200",
                          selected &&
                            "ring-2 ring-fg/85 ring-offset-[3px] ring-offset-surface dark:ring-white/80",
                        )}
                      >
                        <span className="flex flex-wrap gap-2">
                          {top.map((rt) => (
                            <CategoryChip
                              key={rt.slug}
                              tone={tone}
                              href={`/help/new?type=${encodeURIComponent(rt.slug)}`}
                            >
                              {rt.name}
                            </CategoryChip>
                          ))}
                          {team.types.length > top.length || !selected ? (
                            <button
                              type="button"
                              onClick={() => showTeam(team.slug)}
                              aria-pressed={selected}
                              aria-controls="catalog-team-list"
                              aria-label={`Show all ${team.types.length} ${team.name} requests`}
                              className={cn(
                                "focus-ring press relative z-10 inline-flex h-8 items-center gap-1 rounded-full px-3 text-small font-medium ring-1 backdrop-blur-sm",
                                selected
                                    ? "bg-white text-[var(--cb-ink)] ring-white"
                                    : "bg-white/20 ring-white/45 hover:bg-white/30",
                              )}
                            >
                              {selected ? "Showing all" : `All ${team.types.length}`}
                            </button>
                          ) : null}
                        </span>
                      </CategoryBlock>
                    </RevealItem>
                  </li>
                );
              })}
            </ul>
          </section>

          {current ? (
            <RevealItem>
              <section
                ref={listRef}
                id="catalog-team-list"
                aria-labelledby="catalog-team-title"
                className={cn("flex scroll-mt-24 flex-col gap-4 rounded-panel p-3 transition-colors duration-300 sm:p-6", SOFT[teamTone(current.slug)])}
              >
                <div className="flex flex-col gap-1">
                  <h2
                    id="catalog-team-title"
                    className="text-h2 font-medium tracking-tight text-fg"
                  >
                    Everything {current.name} can help with
                  </h2>
                  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                    {current.description ? <p className="text-body text-muted">{current.description}</p> : <span />}
                    {current.types.some((t) => t.needsApproval) ? <ApprovalLegend /> : null}
                  </div>
                </div>
                <CellList key={current.slug} layout="grid" min="340px">
                  {current.types.map((rt, i) => (
                    <TypeCell
                      key={rt.slug}
                      rt={rt}
                      tone={teamTone(current.slug)}
                      // Phones show the first four; the rest wait behind one button, so the page stays short.
                      wrapperClassName={!expanded && i >= PHONE_FIRST ? "max-sm:hidden" : undefined}
                    />
                  ))}
                </CellList>
                {!expanded && current.types.length > PHONE_FIRST ? (
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="focus-ring press inline-flex h-11 items-center justify-center rounded-full px-5 text-body font-medium text-fg cell sm:hidden"
                  >
                    Show {current.types.length - PHONE_FIRST} more {current.name} requests
                  </button>
                ) : null}
              </section>
            </RevealItem>
          ) : null}
        </>
      )}
    </Reveal>
  );
}

function TypeCell({
  rt,
  tone,
  teamName,
  wrapperClassName,
}: {
  rt: CatalogTeam["types"][number];
  tone: CategoryTone;
  teamName?: string;
  wrapperClassName?: string;
}) {
  return (
    <RowCell
      href={`/help/new?type=${encodeURIComponent(rt.slug)}`}
      wrapperClassName={wrapperClassName}
      leading={<ToneDisc tone={tone} name={rt.icon} />}
      title={rt.name}
      meta={
        rt.description ? (
          <span className="line-clamp-2 whitespace-normal">{rt.description}</span>
        ) : (
          teamName
        )
      }
      trailing={
        <>
          {teamName ? <span className="hidden text-caption text-muted sm:inline">{teamName}</span> : null}
          {rt.needsApproval ? <ApprovalMark /> : null}
        </>
      }
    />
  );
}

/** The one mark for "your manager approves this first", explained once in the list's caption. */
function ApprovalMark() {
  return (
    <span className="inline-flex size-8 items-center justify-center rounded-full bg-cat-blue-soft text-cat-blue-text" title="Needs approval">
      <ShieldCheck aria-hidden className="size-4 stroke-[1.75]" />
      <span className="sr-only">Needs approval</span>
    </span>
  );
}

function ApprovalLegend() {
  return (
    <span className="inline-flex items-center gap-2 text-body text-muted">
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-cat-blue-soft text-cat-blue-text" aria-hidden>
        <ShieldCheck className="size-3.5 stroke-[1.75]" />
      </span>
      Your manager approves these first
    </span>
  );
}

export function AskAssistantButton({
  prompt,
  label = "Ask the assistant",
  variant = "secondary",
}: {
  prompt?: string;
  label?: string;
  variant?: "secondary" | "ghost";
}) {
  return (
    <Button variant={variant} size="sm" onClick={() => openAssistant(prompt)}>
      <Sparkles />
      {label}
    </Button>
  );
}
