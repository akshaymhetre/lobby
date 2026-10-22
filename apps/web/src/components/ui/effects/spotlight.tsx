"use client";

/**
 * SpotlightLayer: a cursor-follow surface light plus a border glow that is brightest nearest the
 * pointer, in the family of Magic UI's MagicCard and Aceternity's glowing effect (written fresh
 * for Lobby's tokens; nothing is ported).
 *
 * Drop it INSIDE the element that should light up. It listens to that element's pointer events
 * and writes three custom properties onto it (--sx, --sy, --spot-o); the CSS module draws the
 * light from those, so a pointer move never re-renders React. The host needs
 * `position: relative` and `isolation: isolate` (the layer sits at z-index -1, under the host's
 * text and above its background) and a border radius, which the layer inherits.
 *
 *   <a className="relative isolate rounded-card cell">
 *     <SpotlightLayer />
 *     …
 *   </a>
 *
 * Touch devices get nothing. Under reduced motion the light does not travel: a still light sits
 * at the top centre while the host is hovered. Both themes are designed in the module: a tinted,
 * normally blended wash for light (additive light is invisible on white) and a cyan wash with a
 * near-white border core for dark.
 */

import * as React from "react";
import styles from "./spotlight.module.css";

export interface SpotlightLayerProps {
  /** CSS colour for the light; defaults to the accent. Any colour the theme already uses. */
  color?: string;
  /** Radius of the surface light in px. Omit it to size from the host (its longer side, capped at 1.4x the shorter, clamped to 140..420). */
  size?: number;
  /** Draw the lit border ring. */
  edge?: boolean;
  /** Draw the surface light. */
  surface?: boolean;
  className?: string;
}

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
const REDUCED = "(prefers-reduced-motion: reduce)";

export function SpotlightLayer({ color, size, edge = true, surface = true, className }: SpotlightLayerProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    if (!window.matchMedia(FINE_POINTER).matches || window.matchMedia(REDUCED).matches) return;

    let raf = 0;
    let px = 0;
    let py = 0;
    const flush = () => {
      raf = 0;
      host.style.setProperty("--sx", `${px}px`);
      host.style.setProperty("--sy", `${py}px`);
    };
    const track = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const enter = (e: PointerEvent) => {
      if (size === undefined) {
        const r = host.getBoundingClientRect();
        // A short wide card gets a light sized by its height, so the spot stays local instead of
        // washing the whole row; a tall or square host gets its longer side.
        const auto = Math.min(Math.max(r.width, r.height), Math.min(r.width, r.height) * 1.4);
        host.style.setProperty("--spot-size", `${Math.round(Math.min(420, Math.max(140, auto)))}px`);
      }
      track(e);
      host.style.setProperty("--spot-o", "1");
    };
    const leave = () => host.style.setProperty("--spot-o", "0");

    host.addEventListener("pointerenter", enter);
    host.addEventListener("pointermove", track);
    host.addEventListener("pointerleave", leave);
    return () => {
      host.removeEventListener("pointerenter", enter);
      host.removeEventListener("pointermove", track);
      host.removeEventListener("pointerleave", leave);
      if (raf) cancelAnimationFrame(raf);
      host.style.removeProperty("--sx");
      host.style.removeProperty("--sy");
      host.style.removeProperty("--spot-o");
      host.style.removeProperty("--spot-size");
    };
  }, [size]);

  const style = {
    ...(size !== undefined ? { "--spot-size": `${size}px` } : null),
    ...(color ? { "--spot-accent": color } : null),
  } as React.CSSProperties;

  // Joined with a plain string: cn() (tailwind-merge) can drop a hashed module class it reads as a utility.
  return (
    <div ref={ref} aria-hidden className={className ? `${styles.layer} ${className}` : styles.layer} style={style}>
      {surface ? <span className={styles.glow} /> : null}
      {edge ? <span className={styles.edge} /> : null}
    </div>
  );
}
