"use client";

/**
 * Animated connector beams: a quiet connector line that draws itself on and then carries a
 * travelling spark (a bright head, a coloured tail, a soft glow on the surface), the way light
 * runs along the fan-out lines in the reference video.
 *
 *   <BeamPath d="M0,0 C…" active tone="gold" />        inside an SVG you already draw (org chart)
 *   <AnimatedBeam containerRef fromRef toRef … />       measures two elements and draws its own SVG
 *
 * Adapted from Magic UI's AnimatedBeam (MIT, https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/animated-beam.tsx):
 * the ref-based measuring, curvature and offsets are theirs. The spark is different: a
 * dash-offset travel along the real path (so it follows curves and corners, and a vertical line),
 * not a gradient swept across the bounding box.
 *
 * Both themes are designed: on light the spark is the hue, saturated, with a deeper core; on dark
 * it is additive light, a near-white head over the hue. Reduced motion shows the static lit line.
 * Off screen (and in a hidden tab) every animation pauses.
 */

import * as React from "react";
import { useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import styles from "./animated-beam.module.css";

/** Named tones map to the v2 tokens; any other string is used as a CSS colour. */
export type BeamTone = "accent" | "now" | "gold" | "cyan" | "violet" | "green" | "coral" | (string & {});

const TONES: Record<string, string> = {
  accent: "var(--lb-accent)",
  now: "var(--lb-now)",
  // The glow tokens carry alpha; relative colour syntax takes the opaque hue out of them.
  gold: "rgb(from var(--lb-glow-gold) r g b)",
  cyan: "rgb(from var(--lb-glow-cyan) r g b)",
  violet: "rgb(from var(--lb-glow-violet) r g b)",
  green: "var(--lb-cat-green-to)",
  coral: "var(--lb-cat-coral-to)",
};

const EASE = "cubic-bezier(0.45, 0.05, 0.55, 0.95)";
/** Pixels per second a spark travels when no duration is given. */
const SPEED = 480;

export interface BeamPathProps {
  /** The connector, in the parent SVG's user units. */
  d: string;
  /** Lit and sparking. When false only the quiet base line renders. */
  active?: boolean;
  /** Render the quiet base line (off when the surface already draws the connector). */
  quiet?: boolean;
  /**
   * How the lit line appears when it becomes active: `before` draws it on first, then the sparks
   * run; `with` makes the spark's first pass the pen that draws it; `false` shows it at once.
   */
  draw?: "before" | "with" | false;
  /** Seconds for the `before` draw-on. */
  drawDuration?: number;
  direction?: "forward" | "reverse";
  /** Seconds per pass. Defaults to the path length at about 480px/s, between 0.6s and 2.4s. */
  duration?: number;
  /** Seconds before the first pass (after the draw-on, when `before`). */
  delay?: number;
  /** Passes. `Infinity` loops. 0 lights the line with no spark. */
  repeat?: number;
  tone?: BeamTone;
  /** Base stroke width in user units. Every spark layer scales from it. */
  width?: number;
  /** Multiplies the spark's lengths, for a canvas that is scaled (pass 1/zoom). */
  scale?: number;
  /** Hold every animation (the component also pauses itself off screen). */
  paused?: boolean;
  /** Fires when the last spark pass finishes (never for an infinite repeat). */
  onSparkEnd?: () => void;
  /** Fires each time a comet reaches the end of the path (every pass, infinite ones included). Pair with pulseNode(). */
  onArrive?: (pass: number) => void;
  className?: string;
}

/**
 * The comet (wave 3): a tapered gradient streak (a 32px bright body fading out over about 96px)
 * with a 12px blurred halo in the tone colour.
 * Layer lengths in px, painted back to front; the stacked dashes share one leading edge, so short
 * bright layers over long faint ones read as a gradient from a hot head to a fading tail.
 */
const LAYERS: { cls: string; px: number }[] = [
  { cls: "halo", px: 52 },
  { cls: "tail2", px: 96 },
  { cls: "tail", px: 56 },
  { cls: "body", px: 32 },
  { cls: "hot", px: 14 },
  { cls: "core", px: 6 },
];

/**
 * Pulses a node when a comet arrives: a ring swells out of it in the tone colour and fades
 * (globals.css `[data-pulse="on"]`, 900ms). Safe to call repeatedly; reduced motion skips it.
 */
export function pulseNode(el: HTMLElement | null | undefined, color?: string) {
  if (!el || typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (color) el.style.setProperty("--pulse-color", color);
  el.removeAttribute("data-pulse");
  void el.offsetWidth; // restart the animation
  el.setAttribute("data-pulse", "on");
  window.setTimeout(() => {
    if (el.getAttribute("data-pulse") === "on") el.removeAttribute("data-pulse");
  }, 950);
}

/** Pauses a group's animations while its SVG is off screen or the tab is hidden. */
function useOffscreenPause(ref: React.RefObject<SVGGElement | null>, enabled: boolean) {
  const [offscreen, setOffscreen] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    if (!enabled) return;
    const g = ref.current;
    const target: Element | null = g?.ownerSVGElement ?? g;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOffscreen(!!entry && !entry.isIntersecting), { rootMargin: "80px" });
    io.observe(target);
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ref, enabled]);
  return offscreen || hidden;
}

/**
 * The beam as path elements, for an SVG the caller already positions (an org chart's edge layer).
 * Every path carries pathLength="1", so the dashes are fractions of the real length and the same
 * CSS serves a stub and a long fan line.
 */
export function BeamPath({
  d,
  active = true,
  quiet = true,
  draw = "before",
  drawDuration = 0.5,
  direction = "forward",
  duration,
  delay = 0,
  repeat = 2,
  tone = "accent",
  width = 1.25,
  scale = 1,
  paused = false,
  onSparkEnd,
  onArrive,
  className,
}: BeamPathProps) {
  const filterId = `ab-halo-${React.useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const passes = React.useRef(0);
  const reduced = useMotionReduced();
  const gRef = React.useRef<SVGGElement>(null);
  const measureRef = React.useRef<SVGPathElement>(null);
  const [len, setLen] = React.useState(0);
  const autoPaused = useOffscreenPause(gRef, active && !reduced);

  // Re-arm the draw-on each time the beam turns active (not on mount, where it already draws).
  const wasActive = React.useRef(active);
  const [run, setRun] = React.useState(0);
  React.useEffect(() => {
    if (active && !wasActive.current) setRun((n) => n + 1);
    wasActive.current = active;
  }, [active]);

  React.useLayoutEffect(() => {
    const p = measureRef.current;
    if (!p) return;
    try {
      setLen(p.getTotalLength());
    } catch {
      setLen(0);
    }
  }, [d]);

  const sparks = active && !reduced && repeat > 0 && len > 0;
  const dur = duration ?? Math.min(2.4, Math.max(0.6, (len / scale) / SPEED));
  const drawSecs = draw === "before" ? drawDuration : 0;
  const tail = sparks ? Math.min(0.98, (Math.max(...LAYERS.map((l) => l.px)) * scale) / len) : 0;
  const hue = TONES[tone] ?? tone;
  const style = {
    "--ab-hue": hue,
    "--ab-w": width,
    "--ab-dur": `${dur}s`,
    "--ab-draw": `${drawDuration}s`,
    "--ab-delay": `${drawSecs + delay}s`,
    "--ab-rep": repeat === Infinity ? "infinite" : String(Math.max(1, Math.round(repeat))),
    "--ab-ease": EASE,
    "--ab-tail": tail,
  } as React.CSSProperties;

  return (
    <g ref={gRef} className={cn(styles.g, (paused || autoPaused) && styles.paused, className)} style={style} aria-hidden>
      {/* The measuring path is also the base line; stroke none when the surface draws its own. */}
      <path ref={measureRef} d={d} pathLength={1} className={styles.base} style={quiet ? undefined : { stroke: "none" }} />
      {active ? <path key={run} d={d} pathLength={1} className={styles.lit} data-draw={reduced || !draw ? undefined : draw} data-dir={direction} /> : null}
      {sparks ? (
        <g
          key={`s${run}`}
          className={styles.spark}
          data-dir={direction}
          onAnimationIteration={(e) => {
            if (e.target === e.currentTarget) onArrive?.(++passes.current);
          }}
          onAnimationEnd={(e) => {
            if (e.target !== e.currentTarget) return;
            onArrive?.(++passes.current);
            onSparkEnd?.();
          }}
        >
          <defs>
            {/* The 12px halo: one blurred dash around the head, in the tone colour. */}
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={6 * scale} />
            </filter>
          </defs>
          {LAYERS.map((l) => (
            <path
              key={l.cls}
              d={d}
              pathLength={1}
              className={styles[l.cls]}
              filter={l.cls === "halo" ? `url(#${filterId})` : undefined}
              style={{ "--l": Math.min(0.98, (l.px * scale) / len) } as React.CSSProperties}
            />
          ))}
        </g>
      ) : null}
    </g>
  );
}

export type BeamAnchor = "center" | "left" | "right" | "top" | "bottom";

export interface AnimatedBeamProps extends Omit<BeamPathProps, "d" | "className"> {
  /** The positioned ancestor the SVG overlays (it needs `position: relative`). */
  containerRef: React.RefObject<HTMLElement | null>;
  fromRef: React.RefObject<HTMLElement | null>;
  toRef: React.RefObject<HTMLElement | null>;
  /** Which point of each element the beam attaches to. */
  fromAnchor?: BeamAnchor;
  toAnchor?: BeamAnchor;
  /**
   * `s`: an S-curve with horizontal tangents (a hub fanning out to targets). Otherwise a
   * quadratic bend of `curvature` px above the midpoint (negative bends below; 0 is straight).
   */
  shape?: "curve" | "s";
  curvature?: number;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
  /** Bump to re-measure (after a layout change the observers cannot see). */
  measureKey?: unknown;
  /** Pulse the target element (toRef) each time a comet arrives, in the beam's tone. Default true. */
  pulseTarget?: boolean;
  className?: string;
}

function anchorPoint(r: DOMRect, c: DOMRect, anchor: BeamAnchor, dx: number, dy: number) {
  const left = r.left - c.left;
  const top = r.top - c.top;
  const x = anchor === "left" ? left : anchor === "right" ? left + r.width : left + r.width / 2;
  const y = anchor === "top" ? top : anchor === "bottom" ? top + r.height : top + r.height / 2;
  return { x: x + dx, y: y + dy };
}

/**
 * A connector between two elements inside a container, measured with ResizeObserver, drawn as
 * its own absolutely positioned SVG. See BeamPath for the animation props.
 */
export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  fromAnchor = "center",
  toAnchor = "center",
  shape = "curve",
  curvature = 0,
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
  measureKey,
  pulseTarget = true,
  className,
  onArrive,
  ...beam
}: AnimatedBeamProps) {
  const hue = TONES[beam.tone ?? "accent"] ?? beam.tone;
  const arrive = React.useCallback(
    (pass: number) => {
      if (pulseTarget) pulseNode(beam.direction === "reverse" ? fromRef.current : toRef.current, hue);
      onArrive?.(pass);
    },
    [pulseTarget, beam.direction, fromRef, toRef, hue, onArrive],
  );
  const [geom, setGeom] = React.useState<{ d: string; w: number; h: number } | null>(null);

  // A passive effect, not a layout effect: React attaches refs in tree order during the layout
  // phase, so a beam rendered before its targets would measure them as null.
  React.useEffect(() => {
    let raf = 0;
    const update = () => {
      const c = containerRef.current;
      const a = fromRef.current;
      const b = toRef.current;
      if (!c || !a || !b) {
        // A target that mounts a frame later (a portal, a lazy child): try once more.
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          if (containerRef.current && fromRef.current && toRef.current) update();
        });
        return;
      }
      const cr = c.getBoundingClientRect();
      const p = anchorPoint(a.getBoundingClientRect(), cr, fromAnchor, startXOffset, startYOffset);
      const q = anchorPoint(b.getBoundingClientRect(), cr, toAnchor, endXOffset, endYOffset);
      const f = (n: number) => Math.round(n * 100) / 100;
      let d: string;
      if (shape === "s") {
        const cx = (p.x + q.x) / 2;
        d = `M${f(p.x)},${f(p.y)} C${f(cx)},${f(p.y)} ${f(cx)},${f(q.y)} ${f(q.x)},${f(q.y)}`;
      } else if (curvature) {
        d = `M${f(p.x)},${f(p.y)} Q${f((p.x + q.x) / 2)},${f((p.y + q.y) / 2 - curvature)} ${f(q.x)},${f(q.y)}`;
      } else {
        d = `M${f(p.x)},${f(p.y)} L${f(q.x)},${f(q.y)}`;
      }
      setGeom((prev) => (prev && prev.d === d && prev.w === cr.width && prev.h === cr.height ? prev : { d, w: cr.width, h: cr.height }));
    };
    update();
    const ro = new ResizeObserver(update);
    for (const r of [containerRef, fromRef, toRef]) if (r.current) ro.observe(r.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // measureKey is an external "re-measure" signal, listed so a bump re-runs the effect.
  }, [containerRef, fromRef, toRef, fromAnchor, toAnchor, shape, curvature, startXOffset, startYOffset, endXOffset, endYOffset, measureKey]);

  if (!geom) return null;
  return (
    <svg className={cn(styles.svg, className)} width={geom.w} height={geom.h} viewBox={`0 0 ${geom.w} ${geom.h}`} aria-hidden>
      <BeamPath d={geom.d} {...beam} onArrive={arrive} />
    </svg>
  );
}
