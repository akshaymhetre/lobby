import Link from "next/link";
import { ArrowUpRight, BookOpen, ChevronRight, LayoutGrid, LifeBuoy, UserRound, type LucideIcon } from "lucide-react";
import { buildExcerpt, cleanSnippet, cutSentences } from "./excerpt";
import { cn } from "@/lib/cn";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { HeroLight } from "@/components/ui/hero-light";

export interface Citation {
  sourceType: string;
  sourceId: string;
  title: string;
  url: string;
  /** Retrieval-only answers (wave 3): the matched chunk, to cut a clean excerpt from. */
  excerpt?: string;
  /** Retrieval-only answers: the search freshness factor (pages: 1 verified, 0.7 review due, 0.4 stale). */
  freshness?: number;
}

const SOURCE_ICON: Record<string, LucideIcon> = {
  page: BookOpen,
  request_type: LifeBuoy,
  person: UserRound,
  app: LayoutGrid,
};

const SOURCE_KIND: Record<string, string> = {
  page: "Knowledge",
  request_type: "Help",
  person: "People",
  app: "Apps",
};

/**
 * In retrieval-only mode the server writes its answer as one block per hit:
 *   **Title** [n]
 *   snippet...
 * Read that back into rows so the results can be laid out as a reading list rather than as prose.
 * Returns null when the text is not in that shape (a generated answer, an "I could not find" line).
 */
export function parseRetrieval(text: string, citations: Citation[]): { citation: Citation; snippet: string }[] | null {
  if (!citations.length) return null;
  const byNumber = new Map(citations.map((c) => [c.sourceId, c]));
  const rows: { citation: Citation; snippet: string }[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
    const m = /^\*\*(.+?)\*\*\s*\[(\d{1,2})\]\n?([\s\S]*)$/.exec(block.trim());
    if (!m) return null;
    const citation = byNumber.get(m[2]!);
    if (!citation) return null;
    rows.push({ citation, snippet: m[3]!.trim() });
  }
  return rows.length ? rows : null;
}

/** A search excerpt that starts mid-sentence gets a leading ellipsis, so it reads as an excerpt and not as a broken line. */
const excerpt = (s: string) => (/^[a-z]/.test(s) ? `\u2026${s}` : s);

/**
 * Numbered source rows under an answer. With `snippets`, each row carries the matching excerpt and
 * is the whole answer (retrieval-only mode); without, it is the compact list of what a generated
 * answer cited. The heading text "Sources" and the row links are part of the e2e contract.
 */
/** `highlightFirst` runs the border beam once around the top source after the answer lands, to pull the eye to the best match. */
export function SourceList({ rows, className, highlightFirst = false }: { rows: { citation: Citation; snippet?: string }[]; className?: string; highlightFirst?: boolean }) {
  const rich = rows.some((r) => r.snippet);
  return (
    <section aria-label="Sources" className={cn(className)}>
      <p className="mb-1 flex items-baseline gap-2 text-small font-medium text-muted">
        <span>Sources</span>
        <span className="font-normal text-subtle tabular">{rows.length}</span>
      </p>
      <ol className="divide-y divide-border">
        {rows.map(({ citation: c, snippet }, i) => {
          const Icon = SOURCE_ICON[c.sourceType] ?? BookOpen;
          const kind = SOURCE_KIND[c.sourceType] ?? c.sourceType;
          const sweep = highlightFirst && i === 0;
          const link = (
              <Link
                href={c.url}
                className={cn(
                  "group focus-ring -mx-2 flex gap-3 rounded-control px-2 transition-colors duration-120 hover:bg-hover",
                  rich ? "py-2.5" : "min-h-10 items-center py-1.5",
                )}
              >
                <span className="w-4 shrink-0 pt-px text-right text-small font-semibold tabular text-accent-text">{c.sourceId}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn("flex items-center gap-2", rich ? "text-body font-medium text-fg" : "text-small text-fg")}>
                    <span className="truncate">{c.title}</span>
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-caption text-subtle">
                      <Icon className="size-3.5 stroke-[1.5]" aria-hidden />
                      {kind}
                    </span>
                  </span>
                  {snippet ? <span className="mt-0.5 line-clamp-3 block text-small leading-[1.5] text-muted">{excerpt(snippet)}</span> : null}
                </span>
                <ChevronRight aria-hidden className={cn("size-4 shrink-0 self-center stroke-[1.5] text-subtle transition-colors duration-120 group-hover:text-fg", rich && "self-start mt-1")} />
              </Link>
          );
          return (
            <li key={c.sourceId}>
              {sweep ? (
                <div className="relative isolate -mx-2 rounded-card [&>a]:mx-0">
                  <BorderBeam tone="accent" size="sm" intensity="subtle" loops={1} duration={1.3} delay={0.2} settle="none" />
                  {link}
                </div>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ answer cards (wave 3) */

const KIND_LONG: Record<string, string> = {
  page: "Knowledge page",
  request_type: "Help request",
  person: "Person",
  app: "App",
};

/** Freshness in words, for pages only: the search factor maps 1 / 0.7 / 0.4 to the freshness engine's states. */
function freshnessOf(c: Citation): { label: string; tone: "success" | "warning" | "danger" } | null {
  if (c.sourceType !== "page" || typeof c.freshness !== "number") return null;
  if (c.freshness >= 0.95) return { label: "Verified", tone: "success" };
  if (c.freshness <= 0.45) return { label: "Stale, check with the owner", tone: "danger" };
  return { label: "Due for review", tone: "warning" };
}

/** "Parental leave › What you get" -> { page: "Parental leave", section: "What you get" } */
function splitTitle(t: string) {
  const i = t.indexOf(" \u203a ");
  return i === -1 ? { page: t, section: null } : { page: t.slice(0, i), section: t.slice(i + 3) };
}

/**
 * Retrieval-only answers as designed cards (wave 3, problem 9): the best match leads with its key
 * fact set big (when the page has one, e.g. "26 weeks / Full pay"), then a clean excerpt cut on
 * sentence boundaries, the source kind and its freshness, and an Open action. The rest follow as
 * compact cards. The heading "Sources" and a link per source NAMED BY ITS TITLE are the e2e contract:
 * each card's title is the link, stretched over the whole card.
 */
export function AnswerCards({ rows }: { rows: { citation: Citation; snippet: string }[] }) {
  // The answer line: when the best match carries a key fact, say it as a sentence before the sources.
  const first = rows[0]?.citation;
  const key = first?.excerpt ? buildExcerpt(first.excerpt).keyFact : null;
  const topic = first ? splitTitle(first.title).page : "";
  return (
    <section aria-label="Sources" className="flex flex-col gap-3">
      {key ? (
        <p className="text-h4 font-medium text-fg text-pretty">
          {topic}: {key.value} {key.label.toLowerCase()}.
        </p>
      ) : null}
      <p className="flex items-baseline gap-2 text-small font-medium text-muted">
        <span>Sources</span>
        <span className="font-normal text-subtle tabular">{rows.length}</span>
      </p>
      <ol className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={r.citation.sourceId} className="list-none">
            <AnswerCard citation={r.citation} snippet={r.snippet} lead={i === 0} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function AnswerCard({ citation: c, snippet, lead }: { citation: Citation; snippet: string; lead: boolean }) {
  const ex = c.excerpt ? buildExcerpt(c.excerpt) : null;
  const full = ex ? ex.text : cleanSnippet(snippet);
  // Supporting cards carry whole sentences only, never a clamp mid-sentence: lead up to 220 chars, others 120.
  const text = lead ? full : cutSentences(full, 120);
  const { page, section } = splitTitle(c.title);
  const fresh = freshnessOf(c);
  const Icon = SOURCE_ICON[c.sourceType] ?? BookOpen;
  const kind = KIND_LONG[c.sourceType] ?? SOURCE_KIND[c.sourceType] ?? c.sourceType;
  const key = lead ? ex?.keyFact ?? null : null;
  const facts = ex ? ex.facts.filter((f) => !key || f.label !== key.label).slice(0, lead ? 3 : 1) : [];
  const items = ex ? ex.items.slice(0, lead ? 3 : 1) : [];
  return (
    <article
      className={cn(
        "group/answer relative isolate rounded-card transition-shadow duration-160",
        // The lead card is the answer: raised, lit by the assistant's own blue. The rest are supporting sources: quieter wells.
        lead ? "cell overflow-hidden p-4 hover:shadow-cell-hover" : "bg-surface p-3.5 shadow-highlight hover:bg-raised dark:bg-surface/70",
      )}
    >
      {lead ? <HeroLight tone="blue" position="top-right" /> : null}
      {lead ? <BorderBeam tone="accent" intensity="subtle" loops={1} duration={1.6} delay={0.25} settle="none" /> : null}
      <header className="flex items-start gap-3">
        <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          <Icon className="size-[18px] stroke-[1.75]" />
        </span>
        <div className="min-w-0 flex-1">
          {/* The link that names the source; its ::after stretches over the card so the whole card opens it. */}
          <Link
            href={c.url}
            // Named by the full source title ("Parental leave › What you get"): the e2e contract finds sources by title.
            aria-label={c.title}
            className="focus-ring rounded-[4px] text-row font-medium text-fg after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[var(--lb-accent-ring)]"
          >
            {section ?? page}
          </Link>
          <p className="truncate text-caption text-muted">{section ? page : kind}</p>
        </div>
        <span aria-hidden className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-raised px-3 text-small font-medium text-fg shadow-cell transition-[transform,box-shadow] duration-160 group-hover/answer:-translate-y-px group-hover/answer:shadow-cell-hover">
          Open
          <ArrowUpRight className="size-3.5 stroke-[1.75]" />
        </span>
      </header>

      {key ? (
        <div className="mt-3 flex items-baseline gap-2.5 rounded-cell bg-accent-soft/60 px-3.5 py-3">
          <span className="text-hero font-medium text-fg">{key.value}</span>
          <span className="text-row text-muted">{key.label.toLowerCase()}</span>
        </div>
      ) : null}

      {facts.length ? (
        <dl className="mt-3 flex flex-col gap-1.5">
          {facts.map((f) => (
            <div key={f.label} className="flex gap-3 text-small">
              <dt className="w-[42%] shrink-0 text-muted">{f.label}</dt>
              <dd className="min-w-0 flex-1 font-medium text-fg">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {items.length ? (
        <ol className="mt-3 flex flex-col gap-1.5">
          {items.map((it, n) => (
            <li key={n} className="flex gap-2.5 text-small text-fg">
              <span aria-hidden className="tabular inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sunken text-caption font-semibold text-muted">
                {n + 1}
              </span>
              <span className="min-w-0 line-clamp-2">{it}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {text ? <p className={cn("mt-2.5 text-body text-muted text-pretty", lead ? "line-clamp-5" : "line-clamp-3")}>{text}</p> : null}

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full bg-sunken px-2.5 text-caption text-muted">
          <Icon className="size-3.5 stroke-[1.75]" aria-hidden />
          {kind}
        </span>
        {fresh ? (
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-caption",
              fresh.tone === "success" && "bg-success-soft text-success-text",
              fresh.tone === "warning" && "bg-warning-soft text-warning-text",
              fresh.tone === "danger" && "bg-danger-soft text-danger-text",
            )}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {fresh.label}
          </span>
        ) : null}
      </footer>
    </article>
  );
}
