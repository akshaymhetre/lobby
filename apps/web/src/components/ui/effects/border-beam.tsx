"use client";

/**
 * BorderBeam: a thin light beam travelling around a card's rounded border, a soft glow on the card
 * surface that moves with it, and a faint bloom outside the edge. The attention effect from the
 * v2 direction ("a glowing border tracer travels once around the most important card").
 *
 *   <li className="relative isolate rounded-card ...">
 *     <BorderBeam tone="danger" loops={2} />
 *     ...content
 *   </li>
 *
 * Mount it as the FIRST child of a `relative isolate` element with a border radius; it reads the
 * radius from that parent (or takes `radius`). `isolate` matters: the beam paints at z-index -1 so
 * it never covers the card's text, and without a stacking context on the host it would paint
 * behind the host's background and vanish. The host does not need `overflow: hidden`: the beam
 * and the glow clip themselves to the rounded shape, and the bloom sits just outside it.
 *
 * All three layers run off one Web Animations clock (see border-beam.module.css). The keyframes
 * are computed from the box's real size, so the beam moves at a constant speed along the
 * perimeter and the tail keeps a constant length around corners and short edges alike.
 *
 * - `loops` defaults to 2: an attention effect runs a fixed number of times, then the beam fades
 *   and leaves a faint static highlight on the top edge. `"infinite"` is for a live state
 *   (thinking, syncing) and stops when `active` turns false.
 * - It pauses off screen and while the tab is hidden.
 * - Under reduced motion it renders the static top-edge highlight only.
 * - Decorative: aria-hidden, pointer-events none, painted beneath the card's content.
 */

import * as React from "react";
import { cn } from "@/lib/cn";
import styles from "./border-beam.module.css";

export type BeamTone = "accent" | "danger" | "now" | "violet" | "amber" | "green";

export interface BorderBeamProps {
  /** Colour family. Each tone has a light and a dark treatment. */
  tone?: BeamTone;
  /** Seconds for one trip around the border. */
  duration?: number;
  /** How many trips. After the last one the beam settles to a static top-edge highlight. */
  loops?: number | "infinite";
  /** Beam thickness and glow size. `sm` for pills, buttons and inputs. */
  size?: "sm" | "md";
  /**
   * `vivid` (default) is the attention effect: a 2px line with a white-hot head, a tail of about
   * a third of the perimeter and a large surface glow. `subtle` is for live states on controls
   * (a composer while thinking, a source row): a hairline and a quiet glow.
   */
  intensity?: "subtle" | "vivid";
  /** Corner radius in px. Defaults to the parent's computed border radius. */
  radius?: number;
  /** Seconds before the first trip starts. */
  delay?: number;
  /** Runs while true. Turning it false fades the beam out; turning it true again starts over. */
  active?: boolean;
  /** Overrides the tone's core colour with any CSS colour (LightSweep's `color`). */
  color?: string;
  /** What stays after the last loop: a faint static highlight on the top edge (default), or nothing. */
  settle?: "edge" | "none";
  /** Called after the last loop has finished (not when `active` is withdrawn). */
  onSettle?: () => void;
  className?: string;
}

type State = "idle" | "running" | "settled" | "static";

/* Head (hot core) and tail lengths along the perimeter. Subtle: px per size. Vivid: fractions of
   the perimeter, so the tail covers about a third of the trip whatever the card's size. */
const SUBTLE = { sm: { head: 26, tail: 120 }, md: { head: 48, tail: 220 } } as const;
const VIVID = { head: 0.07, tail: 0.33 } as const;

/**
 * Keyframes for one clockwise trip from the top centre. Each frame carries the conic angle of the
 * head, the angular size of the core and the tail AT THAT POSITION, and the head's px position.
 */
export function beamKeyframes(W: number, H: number, R: number, head: number, tail: number, samples = 96, fractions = false): Keyframe[] {
  const r = Math.max(0, Math.min(R, W / 2, H / 2));
  const sw = W - 2 * r;
  const sh = H - 2 * r;
  const arc = (Math.PI * r) / 2;
  const P = 2 * (sw + sh) + 4 * arc;
  if (!(P > 0)) return [];
  // `fractions`: head and tail are fractions of the perimeter. Either way the tail is capped at
  // about a third of the trip, or it never clears the corners.
  const tailLen = Math.min(fractions ? tail * P : tail, P * 0.35);
  const headLen = Math.min(fractions ? head * P : head, P * 0.08);

  const pt = (s: number): [number, number] => {
    let d = ((s % P) + P) % P;
    if (d < sw / 2) return [W / 2 + d, 0];
    d -= sw / 2;
    if (d < arc) return [W - r + r * Math.sin(d / r), r - r * Math.cos(d / r)];
    d -= arc;
    if (d < sh) return [W, r + d];
    d -= sh;
    if (d < arc) return [W - r + r * Math.cos(d / r), H - r + r * Math.sin(d / r)];
    d -= arc;
    if (d < sw) return [W - r - d, H];
    d -= sw;
    if (d < arc) return [r - r * Math.sin(d / r), H - r + r * Math.cos(d / r)];
    d -= arc;
    if (d < sh) return [0, H - r - d];
    d -= sh;
    if (d < arc) return [r - r * Math.cos(d / r), r - r * Math.sin(d / r)];
    d -= arc;
    return [d, 0];
  };
  // CSS conic angle: 0deg points up, clockwise positive, measured from the box centre.
  const raw = (s: number) => {
    const [x, y] = pt(s);
    return (Math.atan2(x - W / 2, -(y - H / 2)) * 180) / Math.PI;
  };
  const span = (a: number, b: number) => (((raw(a) - raw(b)) % 360) + 360) % 360;

  const frames: Keyframe[] = [];
  let angle = 0;
  let prev = raw(0);
  let rot = 0;
  let prevRot = 0;
  for (let i = 0; i <= samples; i++) {
    const s = (i / samples) * P;
    const cur = raw(s);
    let step = cur - prev;
    if (step < -180) step += 360;
    if (step > 180) step -= 360;
    angle += step;
    prev = cur;
    const [x, y] = pt(s);
    // Direction of travel (the edge's tangent), unwrapped, so the glow streak lies along the edge.
    const [x2, y2] = pt(s + 0.5);
    const [x1, y1] = pt(s - 0.5);
    const curRot = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    if (i === 0) rot = curRot;
    else {
      let d = curRot - prevRot;
      if (d < -180) d += 360;
      if (d > 180) d -= 360;
      rot += d;
    }
    prevRot = curRot;
    frames.push({
      offset: i / samples,
      "--bb-angle": `${(i === samples ? 360 : angle).toFixed(3)}deg`,
      "--bb-head": `${span(s, s - headLen).toFixed(3)}deg`,
      "--bb-tail": `${span(s - headLen, s - headLen - tailLen).toFixed(3)}deg`,
      "--bb-x": `${x.toFixed(2)}px`,
      "--bb-y": `${y.toFixed(2)}px`,
      "--bb-rot": `${rot.toFixed(3)}deg`,
    });
  }
  return frames;
}

function readRadius(el: HTMLElement | null): number {
  if (!el) return 16;
  const v = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(v) ? v : 16;
}

export function BorderBeam({
  tone = "accent",
  duration = 2.4,
  loops = 2,
  size = "md",
  intensity = "vivid",
  radius,
  delay = 0,
  active = true,
  color,
  settle = "edge",
  onSettle,
  className,
}: BorderBeamProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [state, setState] = React.useState<State>("idle");
  const [reduced, setReduced] = React.useState(false);
  const [box, setBox] = React.useState<{ w: number; h: number; r: number } | null>(null);
  const [run, setRun] = React.useState(0);
  const settleRef = React.useRef(onSettle);
  settleRef.current = onSettle;

  // Reduced motion: no travel, the static edge only. Read on the client after mount.
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Measure the parent (the card) and follow its size.
  React.useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const measure = () => {
      const rect = parent.getBoundingClientRect();
      const r = radius ?? readRadius(parent);
      setBox((b) => (b && b.w === rect.width && b.h === rect.height && b.r === r ? b : { w: rect.width, h: rect.height, r }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [radius]);

  // A fresh `active` edge starts a new run (so a settled beam can be replayed). Withdrawing it
  // keeps the clock alive for the fade-out, so the beam fades while still moving.
  const [live, setLive] = React.useState(false);
  React.useEffect(() => {
    if (active) {
      setLive(true);
      setRun((n) => n + 1);
      return;
    }
    const t = window.setTimeout(() => setLive(false), 600);
    return () => window.clearTimeout(t);
  }, [active]);

  // The clock. One WAAPI animation on the root drives every layer through inherited custom
  // properties; a second one on the same start time fades the whole thing in and out.
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !box || !live || reduced || run === 0) return;
    const frames = intensity === "vivid" ? beamKeyframes(box.w, box.h, box.r, VIVID.head, VIVID.tail, 96, true) : beamKeyframes(box.w, box.h, box.r, SUBTLE[size].head, SUBTLE[size].tail);
    if (!frames.length) return;
    const iterations = loops === "infinite" ? Infinity : Math.max(1, loops);
    const ms = Math.max(300, duration * 1000);

    const anim = el.animate(frames, { duration: ms, iterations, easing: "linear", delay: delay * 1000, fill: "both" });
    // A finite run fades in over the first 6% and out over the last 14% of the whole run, while the
    // beam keeps moving, so it never stops dead on the edge. Same start time, same clock.
    const fades: Animation[] = [];
    if (iterations !== Infinity) {
      const total = ms * iterations;
      const fadeFrames: Keyframe[] = [
        { opacity: 0, offset: 0 },
        { opacity: 1, offset: Math.min(0.06, 240 / total) },
        { opacity: 1, offset: 0.86 },
        { opacity: 0, offset: 1 },
      ];
      const opts: KeyframeAnimationOptions = { duration: total, easing: "linear", delay: delay * 1000, fill: "both" };
      el.querySelectorAll<HTMLElement>("[data-fade]").forEach((layer) => fades.push(layer.animate(fadeFrames, opts)));
    }
    const all = [anim, ...fades];
    let settled = false;
    const start = () => setState("running");
    const t = window.setTimeout(start, delay * 1000);
    anim.onfinish = () => {
      settled = true;
      setState("settled");
      settleRef.current?.();
    };

    // Pause off screen and while the tab is hidden; resume where it left off.
    let visible = true;
    let onScreen = true;
    const sync = () => {
      if (settled || anim.playState === "finished") return;
      if (visible && onScreen) all.forEach((a) => a.play());
      else all.forEach((a) => a.pause());
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = !!entry?.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    io.observe(el);
    const onVis = () => {
      visible = document.visibilityState === "visible";
      sync();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearTimeout(t);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      anim.onfinish = null;
      all.forEach((a) => a.cancel());
    };
  }, [box, live, reduced, run, size, intensity, loops, duration, delay]);

  // `active` withdrawn: fade out, no static edge.
  React.useEffect(() => {
    if (!active) setState("idle");
  }, [active]);

  const shown: State = reduced ? "static" : state === "settled" && settle === "none" ? "idle" : state;
  return (
    <span
      ref={ref}
      aria-hidden
      data-state={shown}
      data-beam={tone}
      // Not `cn`: tailwind-merge reads the hashed module class ("border-beam-module__x__root") as
      // a `border-*` utility and drops all but one of them.
      className={[styles.root, styles[tone], size === "sm" ? styles.sm : "", intensity === "subtle" ? styles.subtle : "", className ?? ""].filter(Boolean).join(" ")}
      style={{
        ...(box ? ({ "--bb-r": `${box.r}px` } as React.CSSProperties) : null),
        ...(color ? ({ "--bb-core": color, "--bb-tint": color } as React.CSSProperties) : null),
      }}
    >
      <span className={styles.bloom} data-fade />
      <span className={styles.frame} data-fade>
        <span className={styles.glow} />
        <span className={styles.soft} />
        <span className={styles.ring} />
      </span>
      <span className={styles.edge} />
    </span>
  );
}

/**
 * A card that carries the beam: `relative isolate`, rounded by its own classes, and leaving room
 * for the bloom. Use it when the surrounding layout would otherwise clip the halo outside the edge.
 */
export function BeamCard({ beam, className, children, ...props }: React.ComponentProps<"div"> & { beam?: BorderBeamProps | false }) {
  return (
    <div className={cn("relative isolate", className)} {...props}>
      {beam === false ? null : <BorderBeam {...beam} />}
      {children}
    </div>
  );
}
