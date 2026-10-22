"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarOff, CircleCheck, Clock, TriangleAlert } from "lucide-react";
import type { FreshnessState } from "@lobby/core/knowledge/freshness";
import { Avatar } from "@/components/ui/avatar";
import { BeamPath, pulseNode } from "@/components/ui/effects/animated-beam";
import { HeroLight } from "@/components/ui/hero-light";
import { CountUp, useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { constellationLight } from "./knowledge-constellation";
import { dueWords, isoDaysBetween } from "./freshness-tone";
import { SpaceIcon } from "./space-icon";
import styles from "./knowledge-constellation.module.css";

export interface OrbitPage {
  id: string;
  title: string;
  href: string;
  state: FreshnessState;
  reviewBy: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
}

const RANK: Record<FreshnessState, number> = { stale: 0, "due-soon": 1, unset: 2, verified: 3 };
const HUE: Record<FreshnessState, string> = {
  verified: "var(--k-verified)",
  "due-soon": "var(--k-due)",
  stale: "var(--k-stale)",
  unset: "var(--k-unset)",
};
const CELL_W = 256;
const CELL_H = 60;

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = React.useState<number | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** The plate that says how far to trust a page: filled coral when stale, filled amber when due, a quiet check when verified. */
function Plate({ state }: { state: FreshnessState }) {
  if (state === "stale")
    return (
      <span className="cat-coral flex size-10 shrink-0 items-center justify-center rounded-[13px] shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]">
        <TriangleAlert className="size-[18px] stroke-[1.75]" aria-hidden />
      </span>
    );
  if (state === "due-soon")
    return (
      <span className="cat-amber flex size-10 shrink-0 items-center justify-center rounded-[13px] shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]">
        <Clock className="size-[18px] stroke-[1.75]" aria-hidden />
      </span>
    );
  if (state === "unset")
    return (
      <span className="hatch flex size-10 shrink-0 items-center justify-center rounded-[13px] text-muted">
        <CalendarOff className="size-[18px] stroke-[1.5]" aria-hidden />
      </span>
    );
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-cat-green-soft text-cat-green-text dark:bg-cat-green-text/15">
      <CircleCheck className="size-[18px] stroke-[1.75]" aria-hidden />
    </span>
  );
}

const whenOf = (p: OrbitPage, today: string) =>
  !p.reviewBy ? "No review date" : p.state === "stale" ? dueWords(isoDaysBetween(today, p.reviewBy)) : `Next check ${dueWords(isoDaysBetween(today, p.reviewBy))}`;

/**
 * A space's hero (wave 3): the planet from the Knowledge map, opened up. The space sits in the
 * middle, ringed by its freshness split around how many of its pages are verified; its pages orbit
 * it as raised cells, each with a plate that says how far to trust it. A comet runs out to each
 * page in turn and the cell pulses as it lands. On phones the planet heads a list of the same cells.
 */
export function SpaceOrbit({ name, icon, pages, today }: { name: string; icon: string | null; pages: OrbitPage[]; today: string }) {
  const reduced = useMotionReduced();
  const ref = React.useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  const cellRefs = React.useRef(new Map<string, HTMLElement>());
  const [beat, setBeat] = React.useState(0);
  const ordered = [...pages].sort((a, b) => RANK[a.state] - RANK[b.state] || a.title.localeCompare(b.title));
  const verified = pages.filter((p) => p.state === "verified").length;
  const counts = { verified: 0, "due-soon": 0, stale: 0, unset: 0 } as Record<FreshnessState, number>;
  for (const p of pages) counts[p.state] += 1;
  const light = constellationLight(pages.map((p) => ({ freshness: p.state })));
  const wide = !!w && w >= 760;
  const h = Math.max(380, Math.min(580, 200 + ordered.length * 46));
  const cx = (w ?? 0) / 2;
  const cy = h / 2;
  const hubR = 70;
  const rx = Math.max(160, (w ?? 0) / 2 - CELL_W / 2 - 12);
  const ry = h / 2 - CELL_H / 2 - 12;
  const n = ordered.length;
  // Start a little off the top so no cell sits straight above or below the hub.
  const placed = ordered.map((page, i) => {
    const a = -Math.PI / 2 + Math.PI / Math.max(2, n) + (i / Math.max(1, n)) * Math.PI * 2;
    return { page, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
  const run = n ? beat % n : 0;
  const next = React.useCallback(() => window.setTimeout(() => setBeat((b) => b + 1), 380), []);
  const ring = ringStops(counts, pages.length);

  // Where a spoke meets a cell: the cell's edge along the line from the hub.
  const edge = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    const t = Math.min(CELL_W / 2 / Math.abs(dx || 1e-6), CELL_H / 2 / Math.abs(dy || 1e-6));
    return { x: x - dx * Math.min(1, t) - Math.sign(dx) * 2, y: y - dy * Math.min(1, t) - Math.sign(dy) * 2 };
  };
  const from = (x: number, y: number) => {
    const len = Math.hypot(x - cx, y - cy) || 1;
    return { x: cx + ((x - cx) / len) * (hubR + 4), y: cy + ((y - cy) / len) * (hubR + 4) };
  };
  const f = (v: number) => Math.round(v * 10) / 10;

  const hub = (size: number) => (
    <div
      className={cn(styles.hub, styles.hubStatic)}
      style={{ width: size, height: size, "--ring": ring } as React.CSSProperties}
      aria-label={`${name}: ${verified} of ${pages.length} pages verified`}
      role="img"
    >
      <span className={styles.hubInner}>
        <SpaceIcon name={icon} size="md" className="mb-1 text-muted" />
        <span className="tabular text-[30px] font-medium leading-none tracking-[-0.03em] text-fg">
          <CountUp value={verified} duration={0.9} />
          <span className="text-muted">/{pages.length}</span>
        </span>
        <span className="mt-1 text-caption text-muted">verified</span>
      </span>
    </div>
  );

  const cell = (p: OrbitPage, style?: React.CSSProperties) => (
    <Link
      href={p.href}
      ref={(el) => {
        if (el) cellRefs.current.set(p.id, el);
        else cellRefs.current.delete(p.id);
      }}
      aria-label={`${p.title}, ${p.state === "verified" ? "verified" : whenOf(p, today)}`}
      className={cn(
        "cell focus-ring press group flex items-center gap-3 rounded-card py-2.5 pl-2.5 pr-3.5 hover:shadow-cell-hover",
        p.state === "stale" && "shadow-[var(--lb-shadow-cell),0_0_0_2px_color-mix(in_srgb,var(--lb-cat-coral-from)_55%,transparent),0_0_24px_-4px_color-mix(in_srgb,var(--lb-cat-coral-from)_45%,transparent)]",
      )}
      style={style}
    >
      <Plate state={p.state} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-row font-medium text-fg">{p.title}</span>
        <span className={cn("flex items-center gap-1.5 truncate text-caption", p.state === "stale" ? "font-medium text-cat-coral-text" : p.state === "due-soon" ? "font-medium text-cat-amber-text" : "text-muted")}>
          {p.ownerName ? <Avatar name={p.ownerName} seed={p.ownerId ?? p.ownerName} size="xs" /> : null}
          <span className="truncate">{whenOf(p, today)}</span>
        </span>
      </span>
    </Link>
  );

  return (
    <section aria-labelledby="orbit-heading" className="panel relative isolate overflow-hidden rounded-panel p-4 sm:p-5 md:p-6" data-freshness-lead>
      <HeroLight tone={light} />
      <header className="mb-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="orbit-heading" className="text-h2 font-medium text-fg md:text-hero">
            Every page in {name}
          </h2>
          <p className="mt-1 text-body text-muted">Each page with how far you can trust it today. Overdue ones may be out of date.</p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Freshness">
          {(["verified", "due-soon", "stale", "unset"] as FreshnessState[])
            .filter((k) => counts[k] > 0)
            .map((k) => (
              <li key={k} className="inline-flex items-center gap-2 text-small text-muted">
                <span className={cn("size-3 rounded-full", k === "verified" ? "cat-green" : k === "due-soon" ? "cat-amber" : k === "stale" ? "cat-coral" : "hatch")} aria-hidden />
                <span className={cn("tabular text-row font-medium", k === "stale" ? "text-cat-coral-text" : "text-fg")}>{counts[k]}</span>
                {k === "verified" ? "verified" : k === "due-soon" ? "due soon" : k === "stale" ? "stale" : "no date"}
              </li>
            ))}
        </ul>
      </header>

      <div ref={ref} className={cn(styles.stage, "relative")} style={{ height: wide ? h : undefined, maskImage: wide ? undefined : "none" }}>
        {wide && w ? (
          <>
            <svg className="absolute inset-0" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
              {placed.map(({ page, x, y }, i) => {
                const a = from(x, y);
                const b = edge(x, y);
                return (
                  <path
                    key={page.id}
                    d={`M${f(a.x)},${f(a.y)} L${f(b.x)},${f(b.y)}`}
                    pathLength={1}
                    className={cn(styles.edge, styles.spoke)}
                    style={{ "--c": HUE[page.state], "--d": `${150 + i * 80}ms` } as React.CSSProperties}
                  />
                );
              })}
              {!reduced && n
                ? (() => {
                    const { page, x, y } = placed[run]!;
                    const a = from(x, y);
                    const b = edge(x, y);
                    return (
                      <BeamPath
                        key={beat}
                        d={`M${f(a.x)},${f(a.y)} L${f(b.x)},${f(b.y)}`}
                        quiet={false}
                        draw={false}
                        repeat={1}
                        delay={beat === 0 ? 1.4 : 0}
                        duration={0.7}
                        width={2}
                        tone={HUE[page.state]}
                        onArrive={() => pulseNode(cellRefs.current.get(page.id), HUE[page.state])}
                        onSparkEnd={next}
                      />
                    );
                  })()
                : null}
            </svg>
            <div className={cn(styles.pop, styles.centered, "absolute")} style={{ left: cx, top: cy, "--d": "0ms" } as React.CSSProperties}>
              {hub(hubR * 2)}
            </div>
            <ul aria-label={`Pages in ${name}`}>
              {placed.map(({ page, x, y }, i) => (
                <li key={page.id} className={cn(styles.pop, styles.centered, "absolute")} style={{ left: x, top: y, width: CELL_W, "--d": `${420 + i * 80}ms` } as React.CSSProperties}>
                  {cell(page)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex flex-col items-center gap-5 pt-3">
            {hub(132)}
            <ul className="flex w-full flex-col gap-3" aria-label={`Pages in ${name}`}>
              {ordered.map((p) => (
                <li key={p.id}>{cell(p)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function ringStops(c: Record<FreshnessState, number>, total: number): string {
  if (!total) return "var(--lb-border-strong) 0 360deg";
  const order: FreshnessState[] = ["verified", "due-soon", "stale", "unset"];
  let at = 0;
  const out: string[] = [];
  for (const k of order) {
    if (!c[k]) continue;
    const span = (c[k] / total) * 360;
    const end = Math.round((at + span) * 10) / 10;
    out.push(`${HUE[k]} ${Math.round(at * 10) / 10}deg ${end - 1.5}deg`, `transparent ${end - 1.5}deg ${end}deg`);
    at += span;
  }
  return out.join(", ");
}
