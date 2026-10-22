import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * HeroLight (wave 3, problem 3): ONE coloured light source inside a hero card, tied to what the
 * card's data says. Dark: real emitted light (a wide coloured bloom plus a hot core) that makes the
 * teal glass feel lit. Light: the same light as a soft tint, present but never a pink wash.
 *
 *   <div className="panel relative isolate overflow-hidden rounded-panel">
 *     <HeroLight tone="amber" />            // "due": something has a deadline
 *     ...hero content
 *   </div>
 *
 * Tones carry meaning, so pick from the data, never for decoration:
 *   amber = due, teal = working / in progress, red = breaching / overdue, blue = info / neutral now,
 *   violet = onboarding, green = done / healthy.
 * The host must be `relative isolate` (the light paints at z-index -1, under the content and above
 * the host's background) and should clip (`overflow-hidden`) with its own radius.
 * Static under reduced motion; otherwise it breathes very slowly (14s), which reads as a lit room.
 * Decorative: aria-hidden, pointer-events none.
 *
 * The utility form is `panel-lit lit-<tone>` (globals.css) for a host that has no children to spare.
 */
export type LightTone = "amber" | "teal" | "red" | "blue" | "violet" | "green";

export interface HeroLightProps {
  tone: LightTone;
  /** Where the source sits. Default top-left, behind the title. */
  position?: "top-left" | "top" | "top-right" | "bottom-left" | "bottom-right" | "center";
  /** `normal` for a hero card; `strong` for a single-purpose spotlight (an empty state, a 404). */
  intensity?: "normal" | "strong";
  /** Breathe slowly. Default true; off under reduced motion regardless. */
  animate?: boolean;
  className?: string;
}

const AT: Record<NonNullable<HeroLightProps["position"]>, [string, string]> = {
  "top-left": ["8%", "0%"],
  top: ["50%", "-8%"],
  "top-right": ["92%", "0%"],
  "bottom-left": ["8%", "100%"],
  "bottom-right": ["92%", "100%"],
  center: ["50%", "45%"],
};

export function HeroLight({ tone, position = "top-left", intensity = "normal", animate = true, className }: HeroLightProps) {
  const [x, y] = AT[position];
  const color = `var(--lb-light-${tone})`;
  const reach = intensity === "strong" ? "95% 110%" : "70% 95%";
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]", className)} data-hero-light={tone}>
      <span
        className={cn("absolute -inset-[10%] motion-reduce:animate-none", animate && "animate-[lb-light-drift_14s_ease-in-out_infinite]")}
        style={{
          background: `radial-gradient(${reach} at ${x} ${y}, ${color} 0%, color-mix(in oklch, ${color} 45%, transparent) 36%, transparent 70%)`,
        }}
      />
      {/* The hot core: only reads in dark, where light is emitted rather than printed. */}
      <span
        className="absolute hidden size-56 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80 blur-3xl dark:block"
        style={{ left: x, top: y, background: color }}
      />
      {/* A tinted top edge: the light catching the rim of the card. */}
      <span
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color} ${position.includes("right") ? "80%" : position === "top" ? "50%" : "20%"}, transparent)` }}
      />
    </span>
  );
}
