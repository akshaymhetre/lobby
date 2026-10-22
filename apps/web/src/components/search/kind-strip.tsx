import Link from "next/link";
import { Layers } from "lucide-react";
import type { FreshnessState } from "@lobby/core/knowledge/freshness";
import { CountUp } from "@/components/ui/motion";
import { FRESH } from "@/components/knowledge/freshness-tone";
import { cn } from "@/lib/cn";
import { ResultIcon } from "./result-icon";
import { RESULT_GROUPS, type SearchResultType } from "./types";

/**
 * The results page hero: what the query found, by kind. Six tiles in a row, each with its count
 * and a bar scaled to the biggest group, so the shape of the answer is visible before any row.
 * The Pages tile splits its bar by freshness (the one place colour appears here), and a tile is
 * also the filter: the active one is the raised cell. Kinds with nothing found sit dimmed.
 */
export function KindStrip({
  counts,
  pageFreshness,
  active,
  hrefFor,
  total,
}: {
  counts: Map<SearchResultType, number>;
  /** Page hits by freshness, for the Pages tile's bar. */
  pageFreshness: Record<FreshnessState, number>;
  active: SearchResultType | null;
  hrefFor: (t: SearchResultType | null) => string;
  total: number;
}) {
  const max = Math.max(1, ...RESULT_GROUPS.map((g) => counts.get(g.type) ?? 0));
  const order: FreshnessState[] = ["verified", "unset", "due-soon", "stale"];
  const none = RESULT_GROUPS.filter((g) => !(counts.get(g.type) ?? 0) && g.type !== active).map((g) => g.label);
  return (
    <nav aria-label="Filter results by type" className="mt-5">
      <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0">
        <li className="w-[calc((100%-12px)/3)] min-w-[104px] shrink-0 sm:w-auto">
          <Tile href={hrefFor(null)} active={!active} label="All" count={total} icon={null} bar={null} />
        </li>
        {RESULT_GROUPS.filter((g) => (counts.get(g.type) ?? 0) > 0 || g.type === active).map((g, i) => {
          const n = counts.get(g.type) ?? 0;
          const width = (n / max) * 100;
          const bar =
            g.type === "page" && n ? (
              <span className="flex h-full gap-px overflow-hidden rounded-full" style={{ width: `${width}%` }}>
                {order
                  .filter((k) => pageFreshness[k] > 0)
                  .map((k) => (
                    <span key={k} className={cn("h-full", k === "unset" ? "bg-border-strong" : FRESH[k].fill)} style={{ flexGrow: pageFreshness[k] }} />
                  ))}
              </span>
            ) : null;
          return (
            <li key={g.type} className="w-[calc((100%-12px)/3)] min-w-[104px] shrink-0 sm:w-auto">
              <Tile
                href={n ? hrefFor(g.type) : null}
                active={active === g.type}
                label={g.label}
                count={n}
                icon={g.type}
                bar={bar}
                delay={0.06 * (i + 1)}
                note={
                  g.type === "page" && n
                    ? [
                        pageFreshness.verified + pageFreshness.unset ? `${pageFreshness.verified + pageFreshness.unset} verified` : null,
                        pageFreshness["due-soon"] ? `${pageFreshness["due-soon"]} due` : null,
                        pageFreshness.stale ? `${pageFreshness.stale} stale` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : undefined
                }
              />
            </li>
          );
        })}
      </ul>
      {none.length ? <p className="mt-2 text-caption text-muted">Nothing in {none.join(", ").toLowerCase()}.</p> : null}
    </nav>
  );
}

function Tile({
  href,
  active,
  label,
  count,
  icon,
  bar,
  delay = 0,
  note,
}: {
  href: string | null;
  active: boolean;
  label: string;
  count: number;
  icon: SearchResultType | null;
  bar: React.ReactNode;
  delay?: number;
  /** One line under the bar: the Pages tile spells out its freshness split. */
  note?: string;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        {/* "Help topics" does not fit a third of a phone; it reads as "Help" there. */}
        <span className="truncate text-caption font-medium text-muted">
          {label === "Help topics" ? (
            <>
              Help<span className="hidden sm:inline"> topics</span>
            </>
          ) : (
            label
          )}
        </span>
        {icon ? <ResultIcon type={icon} className="size-3.5 shrink-0 stroke-[1.75] text-subtle" /> : <Layers className="size-3.5 shrink-0 stroke-[1.75] text-subtle" aria-hidden />}
      </span>
      <CountUp value={count} duration={0.8} delay={delay} className="text-h2 font-medium tracking-[-0.02em] text-fg sm:text-hero" />
      {/* Only Pages carries a bar: its freshness split is the one thing colour says here. */}
      {bar ? (
        <span className="flex h-1.5 w-full rounded-full bg-sunken" aria-hidden>
          {bar}
        </span>
      ) : (
        <span className="h-1.5" aria-hidden />
      )}
      {note ? <span className="hidden truncate text-caption text-muted sm:block">{note}</span> : null}
    </>
  );
  const base = "flex h-full min-h-[84px] flex-col justify-start gap-2 rounded-card px-3 py-2.5 sm:min-h-[104px]";
  if (!href) {
    return (
      <span className={cn(base, "border border-dashed border-border [&_.tabular]:text-subtle")} aria-label={`${label}: none`}>
        {body}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={`${label}: ${count}`}
      className={cn(
        base,
        "focus-ring press",
        active ? "cell ring-2 ring-accent/70" : "bg-sunken/60 hover:bg-raised hover:shadow-cell",
      )}
    >
      {body}
    </Link>
  );
}
