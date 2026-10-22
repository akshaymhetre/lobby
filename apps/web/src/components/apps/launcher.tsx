"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppWindow, CircleAlert, Pin, Search, SearchX, X } from "lucide-react";
import { groupByCategory, matchesQuery, moveInOrder } from "@lobby/core/apps/logic";
import { pinAppAction, reorderPinsAction, unpinAppAction } from "@/app/(app)/apps/_actions";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { AnimatedBeam } from "@/components/ui/effects/animated-beam";
import { Reveal, RevealItem, useMotionReduced } from "@/components/ui/motion";
import { BrandMark } from "@/components/brand-mark";
import { Section } from "@/components/ui/section";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { AppTile, PinnedTile, RecentPill, type TileActions } from "./app-tile";
import { announceLaunch, launchHref } from "./launch";
import type { LauncherApp, RequestableApp } from "./load";
import { RequestAccessList } from "./request-access";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const CATEGORY_ORDER = [
  "Communication",
  "Work management",
  "Engineering",
  "Design",
  "Finance",
  "People",
  "Sales",
  "Security",
];

/**
 * Moves focus between tiles with the arrow keys. Tiles are any [data-tile] inside `root`; up and
 * down pick the tile in the next row whose centre is closest horizontally.
 */
function moveTileFocus(root: HTMLElement, e: React.KeyboardEvent) {
  if (e.altKey || e.metaKey || e.ctrlKey) return;
  const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const current = e.target as HTMLElement;
  if (!current.matches("[data-tile]")) return;
  const tiles = [...root.querySelectorAll<HTMLElement>("[data-tile]")].filter(
    (t) => t.offsetParent !== null,
  );
  const i = tiles.indexOf(current);
  if (i === -1) return;
  let next: HTMLElement | undefined;
  if (e.key === "ArrowRight") next = tiles[i + 1];
  else if (e.key === "ArrowLeft") next = tiles[i - 1];
  else if (e.key === "Home") next = tiles[0];
  else if (e.key === "End") next = tiles[tiles.length - 1];
  else {
    const r = current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const down = e.key === "ArrowDown";
    const candidates = tiles
      .map((t) => ({ t, r: t.getBoundingClientRect() }))
      .filter(({ r: o }) => (down ? o.top >= r.bottom - 4 : o.bottom <= r.top + 4));
    if (candidates.length) {
      const rowTop = down
        ? Math.min(...candidates.map((c) => c.r.top))
        : Math.max(...candidates.map((c) => c.r.top));
      const row = candidates.filter((c) => Math.abs(c.r.top - rowTop) < 8);
      row.sort(
        (a, b) => Math.abs(a.r.left + a.r.width / 2 - cx) - Math.abs(b.r.left + b.r.width / 2 - cx),
      );
      next = row[0]?.t;
    }
  }
  if (next) {
    e.preventDefault();
    next.focus();
    next.scrollIntoView({ block: "nearest" });
  }
}

export function AppLauncher({
  apps,
  pinnedIds: initialPinned,
  recentIds: initialRecent,
  requestable,
  focusSlug,
  unavailable,
  org,
}: {
  /** The company, for the sign-on hub in "Your apps". */
  org: { name: string; logoUrl: string | null };
  apps: LauncherApp[];
  pinnedIds: string[];
  recentIds: string[];
  requestable: RequestableApp[];
  focusSlug?: string | null;
  unavailable?: { slug: string; reason: string } | null;
}) {
  const router = useRouter();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string | null>(null);
  const [pinned, setPinned] = React.useState(initialPinned);
  const [recent, setRecent] = React.useState(initialRecent);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState(unavailable ?? null);
  const reduced = useMotionReduced();
  // The sign-on hub and the discs its beams land on.
  const heroRef = React.useRef<HTMLDivElement>(null);
  const hubRef = React.useRef<HTMLSpanElement>(null);
  const discRefs = React.useRef(new Map<string, React.RefObject<HTMLSpanElement | null>>());
  const discRef = (id: string) => {
    let r = discRefs.current.get(id);
    if (!r) {
      r = React.createRef<HTMLSpanElement>();
      discRefs.current.set(id, r);
    }
    return r;
  };

  React.useEffect(() => setPinned(initialPinned), [initialPinned]);
  React.useEffect(() => setRecent(initialRecent), [initialRecent]);

  // "/" jumps to search from anywhere on the page.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ?focus=<slug> (from search results) scrolls to and focuses that tile.
  React.useEffect(() => {
    if (!focusSlug) return;
    const el = rootRef.current?.querySelector<HTMLElement>(
      `[data-app-section="grid"] [href="${launchHref(focusSlug)}"]`,
    );
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
    }
  }, [focusSlug]);

  const byId = React.useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);
  const pinnedSet = React.useMemo(() => new Set(pinned), [pinned]);
  const pinnedApps = pinned.map((id) => byId.get(id)).filter((a): a is LauncherApp => !!a);
  const recentApps = recent.map((id) => byId.get(id)).filter((a): a is LauncherApp => !!a);

  const categories = React.useMemo(
    () => groupByCategory(apps, CATEGORY_ORDER).map((g) => g.category),
    [apps],
  );
  const filtered = apps.filter(
    (a) => matchesQuery(a, query) && (!category || a.category === category),
  );
  const groups = groupByCategory(filtered, CATEGORY_ORDER);
  const searching = query.trim().length > 0 || category !== null;

  const onLaunched = React.useCallback(
    (app: LauncherApp) => {
      setRecent((r) => [app.id, ...r.filter((id) => id !== app.id)].slice(0, 6));
      window.setTimeout(() => router.refresh(), 1200);
    },
    [router],
  );

  const togglePin = async (app: LauncherApp) => {
    const was = pinnedSet.has(app.id);
    setPinned((p) => (was ? p.filter((id) => id !== app.id) : [...p, app.id]));
    const res = was ? await unpinAppAction(app.id) : await pinAppAction(app.id);
    if (!res.ok) {
      setPinned((p) => (was ? [...p, app.id] : p.filter((id) => id !== app.id)));
      toast.error(res.error);
      return;
    }
    toast(was ? `Removed ${app.name} from your apps` : `Added ${app.name} to your apps`);
  };

  const saveOrder = async (order: string[], previous: string[]) => {
    setPinned(order);
    const res = await reorderPinsAction(order);
    if (!res.ok) {
      setPinned(previous);
      toast.error(res.error);
    }
  };

  const move = (app: LauncherApp, delta: -1 | 1) => {
    const prev = pinned;
    void saveOrder(moveInOrder(prev, app.id, delta), prev);
    // Keep focus on the moved tile after React re-renders it in its new place.
    window.requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector<HTMLElement>(`[data-app-section="pinned"] [href="${launchHref(app.slug)}"]`)
        ?.focus();
    });
  };

  const actionsFor = (app: LauncherApp, extra?: Partial<TileActions>): TileActions => ({
    pinned: pinnedSet.has(app.id),
    onTogglePin: togglePin,
    onLaunched,
    ...extra,
  });

  const unavailableApp = notice ? requestable.find((a) => a.slug === notice.slug) : undefined;

  return (
    <div
      ref={rootRef}
      className="section-stack"
      onKeyDown={(e) => rootRef.current && moveTileFocus(rootRef.current, e)}
    >
      {notice ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-card bg-warning-soft px-4 py-3 text-warning-text"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 stroke-[1.5]" aria-hidden />
          <p className="flex-1 text-body">
            {notice.reason === "no_access"
              ? unavailableApp
                ? `You do not have access to ${unavailableApp.name} yet. You can ask for it below.`
                : "You do not have access to that app."
              : notice.reason === "bad_url"
                ? "That app's link is not set up correctly yet. Your IT team has been told how to fix it in Admin."
                : "That app no longer exists. It may have been removed."}
          </p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="focus-ring touch-target -m-1 inline-flex size-7 items-center justify-center rounded-control hover:bg-hover"
            aria-label="Dismiss"
          >
            <X className="size-4 stroke-[1.5]" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <Input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.preventDefault();
              setQuery("");
            } else if (e.key === "Enter" && filtered[0]) {
              e.preventDefault();
              announceLaunch(filtered[0]);
              onLaunched(filtered[0]);
              window.open(launchHref(filtered[0].slug), "_blank", "noopener,noreferrer");
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              rootRef.current
                ?.querySelector<HTMLElement>('[data-app-section="grid"] [data-tile]')
                ?.focus();
            }
          }}
          placeholder="Search apps"
          aria-label="Search apps"
          aria-describedby="app-search-hint"
          leading={<Search />}
          trailing={<Kbd className="hidden md:inline-flex">/</Kbd>}
          className="md:max-w-[420px]"
        />
        <p id="app-search-hint" className="sr-only">
          Press Enter to open the first match. Use the arrow keys to move between apps.
        </p>
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
          role="group"
          aria-label="Filter by category"
        >
          <Chip
            className="shrink-0 whitespace-nowrap"
            selected={category === null}
            onClick={() => setCategory(null)}
          >
            All apps
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c}
              className="shrink-0 whitespace-nowrap"
              selected={category === c}
              onClick={() => setCategory(category === c ? null : c)}
            >
              {c}
            </Chip>
          ))}
        </div>
      </div>

      {!searching ? (
        <section
          id="your-apps"
          aria-labelledby="your-apps-heading"
          className="scroll-mt-20"
          data-app-section="pinned"
        >
          {pinnedApps.length ? (
            // The hero: one sign-in on the left, your apps on the right, and light travelling from
            // the sign-in to every app it opens without a password (bookmarks get no beam: they
            // have their own sign-in). The page's one authored moment: the tiles build in, then the
            // beams draw and carry one spark each.
            <div ref={heroRef} className="relative isolate rounded-panel panel p-4 md:p-6 md:pt-12">
              {pinnedApps.map((app, i) =>
                app.launchType === "bookmark" ? null : (
                  <AnimatedBeam
                    key={`${app.id}-${pinned.join(",")}`}
                    className="max-md:hidden"
                    containerRef={heroRef}
                    fromRef={hubRef}
                    toRef={discRef(app.id)}
                    fromAnchor="right"
                    toAnchor="top"
                    startXOffset={4}
                    startYOffset={-14 + i * 7}
                    endYOffset={8}
                    curvature={22 + i * 8}
                    tone={i % 3 === 0 ? "accent" : i % 3 === 1 ? "cyan" : "violet"}
                    draw="before"
                    drawDuration={0.6}
                    delay={0.55 + i * 0.12}
                    repeat={reduced ? 0 : 1}
                    duration={1.1}
                    width={1.25}
                    measureKey={pinned.join(",")}
                  />
                ),
              )}
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
                <div className="flex items-center gap-4 md:w-[220px] md:shrink-0 md:flex-col md:items-start md:gap-3 md:self-stretch md:pb-2">
                  <span ref={hubRef} className="relative z-10 inline-flex shrink-0 rounded-[16px] shadow-glow-cyan md:mt-auto">
                    <BrandMark
                      name={org.name}
                      logoUrl={org.logoUrl}
                      size={52}
                      className="rounded-[16px] [box-shadow:0_14px_30px_-10px_color-mix(in_srgb,var(--lb-accent)_60%,transparent),inset_0_1px_0_rgb(255_255_255/0.35)]"
                    />
                  </span>
                  <div className="min-w-0 md:mb-auto">
                    <h2 id="your-apps-heading" className="flex items-baseline gap-2 text-h3 font-medium text-fg">
                      Your apps
                      <span className="text-body tabular text-subtle">{pinnedApps.length}</span>
                    </h2>
                    <p className="mt-1 text-small text-muted text-pretty">
                      {(() => {
                        const sso = pinnedApps.filter((a) => a.launchType !== "bookmark").length;
                        const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
                        const n = words[sso] ?? String(sso);
                        return sso === pinnedApps.length
                          ? `Your ${org.name} sign-in opens ${pinnedApps.length === 1 ? "it" : pinnedApps.length === 2 ? "both" : `all ${n}`}.`
                          : `Your ${org.name} sign-in opens ${n} of them.`;
                      })()}
                      {pinnedApps.length > 1 ? (
                        <span className="hidden md:inline"> Drag to reorder, or use Alt and the arrow keys.</span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <Reveal stagger={0.06} delay={0.1} className="min-w-0 flex-1">
                  <ul className="grid grid-cols-2 gap-3 max-sm:[&>li:last-child:nth-child(odd)]:col-span-2 sm:grid-cols-3 md:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
                    {pinnedApps.map((app, i) => (
                      <li
                        key={app.id}
                        onDragOver={(e) => {
                          if (!dragId || dragId === app.id) return;
                          e.preventDefault();
                          const from = pinned.indexOf(dragId);
                          const to = pinned.indexOf(app.id);
                          if (from === -1 || to === -1) return;
                          const next = [...pinned];
                          next.splice(from, 1);
                          next.splice(to, 0, dragId);
                          setPinned(next);
                        }}
                      >
                        <RevealItem from="scale">
                          <PinnedTile
                            app={app}
                            targetRef={discRef(app.id)}
                            dragging={dragId === app.id}
                            dragProps={{
                              draggable: true,
                              onDragStart: (e) => {
                                setDragId(app.id);
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", app.name);
                              },
                              onDragEnd: () => {
                                setDragId(null);
                                void saveOrder(pinned, initialPinned);
                              },
                            }}
                            actions={actionsFor(app, {
                              onMove: move,
                              canMoveEarlier: i > 0,
                              canMoveLater: i < pinnedApps.length - 1,
                            })}
                          />
                        </RevealItem>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </div>
            </div>
          ) : (
            <div className="section-group">
              <h2 id="your-apps-heading" className="text-h4 font-medium text-fg">
                Your apps
              </h2>
              <p className="flex items-start gap-3 rounded-card bg-raised/60 px-4 py-4 text-body text-muted">
                <Pin className="mt-0.5 size-4 shrink-0 stroke-[1.75]" aria-hidden />
                <span>
                  Pin the apps you open most and they will sit here and on your home page. Use the{" "}
                  <span className="font-medium text-fg">More</span> menu on any app below.
                </span>
              </p>
            </div>
          )}
        </section>
      ) : null}

      {!searching && recentApps.length ? (
        <Section title="Recently used" data-app-section="recent">
          <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] md:flex-wrap">
            {recentApps.map((app) => (
              <li key={app.id}>
                <RecentPill app={app} onLaunched={onLaunched} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div data-app-section="grid">
        {groups.length ? (
          // The wall: ONE grid of equal tiles. Each category is a labelled run: a quiet label tile with
          // the category's name and count, then its apps, flowing on like words in a line. No boxes
          // inside boxes, no stretched tiles, no holes in the middle of the wall.
          <ul aria-label="All apps" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3 lg:grid-cols-4 xl:grid-cols-6 [&>li]:min-w-0">
            {groups.flatMap((g) => [
              // On phones the label is a full-width header row, so a category never pairs with another's app.
              <li key={`label-${g.category}`} className="list-none max-sm:col-span-full">
                <div className="flex h-full flex-col justify-between rounded-panel bg-sunken/80 p-4 shadow-inset max-sm:min-h-0 max-sm:flex-row max-sm:items-center max-sm:py-3 sm:min-h-[132px] md:min-h-[172px] md:p-5">
                  <h2 id={`cat-${slugify(g.category)}`} className="text-h4 font-medium text-fg text-balance md:text-h3">
                    {g.category}
                  </h2>
                  <p className="flex items-center gap-2 text-small text-muted">
                    <span className="tabular inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-raised px-2 text-small font-medium text-fg shadow-cell">{g.items.length}</span>
                    {g.items.length === 1 ? "app" : "apps"}
                  </p>
                </div>
              </li>,
              ...g.items.map((app) => <AppTile key={app.id} app={app} actions={actionsFor(app)} highlighted={focusSlug === app.slug} />),
            ])}
          </ul>
        ) : apps.length ? (
          <EmptyState
            variant="filtered"
            icon={<SearchX />}
            title={query ? `No apps match "${query.trim()}"` : "No apps in this category"}
            description={
              requestable.some((a) => matchesQuery(a, query))
                ? "It might be one you need to ask for. Check the list below."
                : "Try a different word, or ask IT to add the app you are looking for."
            }
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setCategory(null);
                  }}
                >
                  Clear search
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/help/new">Ask IT for an app</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <EmptyState
            icon={<AppWindow />}
            title="No apps yet"
            description="When IT adds the tools your company uses, they show up here with one-click sign-in."
          />
        )}
      </div>

      <div
        id="request-access"
        className={cn(
          "scroll-mt-20",
          searching && !requestable.some((a) => matchesQuery(a, query)) && "hidden",
        )}
      >
        <RequestAccessList
          apps={searching ? requestable.filter((a) => matchesQuery(a, query)) : requestable}
        />
      </div>
    </div>
  );
}
