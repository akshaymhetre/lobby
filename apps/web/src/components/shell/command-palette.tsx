"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui";
import { ArrowRight, BookOpen, CornerDownLeft, History, LayoutGrid, LifeBuoy, Loader2, Network, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import type { FreshnessState } from "@lobby/core/knowledge/freshness";
import { AnimatePresence, motion } from "motion/react";
import { Orb } from "@/components/ui/effects/orb";
import { useMotionReduced } from "@/components/ui/motion";
import { FRESHNESS_TONE } from "@/components/knowledge/freshness-badge";
import { FRESH } from "@/components/knowledge/freshness-tone";
import { ResultIcon } from "@/components/search/result-icon";
import { Snippet, SnippetTitle, splitTitle } from "@/components/search/snippet";
import { RESULT_GROUPS, type SearchResult, type SearchResultType } from "@/components/search/types";
import { MAX_RECENT, readRecent, readVisited, writeRecent, writeVisited, type Visited } from "@/components/search/visited";
import { paletteSearchAction } from "@/app/(app)/search/_actions";
import { cn } from "@/lib/cn";
import { openAssistant, SHELL_EVENTS } from "./shell-events";

/** Which detail pages count as "recently viewed", and what icon they get. Lists and utilities do not. */
const VISITED_ROUTES: { rx: RegExp; type: SearchResultType }[] = [
  { rx: /^\/knowledge\/[^/]+\/[^/]+$/, type: "page" },
  { rx: /^\/people\/[^/]+$/, type: "person" },
  { rx: /^\/news\/[^/]+$/, type: "post" },
  { rx: /^\/(help|queue)\/\d+$/, type: "ticket" },
  { rx: /^\/help\/new\/[^/]+$/, type: "request_type" },
];

const QUICK_ACTIONS = [
  { id: "ticket", label: "Raise a ticket", href: "/help/new", icon: LifeBuoy, keywords: "help support it request problem" },
  { id: "apps", label: "Go to Apps", href: "/apps", icon: LayoutGrid, keywords: "launcher tools sso" },
  { id: "org", label: "Org chart", href: "/org-chart", icon: Network, keywords: "people team reports manager" },
  { id: "knowledge", label: "Browse knowledge", href: "/knowledge", icon: BookOpen, keywords: "pages policies handbook wiki" },
];

/** A page result's freshness, from the index's rank factor (1 = verified, 0.7 = due soon, 0.4 = stale). */
/** A snippet that starts mid-sentence (lowercase first letter) reads as an excerpt with a leading ellipsis. */
const excerpt = (t: string) => (/^(\[\[)?[a-z]/.test(t.trim()) ? `… ${t.trim()}` : t);

function freshnessOf(r: SearchResult) {
  if (r.type !== "page" || r.freshness >= 1) return null;
  return r.freshness >= 0.7 ? { tone: FRESHNESS_TONE["due-soon"], label: "Due soon", state: "due-soon" as const } : { tone: FRESHNESS_TONE.stale, label: "Stale", state: "stale" as const };
}
const stateOf = (r: SearchResult): FreshnessState | null => (r.type !== "page" ? null : (freshnessOf(r)?.state ?? "verified"));

/*
 * The palette's own classes. The kit's Command pieces are not used here because the frame, the
 * input height and the row shape are the v2 material: a raised slab in light, teal glass in dark,
 * a 56px input, 40px rows with a raised selection, and a trailing "Open" hint on the active row.
 */
const groupClass =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-subtle";

function Row({ className, hint = "Open", trailing, children, ...props }: React.ComponentProps<typeof CommandPrimitive.Item> & { hint?: string; trailing?: React.ReactNode }) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "group relative flex min-h-12 cursor-pointer select-none items-center gap-3 rounded-[12px] px-2 py-1.5 text-body text-fg outline-none",
        "transition-[background-color,box-shadow] duration-120 ease-standard",
        "data-[selected=true]:bg-accent-soft/70 data-[selected=true]:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--lb-accent)_22%,transparent)] dark:data-[selected=true]:bg-white/[0.08] dark:data-[selected=true]:shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <span className="ml-auto flex shrink-0 items-center gap-2 pl-3">
        {trailing}
        <span className="hidden items-center gap-1 text-caption text-subtle opacity-0 transition-opacity duration-120 group-data-[selected=true]:opacity-100 sm:inline-flex" aria-hidden>
          {hint}
          <Kbd>
            <CornerDownLeft className="size-3" aria-hidden />
          </Kbd>
        </span>
      </span>
    </CommandPrimitive.Item>
  );
}

/** The Raycast-style icon tile at the start of every row. A page's tile is tinted by its freshness. */
function IconTile({ children, tone, size = "md" }: { children: React.ReactNode; tone?: FreshnessState | null; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center [&>svg]:shrink-0",
        size === "lg" ? "size-12 rounded-[14px] [&>svg]:size-5 [&>svg]:stroke-[1.75]" : "size-8 rounded-[10px] [&>svg]:size-4 [&>svg]:stroke-[1.75]",
        tone ? cn(FRESH[tone].soft, FRESH[tone].text) : "bg-sunken text-muted shadow-inset",
      )}
    >
      {children}
    </span>
  );
}

/** What the preview pane can show for the selected row. */
interface Preview {
  kind: string;
  type: SearchResultType;
  title: string;
  snippet?: string;
  url: string;
  fresh: FreshnessState | null;
}

/**
 * Global Cmd-K palette, in the Raycast and Linear idiom with the v2 material: one large input,
 * groups with small headings, rows that carry a bare icon, a title and one quiet line, a footer
 * of key hints. Type-ahead search across everything the user may see, recently viewed pages,
 * recent searches and quick actions.
 */
export function CommandPalette({ aiEnabled = true }: { aiEnabled?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [searchedFor, setSearchedFor] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [recent, setRecent] = React.useState<string[]>([]);
  const [visited, setVisited] = React.useState<Visited[]>([]);
  const [selected, setSelected] = React.useState("");
  const requestId = React.useRef(0);

  // Open from anywhere: Cmd/Ctrl-K, or the shell's search button via the event bus.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = (e: Event) => {
      const q = (e as CustomEvent<{ query?: string }>).detail?.query;
      if (typeof q === "string") setQuery(q);
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(SHELL_EVENTS.openPalette, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SHELL_EVENTS.openPalette, onOpen);
    };
  }, []);

  // Remember detail pages as they are opened. The title is read after the route has rendered,
  // and the product suffix ("Holiday policy · Lobby") is dropped.
  React.useEffect(() => {
    if (!pathname) return;
    const route = VISITED_ROUTES.find((r) => r.rx.test(pathname));
    if (!route) return;
    const t = setTimeout(() => {
      const raw = document.title;
      const title = raw.includes(" · ") ? raw.slice(0, raw.lastIndexOf(" · ")).trim() : raw.trim();
      if (!title || /not found|editing /i.test(title)) return;
      const next = [{ href: pathname, title, type: route.type }, ...readVisited().filter((v) => v.href !== pathname)];
      writeVisited(next);
    }, 600);
    return () => clearTimeout(t);
  }, [pathname]);

  React.useEffect(() => {
    if (open) {
      setRecent(readRecent());
      setVisited(readVisited().filter((v) => v.href !== pathname));
    }
  }, [open, pathname]);

  // Debounced server search; stale responses are dropped.
  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearchedFor("");
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      try {
        const r = await paletteSearchAction(q);
        if (id !== requestId.current) return;
        setResults(r);
        setSearchedFor(q);
        // Land on the best match (as Raycast does), so the preview pane opens on it.
        const first = RESULT_GROUPS.map((g) => r.find((x) => x.type === g.type)).find(Boolean);
        if (first) setSelected(`${first.type}-${first.id}`);
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 140);
    return () => clearTimeout(t);
  }, [query]);

  const remember = (q: string) => {
    const v = q.trim();
    if (!v) return;
    const next = [v, ...readRecent().filter((x) => x.toLowerCase() !== v.toLowerCase())];
    writeRecent(next);
    setRecent(next.slice(0, MAX_RECENT));
  };

  const close = () => {
    setOpen(false);
  };

  const go = (href: string, rememberQuery = true) => {
    if (rememberQuery) remember(query);
    close();
    setQuery("");
    router.push(href);
  };

  const ask = () => {
    const q = query.trim();
    remember(q);
    close();
    setQuery("");
    openAssistant(q || undefined);
  };

  const clearRecent = () => {
    writeRecent([]);
    setRecent([]);
  };

  const q = query.trim();
  const ql = q.toLowerCase();
  const actions = q ? QUICK_ACTIONS.filter((a) => `${a.label} ${a.keywords}`.toLowerCase().includes(ql)) : QUICK_ACTIONS;
  const grouped = RESULT_GROUPS.map((g) => ({ ...g, items: results.filter((r) => r.type === g.type).slice(0, g.type === "page" ? 6 : 4) })).filter(
    (g) => g.items.length,
  );
  const showingStale = q && searchedFor !== q;
  const previews = new Map<string, Preview>();
  for (const g of grouped)
    for (const r of g.items)
      previews.set(`${r.type}-${r.id}`, { kind: g.singular, type: r.type, title: r.title, snippet: r.snippet, url: r.url, fresh: stateOf(r) });
  if (!q)
    for (const v of visited)
      previews.set(`visited-${v.href}`, { kind: RESULT_GROUPS.find((g) => g.type === v.type)?.singular ?? "Page", type: v.type, title: v.title, url: v.href, fresh: null });
  const preview = previews.get(selected) ?? null;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[6px] backdrop-saturate-[0.8] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[10dvh] z-50 w-[calc(100vw-24px)] max-w-[680px] -translate-x-1/2 overflow-hidden outline-none md:max-w-[820px]",
            "rounded-panel bg-raised text-fg shadow-dialog",
            "dark:bg-glass-strong dark:backdrop-blur-2xl dark:backdrop-saturate-[1.3]",
            "data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
          )}
        >
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>Search Lobby</DialogPrimitive.Title>
          </VisuallyHidden.Root>
          <CommandPrimitive shouldFilter={false} loop value={selected} onValueChange={setSelected} className="flex size-full flex-col overflow-hidden">
            <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:px-5">
              <Search className="size-[18px] shrink-0 stroke-[1.5] text-subtle" aria-hidden />
              <CommandPrimitive.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search pages, people and apps"
                aria-label="Search"
                className="h-full w-full min-w-0 bg-transparent text-body-lg text-fg outline-none placeholder:text-subtle sm:text-[18px]"
              />
              {loading ? (
                <Loader2 className="size-4 shrink-0 animate-spin-slow stroke-[1.5] text-subtle" aria-label="Searching" />
              ) : q ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="focus-ring touch-target inline-flex size-7 shrink-0 items-center justify-center rounded-full text-subtle transition-colors duration-120 hover:bg-hover hover:text-fg"
                  aria-label="Clear search"
                >
                  <X className="size-3.5 stroke-[1.75]" aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="h-px bg-border" aria-hidden />

            <div className="grid min-h-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_272px]">
            <CommandPrimitive.List aria-busy={loading || undefined} className="h-[min(440px,62dvh)] scroll-py-2 overflow-y-auto overflow-x-hidden p-2 sm:p-3 md:h-[440px]">
              {q && !loading && !showingStale && !results.length ? (
                <div className="px-3 pb-3 pt-5 text-center" role="status">
                  <p className="text-body font-medium text-fg">Nothing matches &ldquo;{q}&rdquo;</p>
                  <p className="mt-1 text-small text-muted">Try a different word{aiEnabled ? ", or ask the assistant below" : ""}.</p>
                </div>
              ) : null}

              {!q && visited.length ? (
                <CommandPrimitive.Group heading="Recently viewed" className={groupClass}>
                  {visited.map((v) => (
                    <Row
                      key={`visited-${v.href}`}
                      value={`visited-${v.href}`}
                      onSelect={() => go(v.href, false)}
                      trailing={<span className="text-caption text-subtle">{RESULT_GROUPS.find((g) => g.type === v.type)?.singular}</span>}
                    >
                      <IconTile>
                        <ResultIcon type={v.type} />
                      </IconTile>
                      <span className="min-w-0 flex-1 truncate">{v.title}</span>
                    </Row>
                  ))}
                </CommandPrimitive.Group>
              ) : null}

              {!q && recent.length ? (
                <CommandPrimitive.Group heading="Recent searches" className={groupClass}>
                  {recent.map((r) => (
                    <Row key={`recent-${r}`} value={`recent-${r}`} onSelect={() => setQuery(r)} hint="Search">
                      <IconTile>
                        <History aria-hidden />
                      </IconTile>
                      <span className="min-w-0 flex-1 truncate">{r}</span>
                    </Row>
                  ))}
                  <Row value="recent-clear" onSelect={clearRecent} hint="Clear" className="text-muted">
                    <IconTile>
                      <X aria-hidden />
                    </IconTile>
                    <span className="min-w-0 flex-1 truncate">Clear recent searches</span>
                  </Row>
                </CommandPrimitive.Group>
              ) : null}

              {grouped.map((g) => (
                <CommandPrimitive.Group key={g.type} heading={g.label} className={groupClass}>
                  {g.items.map((r) => {
                    const fresh = freshnessOf(r);
                    return (
                      <Row
                        key={`${r.type}-${r.id}`}
                        value={`${r.type}-${r.id}`}
                        onSelect={() => go(r.url)}
                                                trailing={
                          fresh ? (
                            <Badge size="sm" tone={fresh.tone} dot>
                              {fresh.label}
                            </Badge>
                          ) : null
                        }
                      >
                        <IconTile tone={stateOf(r)}>
                          <ResultIcon type={r.type} />
                        </IconTile>
                        <span className="flex min-w-0 flex-1 flex-col gap-px">
                          <SnippetTitle title={r.title} className="block font-medium text-fg" />
                          {r.snippet ? <Snippet text={excerpt(r.snippet)} className="line-clamp-1 text-caption text-subtle" /> : null}
                        </span>
                      </Row>
                    );
                  })}
                </CommandPrimitive.Group>
              ))}

              {q && aiEnabled ? (
                <CommandPrimitive.Group heading="Assistant" className={groupClass}>
                  <Row value="ask-ai" onSelect={ask} hint="Ask">
                    <Orb size={32} />
                    <span className="min-w-0 flex-1 truncate">
                      Ask AI: <span className="font-medium">{q}</span>
                    </span>
                  </Row>
                </CommandPrimitive.Group>
              ) : null}

              {q && results.length ? (
                <CommandPrimitive.Group className={groupClass}>
                  <Row value="see-all" onSelect={() => go(`/search?q=${encodeURIComponent(q)}`)} hint="Open" trailing={<ArrowRight aria-hidden className="size-4 stroke-[1.5] text-muted" />}>
                    <IconTile>
                      <Search aria-hidden />
                    </IconTile>
                    <span className="min-w-0 flex-1 truncate">See all results for &ldquo;{q}&rdquo;</span>
                  </Row>
                </CommandPrimitive.Group>
              ) : null}

              {actions.length ? (
                <>
                  {q && (grouped.length || aiEnabled) ? <CommandPrimitive.Separator className="my-1.5 h-px bg-border" /> : null}
                  <CommandPrimitive.Group heading="Quick actions" className={groupClass}>
                    {actions.map((a) => (
                      <Row key={a.id} value={`action-${a.id}`} onSelect={() => go(a.href, false)} hint="Go">
                        <IconTile>
                          <a.icon aria-hidden />
                        </IconTile>
                        <span className="min-w-0 flex-1 truncate">{a.label}</span>
                      </Row>
                    ))}
                  </CommandPrimitive.Group>
                </>
              ) : null}
            </CommandPrimitive.List>
            <PreviewPane preview={preview} query={q} aiEnabled={aiEnabled} onTry={setQuery} />
            </div>

            <div className="hidden items-center gap-4 border-t border-border px-4 py-2.5 text-caption text-muted sm:flex sm:px-5">
              <span className="inline-flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                to move
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>
                  <CornerDownLeft className="size-3" aria-hidden />
                </Kbd>
                to open
              </span>
              <span className="ml-auto hidden items-center gap-1.5 sm:inline-flex">
                <Kbd>Esc</Kbd>
                to close
              </span>
            </div>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * The right-hand pane on wider screens: the selected row, bigger. A page shows its freshness in
 * words, any result shows its whole snippet and where it lives. With nothing selected it is the
 * assistant's corner: the orb and an invitation to ask.
 */
const TRY = ["holiday allowance", "VPN", "expenses limits"];

function PreviewPane({ preview, query, aiEnabled, onTry }: { preview: Preview | null; query: string; aiEnabled: boolean; onTry?: (q: string) => void }) {
  const reduced = useMotionReduced();
  return (
    <div className="hidden min-w-0 border-l border-border bg-sunken/40 md:block dark:bg-black/10" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {preview ? (
          <motion.div
            key={preview.url}
            className="flex h-full flex-col gap-4 p-5"
            initial={{ opacity: 0, x: reduced ? 0 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduced ? 0 : -4 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          >
            <IconTile tone={preview.fresh} size="lg">
              <ResultIcon type={preview.type} />
            </IconTile>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-caption font-medium text-subtle">{preview.kind}</p>
              <p className="text-h4 font-medium text-fg text-balance">{splitTitle(preview.title).title}</p>
              {splitTitle(preview.title).section ? <p className="text-small text-muted">Section: {splitTitle(preview.title).section}</p> : null}
            </div>
            {preview.fresh ? (
              <p className={cn("flex items-start gap-2 rounded-cell px-3 py-2 text-small", FRESH[preview.fresh].soft, FRESH[preview.fresh].text)}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", FRESH[preview.fresh].dot)} aria-hidden />
                {preview.fresh === "stale"
                  ? "Stale: past its review date, so some details may be out of date."
                  : preview.fresh === "due-soon"
                    ? "Current, and due for its owner's review soon."
                    : "Verified by its owner and current."}
              </p>
            ) : null}
            {preview.snippet ? <Snippet text={excerpt(preview.snippet)} className="line-clamp-6 text-small leading-[20px] text-muted" /> : null}
            <p className="mt-auto truncate text-caption text-subtle">{preview.url}</p>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <Orb size={56} state={query ? "typing" : "idle"} />
            <div className="flex flex-col gap-1">
              <p className="text-body font-medium text-fg">{query && aiEnabled ? "Or ask the assistant" : "Search everything you can see"}</p>
              <p className="text-small text-muted">
                {aiEnabled ? "It answers from the pages you can read, with sources. Pick Ask AI under the results." : "Pages, people, apps, help topics and your tickets."}
              </p>
            </div>
            {!query && onTry ? (
              <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Try a search">
                {TRY.map((t) => (
                  <li key={t}>
                    <button
                      type="button"
                      onClick={() => onTry(t)}
                      className="focus-ring press cell inline-flex h-8 items-center rounded-full px-3 text-caption font-medium text-fg hover:shadow-cell-hover"
                    >
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
