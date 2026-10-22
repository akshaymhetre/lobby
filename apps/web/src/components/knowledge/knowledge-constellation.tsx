"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CircleCheck, Clock, TriangleAlert, X } from "lucide-react";
import type { FreshnessState } from "@lobby/core/knowledge/freshness";
import { BeamPath, pulseNode } from "@/components/ui/effects/animated-beam";
import { CategoryBlock } from "@/components/ui/category-block";
import { CellList, RowCell } from "@/components/ui/cells";
import { HeroLight, type LightTone } from "@/components/ui/hero-light";
import { CountUp, EASE_OUT_EXPO, useMotionReduced } from "@/components/ui/motion";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { dueWords, isoDaysBetween } from "./freshness-tone";
import { SpaceIcon } from "./space-icon";
import styles from "./knowledge-constellation.module.css";

export interface ConstellationPage {
  id: string;
  title: string;
  href: string;
  freshness: FreshnessState;
  reviewBy: string | null;
}

export interface ConstellationSpace {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  href: string;
  pages: ConstellationPage[];
}

/** Worst first: a space glows in the colour of its least fresh page. */
const RANK: Record<FreshnessState, number> = { stale: 0, "due-soon": 1, unset: 2, verified: 3 };
const VAR: Record<FreshnessState, [string, string]> = {
  verified: ["var(--k-verified)", "var(--k-verified-2)"],
  "due-soon": ["var(--k-due)", "var(--k-due-2)"],
  stale: ["var(--k-stale)", "var(--k-stale-2)"],
  unset: ["var(--k-unset)", "var(--k-unset-2)"],
};
const WORD: Record<FreshnessState, string> = { verified: "verified", "due-soon": "due for review soon", stale: "stale", unset: "has no review date" };

const worst = (pages: ConstellationPage[]): FreshnessState =>
  pages.reduce<FreshnessState>((w, p) => (RANK[p.freshness] < RANK[w] ? p.freshness : w), "verified");

/** The light the hero carries, from the data: red when more than one page in ten is stale, amber when any page is overdue or due, green when all are current. */
export function constellationLight(pages: { freshness: FreshnessState }[]): LightTone {
  const stale = pages.filter((p) => p.freshness === "stale").length;
  if (pages.length && stale / pages.length > 0.1) return "red";
  if (pages.some((p) => p.freshness !== "verified")) return "amber";
  return "green";
}

function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize((s) => (s && s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

interface Placed {
  space: ConstellationSpace;
  x: number;
  y: number;
  r: number;
  /** The label goes above the planet (it sits in the top half) rather than below. */
  above: boolean;
  tone: FreshnessState;
  verified: number;
  stars: { page: ConstellationPage; x: number; y: number; size: number }[];
}

/**
 * The geometry, in stage pixels. The hub sits in the middle; spaces ride an ellipse round it (the
 * first at the top), each sized by how many pages it holds; its pages orbit it, skipping the arc
 * toward the hub (the spoke) and the arc below (its label).
 */
function layout(spaces: ConstellationSpace[], w: number, h: number, phone: boolean) {
  const cx = w / 2;
  const cy = h / 2;
  const hubR = phone ? 46 : 66;
  const rx = Math.max(80, w / 2 - (phone ? 56 : 92));
  const ry = Math.max(80, h / 2 - (phone ? 84 : 104));
  const n = spaces.length;
  const most = Math.max(1, ...spaces.map((sp) => sp.pages.length));
  const placed: Placed[] = spaces.map((space, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
    const x = cx + rx * Math.cos(a);
    const y = cy + ry * Math.sin(a);
    const count = space.pages.length;
    // Area grows with the page count: the biggest space gets the largest planet.
    const [rMin, rMax] = phone ? [12, 30] : [17, 44];
    const r = Math.max(rMin, rMax * Math.sqrt(count / most));
    // Allowed orbit angles, in whole degrees (screen space: 90 is straight down).
    const spoke = (Math.atan2(cy - y, cx - x) * 180) / Math.PI;
    // The label sits on the side away from the hub, so a spoke never runs through it.
    const above = y < cy - 12;
    const labelDeg = above ? 270 : 90;
    const near = (deg: number, target: number, within: number) => Math.abs(((deg - target + 540) % 360) - 180) < within;
    const free: number[] = [];
    for (let d = 0; d < 360; d += 1) if (!near(d, spoke, 42) && !near(d, labelDeg, 52)) free.push(d);
    const pages = [...space.pages].sort((p, q) => RANK[p.freshness] - RANK[q.freshness] || p.title.localeCompare(q.title));
    const orbit = r + (phone ? 15 : 22);
    const stars = pages.map((page, j) => {
      const deg = free[Math.floor(((j + 0.5) / pages.length) * free.length)] ?? 0;
      const rad = (deg * Math.PI) / 180;
      const o = orbit + (pages.length > 6 && j % 2 ? (phone ? 9 : 13) : 0);
      const size = page.freshness === "stale" ? (phone ? 12 : 15) : page.freshness === "due-soon" ? (phone ? 11 : 13) : phone ? 8 : 10;
      return {
        page,
        x: Math.min(w - 8, Math.max(8, x + o * Math.cos(rad))),
        y: Math.min(h - 8, Math.max(8, y + o * Math.sin(rad))),
        size,
      };
    });
    return { space, x, y, r, above, tone: worst(space.pages), verified: space.pages.filter((p) => p.freshness === "verified").length, stars };
  });
  return { cx, cy, hubR, placed };
}

/** A point `dist` px from (x1,y1) toward (x2,y2). */
function toward(x1: number, y1: number, x2: number, y2: number, dist: number) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  return { x: x1 + ((x2 - x1) / len) * dist, y: y1 + ((y2 - y1) / len) * dist };
}
const f = (n: number) => Math.round(n * 10) / 10;

/**
 * The Knowledge home hero (wave 3): the knowledge base as a constellation. The hub is the whole
 * base, ringed by its freshness split around the verified share; every space is a planet sized by
 * its page count and ringed in the colour of its least fresh page; every page is a star whose
 * glow is its freshness (green verified, amber due soon, coral and flaring when stale). A comet
 * runs out along each spoke in turn and the planet pulses as it lands. Picking a planet swings the
 * camera to it, sends comets out to each of its pages, and lists them beside the map.
 */
export function KnowledgeConstellation({
  spaces,
  today,
  total,
  healthHref,
}: {
  spaces: ConstellationSpace[];
  today: string;
  /** Published pages the reader can see (pageCounts().visible), so the hero agrees with the masthead. */
  total: number;
  healthHref?: string;
}) {
  const reduced = useMotionReduced();
  const stageRef = React.useRef<HTMLDivElement>(null);
  const size = useSize(stageRef);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [beat, setBeat] = React.useState(0);
  const planetRefs = React.useRef(new Map<string, HTMLElement>());
  const starRefs = React.useRef(new Map<string, HTMLElement>());

  const pages = spaces.flatMap((s) => s.pages);
  const counts = { verified: 0, "due-soon": 0, stale: 0, unset: 0 } as Record<FreshnessState, number>;
  for (const p of pages) counts[p.freshness] += 1;
  const pct = pages.length ? Math.round((counts.verified / pages.length) * 100) : 0;
  const light = constellationLight(pages);
  // The legend counts what is on screen: the whole base, or the picked space.
  const phone = !!size && size.w < 560;
  const geo = size ? layout(spaces, size.w, size.h, phone) : null;
  const focus = geo?.placed.find((p) => p.space.id === selected) ?? null;
  const shownCounts = { verified: 0, "due-soon": 0, stale: 0, unset: 0 } as Record<FreshnessState, number>;
  for (const p of focus ? focus.space.pages : pages) shownCounts[p.freshness] += 1;

  // Escape lets go of a picked space.
  React.useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);
  React.useEffect(() => setBeat(0), [selected]);

  // The camera: zoom toward the picked space and pull it most of the way to the middle.
  const k = phone ? 1.15 : 1.2;
  // Where the picked planet lands on screen: right of centre on desktop (beside its panel), centred on phones.
  const target = size ? { x: size.w * (phone ? 0.5 : 0.66), y: size.h * 0.52 } : { x: 0, y: 0 };
  const camera =
    geo && focus ? `translate(${f(target.x - k * focus.x)}px, ${f(target.y - k * focus.y)}px) scale(${k})` : "translate(0px, 0px) scale(1)";

  // One comet at a time. With nothing picked it runs hub to each space in turn; with a space
  // picked it runs from the space out to each of its pages.
  const spokes = geo?.placed ?? [];
  const runs = focus ? focus.stars.length : spokes.length;
  const run = runs ? beat % runs : 0;
  const next = React.useCallback(() => window.setTimeout(() => setBeat((b) => b + 1), 420), []);

  const ring = ringStops(counts, pages.length);
  const nextToReview = pages
    .filter((p) => p.freshness !== "verified" && p.reviewBy)
    .sort((a, b) => a.reviewBy!.localeCompare(b.reviewBy!))
    .slice(0, 4);
  const spaceOf = (id: string) => spaces.find((s) => s.pages.some((p) => p.id === id));

  return (
    <section aria-labelledby="constellation-heading" className="panel relative isolate overflow-hidden rounded-panel p-4 sm:p-5 md:p-6" data-freshness-lead data-constellation>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0 max-w-[620px]">
          <h2 id="constellation-heading" className="text-h2 font-medium text-fg md:text-hero">
            Knowledge map
          </h2>
          <p className="mt-1.5 text-body text-muted">
            {total === 1 ? "1 page" : `${total} pages`} in {spaces.length === 1 ? "1 space" : `${spaces.length} spaces`}. Bigger planets hold more pages; each star glows with how recently its owner checked it.
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label={focus ? `Freshness in ${focus.space.name}` : "Freshness"}>
          {focus ? <li className="text-small font-medium text-fg">{focus.space.name}</li> : null}
          {(["verified", "due-soon", "stale", "unset"] as FreshnessState[])
            .filter((s) => shownCounts[s] > 0)
            .map((s) => (
              <li key={s} className="inline-flex items-center gap-2 text-small text-muted">
                <span className={cn("size-3 rounded-full", s === "verified" ? "cat-green" : s === "due-soon" ? "cat-amber" : s === "stale" ? "cat-coral" : "hatch")} aria-hidden />
                <span className={cn("tabular text-row font-medium", s === "stale" ? "text-cat-coral-text" : "text-fg")}>{shownCounts[s]}</span>
                {s === "verified" ? "verified" : s === "due-soon" ? "due soon" : s === "stale" ? "stale" : "no date"}
              </li>
            ))}
        </ul>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
        <div
          ref={stageRef}
          className={cn(styles.stage, "h-[440px] rounded-card sm:h-[480px] lg:h-[520px]")}
          onClick={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.backdrop) setSelected(null);
          }}
        >
          {geo ? (
            <div className={styles.camera} style={{ transform: camera, width: size!.w, height: size!.h }} data-backdrop="1">
              <svg className="absolute inset-0 overflow-visible" width={size!.w} height={size!.h} viewBox={`0 0 ${size!.w} ${size!.h}`} aria-hidden data-backdrop="1">
                {geo.placed.map((p, i) => {
                  const a = toward(geo.cx, geo.cy, p.x, p.y, geo.hubR + 4);
                  const b = toward(p.x, p.y, geo.cx, geo.cy, p.r + 5);
                  const d = `M${f(a.x)},${f(a.y)} L${f(b.x)},${f(b.y)}`;
                  const dim = !!focus && focus.space.id !== p.space.id;
                  return (
                    <g key={p.space.id}>
                      <path d={d} pathLength={1} className={cn(styles.edge, styles.spoke, dim && styles.dim)} style={{ "--c": VAR[p.tone][0], "--d": `${120 + i * 90}ms` } as React.CSSProperties} />
                      {p.stars.map((s, j) => {
                        const from = toward(p.x, p.y, s.x, s.y, p.r + 4);
                        const to = toward(s.x, s.y, p.x, p.y, s.size / 2 + 3);
                        return (
                          <path
                            key={s.page.id}
                            d={`M${f(from.x)},${f(from.y)} L${f(to.x)},${f(to.y)}`}
                            pathLength={1}
                            className={cn(styles.edge, styles.twig, dim && styles.dim)}
                            style={{ "--c": VAR[s.page.freshness][0], "--d": `${700 + i * 90 + j * 40}ms` } as React.CSSProperties}
                          />
                        );
                      })}
                    </g>
                  );
                })}
                {/* The comet: one at a time, out along a spoke, or out to each page of the picked space. */}
                {!reduced && runs ? (
                  focus ? (
                    (() => {
                      const s = focus.stars[run]!;
                      const from = toward(focus.x, focus.y, s.x, s.y, focus.r + 4);
                      const to = toward(s.x, s.y, focus.x, focus.y, s.size / 2 + 3);
                      return (
                        <BeamPath
                          key={`f${selected}-${beat}`}
                          d={`M${f(from.x)},${f(from.y)} L${f(to.x)},${f(to.y)}`}
                          quiet={false}
                          draw={false}
                          repeat={1}
                          duration={0.55}
                          width={1.6}
                          tone={VAR[s.page.freshness][0]}
                          onArrive={() => pulseNode(starRefs.current.get(s.page.id), VAR[s.page.freshness][0])}
                          onSparkEnd={next}
                        />
                      );
                    })()
                  ) : (
                    (() => {
                      const p = spokes[run]!;
                      const a = toward(geo.cx, geo.cy, p.x, p.y, geo.hubR + 4);
                      const b = toward(p.x, p.y, geo.cx, geo.cy, p.r + 5);
                      return (
                        <BeamPath
                          key={`s${beat}`}
                          d={`M${f(a.x)},${f(a.y)} L${f(b.x)},${f(b.y)}`}
                          quiet={false}
                          draw={false}
                          repeat={1}
                          delay={beat === 0 ? 1.6 : 0}
                          duration={0.8}
                          width={2}
                          tone={VAR[p.tone][0]}
                          onArrive={() => pulseNode(planetRefs.current.get(p.space.id), VAR[p.tone][0])}
                          onSparkEnd={next}
                        />
                      );
                    })()
                  )
                ) : null}
              </svg>

              {/* The hub: the whole base, its ring split by freshness. Pressing it lets go of a picked space. */}
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={`All spaces: ${pct}% of ${pages.length} pages verified`}
                aria-pressed={!selected}
                className={cn(styles.hub, styles.pop, "focus-ring")}
                style={{ left: geo.cx, top: geo.cy, width: geo.hubR * 2, height: geo.hubR * 2, "--ring": ring, "--d": "0ms" } as React.CSSProperties}
              >
                <span className={styles.hubInner}>
                  <CountUp value={pct} suffix="%" duration={1.1} delay={0.3} className={cn("font-medium leading-none tracking-[-0.03em] text-fg", phone ? "text-[26px]" : "text-[36px]")} />
                  <span className="mt-1 text-caption text-muted">verified</span>
                </span>
              </button>

              {geo.placed.map((p, i) => {
                const dim = !!focus && focus.space.id !== p.space.id;
                const picked = focus?.space.id === p.space.id;
                return (
                  <React.Fragment key={p.space.id}>
                    {p.stars.map((s, j) => (
                      <Tooltip
                        key={s.page.id}
                        delayDuration={60}
                        label={
                          <span className="flex flex-col">
                            <span>{s.page.title}</span>
                            <span className="font-normal opacity-75">
                              {s.page.freshness === "verified" || !s.page.reviewBy ? WORD[s.page.freshness] : dueWords(isoDaysBetween(today, s.page.reviewBy))}
                            </span>
                          </span>
                        }
                      >
                        <Link
                          href={s.page.href}
                          tabIndex={-1}
                          aria-hidden
                          ref={(el) => {
                            if (el) starRefs.current.set(s.page.id, el);
                            else starRefs.current.delete(s.page.id);
                          }}
                          className={cn(styles.star, styles.pop, s.page.freshness === "stale" && styles.flare)}
                          style={
                            {
                              left: s.x,
                              top: s.y,
                              width: s.size,
                              height: s.size,
                              opacity: dim ? 0.12 : 1,
                              "--c": VAR[s.page.freshness][0],
                              "--c2": VAR[s.page.freshness][1],
                              "--d": `${900 + i * 90 + j * 40}ms`,
                            } as React.CSSProperties
                          }
                        />
                      </Tooltip>
                    ))}
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) planetRefs.current.set(p.space.id, el);
                        else planetRefs.current.delete(p.space.id);
                      }}
                      data-space-node={p.space.slug}
                      aria-pressed={picked}
                      aria-label={`${p.space.name}: ${p.verified} of ${p.space.pages.length} pages verified${p.tone === "stale" ? ", has stale pages" : p.tone === "due-soon" ? ", pages due for review" : ""}`}
                      onClick={() => setSelected(picked ? null : p.space.id)}
                      className={cn(styles.planet, styles.pop, "focus-ring flex items-center justify-center")}
                      style={{ left: p.x, top: p.y, width: p.r * 2, height: p.r * 2, opacity: dim ? 0.18 : 1, "--c": VAR[p.tone][0], "--d": `${380 + i * 90}ms` } as React.CSSProperties}
                    >
                      <SpaceIcon name={p.space.icon} size={phone ? "md" : "lg"} className="text-fg" />
                    </button>
                    <span
                      className={cn(styles.label, "rounded-[8px] px-1.5 py-0.5")}
                      style={
                        p.above
                          ? { left: p.x, bottom: size!.h - (p.y - p.r - (phone ? 6 : 9)), opacity: dim ? 0 : 1 }
                          : { left: p.x, top: p.y + p.r + (phone ? 6 : 9), opacity: dim ? 0 : 1 }
                      }
                      aria-hidden
                    >
                      <span className={cn("block font-medium text-fg", phone ? "text-small" : "text-row")}>{p.space.name}</span>
                      <span className="tabular block text-caption text-muted">
                        {p.verified} of {p.space.pages.length}
                        {phone ? "" : " verified"}
                      </span>
                    </span>
                  </React.Fragment>
                );
              })}

              {/* The picked space's overdue pages are named on the map, beside their star. */}
              {focus && !phone
                ? focus.stars
                    .filter((s) => s.page.freshness === "stale" || s.page.freshness === "due-soon")
                    .slice(0, 3)
                    .map((s) => {
                      // Outward from the planet, so the name never covers it; below the star when that side has no room on screen.
                      const screenX = target.x + k * (s.x - focus.x);
                      const est = Math.min(200, s.page.title.length * 7 + 18);
                      const gap = (k * s.size) / 2 + 6;
                      const out = s.x >= focus.x ? "right" : "left";
                      const side = out === "right" ? (screenX + gap + est < size!.w - 8 ? "right" : "below") : screenX - gap - est > 8 ? "left" : "below";
                      const style: React.CSSProperties =
                        side === "right"
                          ? { left: s.x + s.size / 2 + 6, top: s.y, scale: 1 / k, transformOrigin: "left center", translate: "0 -50%" }
                          : side === "left"
                            ? { right: size!.w - (s.x - s.size / 2 - 6), top: s.y, scale: 1 / k, transformOrigin: "right center", translate: "0 -50%" }
                            : { left: s.x, top: s.y + s.size / 2 + 5, scale: 1 / k, transformOrigin: "top center", translate: "-50% 0" };
                      return (
                        <span
                          key={`l${s.page.id}`}
                          aria-hidden
                          className={cn(
                            "pointer-events-none absolute max-w-[200px] truncate whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-medium shadow-cell",
                            s.page.freshness === "stale" ? "cat-coral" : "cat-amber",
                          )}
                          style={style}
                        >
                          {s.page.title}
                        </span>
                      );
                    })
                : null}
            </div>
          ) : null}
          {/* The one light source, behind the hub, in the colour the data calls for (constellationLight). The stage mask softens its edge. */}
          <HeroLight tone={light} position="center" />
        </div>

        {/* Beside the map: what to read next, or the picked space's pages. */}
        <div className="min-w-0 lg:max-h-[520px] lg:overflow-y-auto lg:pr-1" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {focus ? (
              <motion.div
                key={focus.space.id}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: 18, rotateY: -8 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: -10 }}
                transition={{ duration: reduced ? 0.15 : 0.45, ease: EASE_OUT_EXPO }}
                className="flex flex-col gap-3"
                style={{ transformPerspective: 900 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-h3 font-medium text-fg">{focus.space.name}</h3>
                    <p className="tabular text-small text-muted">
                      {focus.verified} of {focus.space.pages.length} pages verified
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="focus-ring press flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg"
                    aria-label="Back to all spaces"
                  >
                    <X className="size-4 stroke-[1.75]" aria-hidden />
                  </button>
                </div>
                <CellList density="compact" aria-label={`${focus.space.name} pages`}>
                  {[...focus.space.pages]
                    .sort((a, b) => RANK[a.freshness] - RANK[b.freshness] || a.title.localeCompare(b.title))
                    .map((p) =>
                      p.freshness === "stale" || p.freshness === "due-soon" ? (
                        <li key={p.id} className="list-none">
                          <CategoryBlock
                            size="md"
                            tone={p.freshness === "stale" ? "coral" : "amber"}
                            href={p.href}
                            icon={p.freshness === "stale" ? <TriangleAlert /> : <Clock />}
                            title={p.title}
                            status={p.reviewBy ? dueWords(isoDaysBetween(today, p.reviewBy)) : undefined}
                          />
                        </li>
                      ) : (
                        <RowCell
                          key={p.id}
                          href={p.href}
                          title={p.title}
                          leading={
                            <span className="flex size-8 items-center justify-center rounded-full bg-cat-green-soft text-cat-green-text">
                              <CircleCheck className="size-4 stroke-[1.75]" aria-hidden />
                            </span>
                          }
                          aria-label={`${p.title}, ${WORD[p.freshness]}`}
                        />
                      ),
                    )}
                </CellList>
                <Link
                  href={focus.space.href}
                  className="focus-ring inline-flex min-h-11 items-center gap-1.5 self-start rounded-[6px] text-small font-medium text-accent-text hover:text-accent-hover"
                >
                  Open {focus.space.name}
                  <ArrowUpRight className="size-4 stroke-[1.75]" aria-hidden />
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key="next"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-3"
              >
                <div>
                  <h3 className="text-h3 font-medium text-fg">{nextToReview.length ? "Next to review" : "All current"}</h3>
                  <p className="text-small text-muted">
                    {nextToReview.length ? "The pages whose review date comes first. Overdue ones may be out of date." : "Every page you can read has been checked by its owner."}
                  </p>
                </div>
                {nextToReview.length ? (
                  <ul className="flex flex-col gap-2.5">
                    {nextToReview.map((p) => (
                      <li key={p.id}>
                        <CategoryBlock
                          tone={p.freshness === "stale" ? "coral" : "amber"}
                          href={p.href}
                          icon={p.freshness === "stale" ? <TriangleAlert /> : <Clock />}
                          title={p.title}
                          subtitle={spaceOf(p.id)?.name}
                          status={p.reviewBy ? dueWords(isoDaysBetween(today, p.reviewBy)) : undefined}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-small text-muted">Pick a planet to see its pages. Press Escape to come back.</p>
                {healthHref ? (
                  <Link
                    href={healthHref}
                    className="focus-ring inline-flex min-h-11 items-center gap-1.5 self-start rounded-[6px] text-small font-medium text-accent-text hover:text-accent-hover"
                  >
                    Content health
                    <ArrowUpRight className="size-4 stroke-[1.75]" aria-hidden />
                  </Link>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* For assistive tech: the map as a list (the planets above are the same buttons). */}
      <p className="sr-only">
        {counts.verified} verified, {counts["due-soon"]} due for review soon, {counts.stale} stale.
      </p>
    </section>
  );
}

/** The hub ring: verified, due soon, stale and undated as arcs, with a hairline gap between them. */
function ringStops(c: Record<FreshnessState, number>, total: number): string {
  if (!total) return "var(--lb-border-strong) 0 360deg";
  const parts: [FreshnessState, string][] = [
    ["verified", "var(--k-verified)"],
    ["due-soon", "var(--k-due)"],
    ["stale", "var(--k-stale)"],
    ["unset", "var(--k-unset)"],
  ];
  let at = 0;
  const out: string[] = [];
  for (const [k, col] of parts) {
    if (!c[k]) continue;
    const span = (c[k] / total) * 360;
    out.push(`${col} ${f(at)}deg ${f(at + span - 1.5)}deg`, `transparent ${f(at + span - 1.5)}deg ${f(at + span)}deg`);
    at += span;
  }
  return out.join(", ");
}
