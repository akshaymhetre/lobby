import Link from "next/link";
import { ArrowRight, LifeBuoy, SearchX, Search as SearchIcon } from "lucide-react";
import { search, type SearchHit } from "@lobby/core/search";
import type { FreshnessState } from "@lobby/core/knowledge/freshness";
import { Page } from "@/components/page";
import { Masthead } from "@/components/ui/masthead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CellList, RowCell } from "@/components/ui/cells";
import { EmptyState } from "@/components/ui/empty-state";
import { controlBase } from "@/components/ui/input";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { Section } from "@/components/ui/section";
import { FRESHNESS_TONE } from "@/components/knowledge/freshness-badge";
import { FRESH } from "@/components/knowledge/freshness-tone";
import { AskAiButton } from "@/components/search/ask-ai-button";
import { BrowseSpaces } from "@/components/search/browse-spaces";
import { AskCard } from "@/components/search/ask-card";
import { KindStrip } from "@/components/search/kind-strip";
import { RecentlyViewed } from "@/components/search/recently-viewed";
import { ResultIcon } from "@/components/search/result-icon";
import { Snippet, splitTitle } from "@/components/search/snippet";
import { RESULT_GROUPS, type SearchResultType } from "@/components/search/types";
import { cn } from "@/lib/cn";
import { requireUser } from "@/server/auth";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim();
  return { title: q ? `${q} · Search` : "Search" };
}

const SUGGESTIONS = ["holiday allowance", "expenses limits", "VPN", "parental leave", "on-call pay", "London office"];
/** Rows shown per group before "Show all". */
const PER_GROUP = 5;

/** The search index carries freshness as a rank factor (1 = verified, 0.7 = due soon, 0.4 = stale). */
function freshnessOf(f: number): { state: FreshnessState; label: string } | null {
  if (f >= 1) return null;
  return f >= 0.7 ? { state: "due-soon", label: "Review due soon" } : { state: "stale", label: "Stale" };
}

const plainSnippet = (s: string) => s.replace(/\[\[|\]\]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
/**
 * A snippet that starts mid-sentence (lowercase first letter) gets a leading ellipsis so it reads
 * as an excerpt. Table cells in the index are joined with "|", which reads as markup; show a dot.
 */
const excerpt = (s: string) => {
  const t = s.replace(/\s*\|\s*/g, " · ").replace(/\s+/g, " ").trim();
  return /^(\[\[)?[a-z]/.test(t) ? `… ${t}` : t;
};

/*
 * The results page, v2. One prose column: the query in a raised well, the type filter as a
 * sunken track with a raised pill, then result groups as rows in panels. The groups build in
 * with a short stagger (the screen's one authored moment); page results carry their freshness
 * chip in its category colour.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 200);
  const type = RESULT_GROUPS.some((g) => g.type === sp.type) ? (sp.type as SearchResultType) : null;
  const all = q ? await search({ principals: ctx.principals, query: q, limit: 50 }) : [];
  const counts = new Map<SearchResultType, number>();
  for (const h of all) counts.set(h.sourceType, (counts.get(h.sourceType) ?? 0) + 1);
  const hits = q && type ? await search({ principals: ctx.principals, query: q, types: [type], limit: 50 }) : all;
  if (type) counts.set(type, hits.length);
  const href = (t: SearchResultType | null) => `/search?q=${encodeURIComponent(q)}${t ? `&type=${t}` : ""}`;

  // Grouped by type, in display order. A type filter shows one group in full.
  const groups = RESULT_GROUPS.map((g) => ({ ...g, items: hits.filter((h) => h.sourceType === g.type) })).filter((g) => g.items.length);
  const typeLabel = type ? RESULT_GROUPS.find((g) => g.type === type)?.label.toLowerCase() : null;
  const groupWords = (g: (typeof groups)[number]) => `${g.items.length} ${g.items.length === 1 ? g.singular.toLowerCase() : g.label.toLowerCase()}`;
  // One group: say it once ("4 pages for "holiday""). Several: the total, then the split.
  const summary = q
    ? hits.length
      ? groups.length === 1
        ? `${groupWords(groups[0]!)} for "${q}"${typeLabel ? ` in ${typeLabel}` : ""}.`
        : `${hits.length} results for "${q}"${typeLabel ? ` in ${typeLabel}` : ""}: ${groups.map(groupWords).join(", ")}.`
      : `Nothing matches "${q}"${typeLabel ? ` in ${typeLabel}` : ""}.`
    : undefined;
  // The Pages tile splits its bar by freshness, read from the index's rank factor.
  const pageFreshness: Record<FreshnessState, number> = { verified: 0, "due-soon": 0, stale: 0, unset: 0 };
  for (const h of all) if (h.sourceType === "page") pageFreshness[freshnessOf(h.freshness)?.state ?? "verified"] += 1;

  return (
    <Page width="wide">
      <Masthead
        title="Search"
        today={summary}
        description={q ? undefined : "Find pages, people, apps, help topics and your tickets."}
      >
        <form action="/search" method="get" role="search" className="relative mt-5 max-w-[720px]">
          {type ? <input type="hidden" name="type" value={type} /> : null}
          <label htmlFor="search-q" className="sr-only">
            Search
          </label>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 stroke-[1.5] text-subtle" aria-hidden />
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={q}
            autoFocus={!q}
            placeholder="Search pages, people, apps and help topics"
            autoComplete="off"
            className={cn(controlBase, "h-12 rounded-full pl-11 pr-5 text-body-lg md:h-11")}
          />
        </form>
        {q && all.length ? (
          <KindStrip counts={counts} pageFreshness={pageFreshness} active={type} hrefFor={href} total={all.length} />
        ) : null}
      </Masthead>

      {q ? (
        hits.length ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
          <Reveal stagger={0.07} className="section-stack min-w-0">
            {groups.map((g) => {
              const shown = type ? g.items : g.items.slice(0, PER_GROUP);
              const more = g.items.length - shown.length;
              return (
                <RevealItem key={g.type}>
                  <Section
                    title={g.label}
                    count={g.items.length}
                    action={
                      more > 0 ? (
                        <Link href={href(g.type)} className="focus-ring inline-flex items-center gap-1 rounded-[4px] text-small font-medium text-accent-text hover:underline hover:underline-offset-4">
                          Show all {g.items.length}
                          <ArrowRight className="size-3.5 stroke-[1.75]" aria-hidden />
                        </Link>
                      ) : null
                    }
                  >
                    <CellList>
                      {shown.map((h, i) => (
                        <ResultRow key={`${h.sourceType}-${h.sourceId}`} hit={h} previous={shown[i - 1]} />
                      ))}
                    </CellList>
                  </Section>
                </RevealItem>
              );
            })}
            <RevealItem from="fade">
              <p className="text-small text-muted">
                Not what you needed?{" "}
                <AskAiButton query={q} variant="link" icon={false} className="text-small">
                  Ask the assistant
                </AskAiButton>{" "}
                or{" "}
                <Link href="/help/new" className="focus-ring rounded-[2px] text-accent-text underline-offset-4 hover:underline">
                  raise a ticket
                </Link>
                .
              </p>
            </RevealItem>
          </Reveal>
          <div className="hidden lg:block">
            <div className="sticky top-[88px]">
              <AskCard query={q} />
            </div>
          </div>
          </div>
        ) : (
          <div className="section-stack">
          <EmptyState
            variant="filtered"
            icon={<SearchX />}
            title={`No results for “${q}”${typeLabel ? ` in ${typeLabel}` : ""}`}
            description="Try fewer or different words. The assistant can also answer questions in plain language."
            action={<AskAiButton query={q} />}
            secondary={
              type ? (
                <Button variant="secondary" asChild>
                  <Link href={href(null)}>Search everything</Link>
                </Button>
              ) : (
                <Button variant="secondary" asChild>
                  <Link href="/help/new">
                    <LifeBuoy aria-hidden />
                    Raise a ticket
                  </Link>
                </Button>
              )
            }
          />
          <BrowseSpaces ctx={ctx} title="Or browse a space" />
          </div>
        )
      ) : (
        <div className="section-stack">
          <Section title="People often search for">
            <ul className="flex flex-wrap gap-2.5">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <Link
                    href={`/search?q=${encodeURIComponent(s)}`}
                    className="focus-ring cell press inline-flex h-11 items-center rounded-full px-4 text-body font-medium text-fg hover:shadow-cell-hover"
                  >
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
          <RecentlyViewed />
          <BrowseSpaces ctx={ctx} />
        </div>
      )}
    </Page>
  );
}

/**
 * One result as a raised cell: a type plate, the title (and section), one line of snippet. A page's
 * plate carries its freshness: a quiet plate when verified, a filled amber block when due soon, a
 * filled coral block when stale. A snippet identical to the previous row's (shared team blurbs on
 * help topics) is dropped rather than repeated.
 */
function ResultRow({ hit, previous }: { hit: SearchHit; previous?: SearchHit }) {
  const t = splitTitle(hit.title);
  const fresh = hit.sourceType === "page" ? freshnessOf(hit.freshness) : null;
  const repeated = !!previous?.snippet && !!hit.snippet && plainSnippet(previous.snippet) === plainSnippet(hit.snippet);
  return (
    <RowCell
      href={hit.url}
      aria-label={`${t.title}${t.section ? `, ${t.section}` : ""}${fresh ? `, ${fresh.label.toLowerCase()}` : ""}`}
      leading={
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-[14px]",
            fresh ? cn(FRESH[fresh.state].fill, "shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]") : "bg-sunken text-muted shadow-inset",
          )}
        >
          <ResultIcon type={hit.sourceType} className="size-5 stroke-[1.75]" />
        </span>
      }
      title={
        <>
          {t.title}
          {t.section ? <span className="font-normal text-muted"> › {t.section}</span> : null}
        </>
      }
      trailing={
        fresh ? (
          <Badge size="sm" tone={FRESHNESS_TONE[fresh.state]} dot className="hidden sm:inline-flex">
            {fresh.label}
          </Badge>
        ) : undefined
      }
    >
      {hit.snippet && !repeated ? <Snippet text={excerpt(hit.snippet)} className="line-clamp-2 text-small text-muted sm:line-clamp-1" /> : null}
      {/* On phones the chip moves under the snippet, so the title keeps its width. */}
      {fresh ? (
        <Badge size="sm" tone={FRESHNESS_TONE[fresh.state]} dot className="mt-1.5 sm:hidden">
          {fresh.label}
        </Badge>
      ) : null}
    </RowCell>
  );
}
