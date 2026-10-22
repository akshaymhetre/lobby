"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import styles from "./orb.module.css";

export type OrbState = "idle" | "typing" | "thinking" | "done";

export interface OrbProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** Diameter in px. Every layer scales from it. */
  size?: number;
  /**
   * idle: slow breathing. typing: the inner field speeds up and brightens. thinking: a pulsing
   * ring and a faster swirl. done: one settle bounce, then the orb rests as idle on its own.
   */
  state?: OrbState;
  /** Gives the orb an accessible name (role img). Without one it is decorative and hidden. */
  label?: string;
}

/**
 * The assistant's face: a glossy liquid sphere. Pure CSS (see orb.module.css), transform and
 * opacity only, paused while off screen or in a hidden tab, and still under reduced motion
 * (a gentle opacity pulse remains for thinking, so the wait is still visible).
 *
 *   <Orb size={72} state="thinking" />
 */
export function Orb({ size = 64, state = "idle", label, className, style, ...props }: OrbProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const paused = useOffscreenPause(ref);
  // "done" is a one-shot: after the settle bounce the orb returns to idle until the state changes.
  const [rested, setRested] = React.useState(false);
  React.useEffect(() => {
    if (state !== "done") {
      setRested(false);
      return;
    }
    const t = setTimeout(() => setRested(true), 760);
    return () => clearTimeout(t);
  }, [state]);
  const visual: OrbState = state === "done" && rested ? "idle" : state;

  return (
    <span
      ref={ref}
      className={cn(styles.orb, className)}
      data-state={visual}
      data-paused={paused || undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ "--orb-size": `${size}px`, ...style } as React.CSSProperties}
      {...props}
    >
      <span className={styles.halo} />
      <span className={styles.shadow} />
      <span className={styles.ring} />
      <span className={styles.ring} />
      <span className={styles.body}>
        <span className={styles.sphere}>
          <span className={styles.field}>
            <span className={cn(styles.blob, styles.blobA)} />
            <span className={cn(styles.blob, styles.blobB)} />
            <span className={cn(styles.blob, styles.blobC)} />
          </span>
          <span className={styles.shade} />
          <span className={styles.lift} />
          <span className={styles.gloss} />
        </span>
      </span>
    </span>
  );
}

/** True while the element is out of the viewport or the tab is hidden, so infinite animations can hold. */
function useOffscreenPause(ref: React.RefObject<HTMLElement | null>): boolean {
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let visible = true;
    let tabShown = !document.hidden;
    const apply = () => setPaused(!(visible && tabShown));
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        apply();
      },
      { threshold: 0 },
    );
    io.observe(el);
    const onVis = () => {
      tabShown = !document.hidden;
      apply();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ref]);
  return paused;
}
