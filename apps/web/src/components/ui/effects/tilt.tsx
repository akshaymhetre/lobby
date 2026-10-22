"use client";

/**
 * Tilt: a subtle 3D tilt (max 5deg by default) that follows the pointer, with a specular sheen
 * sliding across the surface, and a spring return on leave. For hero-ish tiles only: the pinned
 * app tiles, not every card.
 *
 * It renders a plain <div> (not motion.div) so HTML5 drag handlers can be spread onto it without
 * colliding with motion's own drag props. The rotation comes from two `motion` springs written
 * straight to `style.transform`; no React render per frame. The press scale lives here too, so
 * a host that tilts should drop its own `active:scale-*`.
 *
 *   <Tilt className="relative isolate rounded-card cell" {...dragProps}>
 *     <SpotlightLayer />
 *     …
 *   </Tilt>
 *
 * Disabled (a plain div, no sheen) on touch devices and under reduced motion.
 */

import * as React from "react";
import { useMotionValueEvent, useSpring } from "motion/react";
import { useMotionReduced } from "@/components/ui/motion";
import styles from "./tilt.module.css";

export interface TiltProps extends React.ComponentProps<"div"> {
  /** Maximum rotation in degrees on each axis. Keep it between 3 and 6. */
  max?: number;
  /** Scale while the pointer is down. 1 disables it. */
  pressScale?: number;
  /** Draw the moving specular sheen. */
  sheen?: boolean;
  /** Perspective distance in px. Smaller is more dramatic. */
  perspective?: number;
}

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
const REDUCED = "(prefers-reduced-motion: reduce)";
const SPRING = { stiffness: 220, damping: 20, mass: 0.7 };

export const Tilt = React.forwardRef<HTMLDivElement, TiltProps>(function Tilt(
  { max = 5, pressScale = 0.98, sheen = true, perspective = 900, className, style, children, onPointerMove, onPointerLeave, onPointerDown, onPointerUp, ...rest },
  forwardedRef,
) {
  const reduced = useMotionReduced();
  const ref = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(forwardedRef, () => ref.current as HTMLDivElement);
  // Enabled only for a hovering fine pointer with no reduced-motion preference. `reduced` comes
  // from the shared hook (it tracks changes); the media query is read here too so the first
  // client render after hydration already knows, and a touch device never attaches the springs.
  const [fine, setFine] = React.useState(false);
  React.useEffect(() => setFine(window.matchMedia(FINE_POINTER).matches && !window.matchMedia(REDUCED).matches), []);
  const enabled = fine && !reduced;

  const rx = useSpring(0, SPRING);
  const ry = useSpring(0, SPRING);
  const sc = useSpring(1, { stiffness: 400, damping: 28 });

  const apply = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const x = rx.get();
    const y = ry.get();
    const s = sc.get();
    // Identity when at rest, so an idle tile keeps no transform and no stacking quirks.
    el.style.transform =
      Math.abs(x) < 0.01 && Math.abs(y) < 0.01 && Math.abs(s - 1) < 0.001
        ? ""
        : `perspective(${perspective}px) rotateX(${x.toFixed(2)}deg) rotateY(${y.toFixed(2)}deg) scale(${s.toFixed(3)})`;
  }, [rx, ry, sc, perspective]);
  useMotionValueEvent(rx, "change", apply);
  useMotionValueEvent(ry, "change", apply);
  useMotionValueEvent(sc, "change", apply);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(e);
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5; // -0.5 .. 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5;
    ry.set(nx * 2 * max);
    rx.set(-ny * 2 * max);
    // The sheen is a reflection: it sits opposite the pointer along the band's axis.
    el.style.setProperty("--tp", `${Math.round((1 - (nx + 0.5)) * 100)}%`);
    el.style.setProperty("--tilt-o", "1");
  };
  const leave = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(e);
    if (!enabled) return;
    rx.set(0);
    ry.set(0);
    sc.set(1);
    ref.current?.style.setProperty("--tilt-o", "0");
  };
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(e);
    if (enabled && pressScale !== 1 && e.button === 0) sc.set(pressScale);
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerUp?.(e);
    if (enabled) sc.set(1);
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ transformOrigin: "center", willChange: enabled ? "transform" : undefined, ...style }}
      onPointerMove={move}
      onPointerLeave={leave}
      onPointerDown={down}
      onPointerUp={up}
      {...rest}
    >
      {children}
      {sheen && enabled ? <span aria-hidden className={styles.sheen} /> : null}
    </div>
  );
});
