"use client";

/**
 * ShimmerText: a moving highlight through the glyphs, for "Thinking" and loading labels.
 *
 *   <ShimmerText>Thinking</ShimmerText>
 *   <ShimmerText active={streaming} tone="fg" duration={1.4}>Summarising 3 pages</ShimmerText>
 *
 * The base colour is AA in both themes on its own, and the band only ever adds contrast (accent
 * blue in light, white in dark), so the label stays readable at every point of the sweep. Under
 * reduced motion it is static text. The sweep pauses while the label is off screen or the tab is
 * hidden.
 */

import * as React from "react";
import styles from "./shimmer-text.module.css";

export interface ShimmerTextProps extends React.ComponentProps<"span"> {
  /** Run the sweep. False renders plain text in the base colour. */
  active?: boolean;
  /** Base colour: the muted label colour, or the full foreground. */
  tone?: "muted" | "fg";
  /** Seconds per sweep. */
  duration?: number;
}

/**
 * True while `ref` is off screen or the document is hidden. Infinite effects pause on it so an
 * animation nobody can see costs nothing.
 */
export function useOffscreenPause(ref: React.RefObject<Element | null>): boolean {
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = true;
    let hidden = document.visibilityState === "hidden";
    const update = () => setPaused(!visible || hidden);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      update();
    });
    io.observe(el);
    const onVisibility = () => {
      hidden = document.visibilityState === "hidden";
      update();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ref]);
  return paused;
}

export function ShimmerText({ active = true, tone = "muted", duration = 1.8, className, style, children, ...props }: ShimmerTextProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const paused = useOffscreenPause(ref);
  return (
    <span
      ref={ref}
      // Plain join, not cn(): tailwind-merge can drop a hashed module class it reads as a utility.
      className={className ? `${styles.text} ${className}` : styles.text}
      data-active={active ? "true" : undefined}
      data-tone={tone}
      data-paused={active && paused ? "true" : undefined}
      style={{ "--sh-dur": `${duration}s`, ...style } as React.CSSProperties}
      {...props}
    >
      {children}
    </span>
  );
}
