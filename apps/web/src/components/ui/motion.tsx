"use client";

/**
 * Motion primitives for Lobby v2, built on `motion` (motion/react).
 *
 * Every primitive honours prefers-reduced-motion by collapsing to a plain opacity fade, so a
 * reader who asked for less motion still sees content arrive, just without travel, scale,
 * rotation or blur.
 *
 *   <Reveal stagger={0.06}>             staggered build; children are <RevealItem>
 *     <RevealItem>…</RevealItem>
 *   </Reveal>
 *   <CountUp value={45} suffix="%" />   tweens from 0 when it scrolls into view
 *   <Words text="Welcome, Maya" />      word-by-word reveal
 *   <BlurIn>…</BlurIn>                  materialises from blur 12px -> 0
 *   <Panel3D>…</Panel3D>                swings in from the right edge in perspective
 *   <LightSweep active>…</LightSweep>   a conic highlight travels once around the border
 *   <Pressable>…</Pressable>            press 0.97 + hover lift -1px (motion.button)
 *   <SlidingPill layoutId="tabs" />     the shared active pill behind tabs and segments
 */

import * as React from "react";
import { animate, LayoutGroup, motion, useInView, useReducedMotion, type HTMLMotionProps, type Transition, type Variants } from "motion/react";
import { cn } from "@/lib/cn";
import { BorderBeam } from "@/components/ui/effects/border-beam";

export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
/** No-bounce spring for ordinary UI (sliding pill, layout moves). */
export const SPRING_SNAPPY: Transition = { type: "spring", duration: 0.4, bounce: 0 };
/** The authored entrance spring: a soft landing with a hint of overshoot. */
export const SPRING_SOFT: Transition = { type: "spring", duration: 0.6, bounce: 0.12 };

export { LayoutGroup, motion };

/**
 * True when the reader asked for less motion. False until mounted: the server cannot read the
 * media query, so the first client render must match the server's HTML, and the reduced variants
 * take over right after hydration (with zero-duration transforms, so nothing travels).
 */
export function useMotionReduced(): boolean {
  const pref = useReducedMotion() ?? false;
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted && pref;
}

/** Transition for a reduced-motion variant: opacity fades, every transform snaps. */
const STILL = { y: { duration: 0 }, x: { duration: 0 }, scale: { duration: 0 }, rotateY: { duration: 0 }, filter: { duration: 0 } };

// ---------------------------------------------------------------- Reveal (staggered build)

const RevealContext = React.createContext<{ reduced: boolean; distance: number }>({ reduced: false, distance: 14 });

export interface RevealProps extends HTMLMotionProps<"div"> {
  /** Seconds between children. Whole sequence is capped by the children count, so keep lists short. */
  stagger?: number;
  /** Seconds before the first child. */
  delay?: number;
  /** Travel distance in px for the `up` variant. */
  distance?: number;
  /** Start the build when the group scrolls into view instead of on mount. */
  inView?: boolean;
}

export function Reveal({ stagger = 0.06, delay = 0, distance = 14, inView = false, className, children, ...props }: RevealProps) {
  const reduced = useMotionReduced();
  const ref = React.useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0.02 : stagger, delayChildren: delay } },
  };
  return (
    <RevealContext.Provider value={{ reduced, distance }}>
      <motion.div
        ref={ref}
        className={className}
        variants={variants}
        initial="hidden"
        animate={inView ? (seen ? "show" : "hidden") : "show"}
        {...props}
      >
        {children}
      </motion.div>
    </RevealContext.Provider>
  );
}

export interface RevealItemProps extends HTMLMotionProps<"div"> {
  /** `up` (default): opacity + 14px rise. `scale`: opacity + scale 0.96. `fade`: opacity only. */
  from?: "up" | "scale" | "fade";
  /** Seconds the item takes to arrive. */
  duration?: number;
}

export function RevealItem({ from = "up", duration = 0.5, className, children, ...props }: RevealItemProps) {
  const { reduced, distance } = React.useContext(RevealContext);
  // Reduced motion resets y and scale explicitly: the server rendered the moving variant (it cannot
  // read the media query), so the element must be told to sit still, not merely left alone.
  const hidden =
    reduced || from === "fade" ? { opacity: 0, y: 0, scale: 1 } : from === "scale" ? { opacity: 0, scale: 0.96 } : { opacity: 0, y: distance };
  const show = reduced || from === "fade" ? { opacity: 1, y: 0, scale: 1 } : from === "scale" ? { opacity: 1, scale: 1 } : { opacity: 1, y: 0 };
  const variants: Variants = {
    hidden,
    show: { ...show, transition: reduced ? { duration: 0.25, ...STILL } : { duration, ease: EASE_OUT_EXPO } },
  };
  return (
    <motion.div className={className} variants={variants} {...props}>
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------- CountUp

export interface CountUpProps extends React.ComponentProps<"span"> {
  value: number;
  /** Seconds. Ease-out. */
  duration?: number;
  /** Seconds before it starts. */
  delay?: number;
  prefix?: string;
  suffix?: string;
  /** Formatter for the animated value; defaults to rounding and the viewer's locale. */
  format?: (n: number) => string;
}

export function CountUp({ value, duration = 1, delay = 0, prefix = "", suffix = "", format, className, ...props }: CountUpProps) {
  const reduced = useMotionReduced();
  const ref = React.useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const fmt = React.useMemo(() => format ?? ((n: number) => Math.round(n).toLocaleString()), [format]);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !seen || done) return;
    if (reduced) {
      el.textContent = `${prefix}${fmt(value)}${suffix}`;
      setDone(true);
      return;
    }
    const controls = animate(0, value, {
      duration,
      delay,
      ease: EASE_OUT,
      onUpdate: (v) => {
        el.textContent = `${prefix}${fmt(v)}${suffix}`;
      },
      onComplete: () => setDone(true),
    });
    return () => controls.stop();
  }, [seen, value, duration, delay, prefix, suffix, fmt, reduced, done]);

  // The final value is rendered on the server so nothing is blank before hydration.
  return (
    <span ref={ref} className={cn("tabular", className)} aria-label={`${prefix}${fmt(value)}${suffix}`} {...props}>
      {`${prefix}${fmt(value)}${suffix}`}
    </span>
  );
}

// ---------------------------------------------------------------- Words

export interface WordsProps extends Omit<HTMLMotionProps<"span">, "children"> {
  text: string;
  /** Seconds between words. */
  stagger?: number;
  delay?: number;
}

/** Word-by-word reveal. The whole text stays one accessible string; the words are decorative. */
export function Words({ text, stagger = 0.05, delay = 0, className, ...props }: WordsProps) {
  const reduced = useMotionReduced();
  const words = text.split(/(\s+)/).filter((w) => w.length);
  const parent: Variants = { hidden: {}, show: { transition: { staggerChildren: reduced ? 0.015 : stagger, delayChildren: delay } } };
  const child: Variants = {
    hidden: reduced ? { opacity: 0, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 8, filter: "blur(6px)" },
    show: reduced ? { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.2, ...STILL } } : { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: EASE_OUT_EXPO } },
  };
  return (
    <motion.span className={className} aria-label={text} variants={parent} initial="hidden" animate="show" {...props}>
      {words.map((w, i) =>
        /^\s+$/.test(w) ? (
          <React.Fragment key={i}> </React.Fragment>
        ) : (
          <motion.span key={i} className="inline-block" variants={child} aria-hidden>
            {w}
          </motion.span>
        ),
      )}
    </motion.span>
  );
}

// ---------------------------------------------------------------- BlurIn

export interface BlurInProps extends HTMLMotionProps<"div"> {
  delay?: number;
  duration?: number;
}

/** Materialises from blur: filter 12px -> 0, opacity 0 -> 1, scale 0.98 -> 1. */
export function BlurIn({ delay = 0, duration = 0.55, className, children, ...props }: BlurInProps) {
  const reduced = useMotionReduced();
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0, filter: "blur(0px)", scale: 1 } : { opacity: 0, filter: "blur(12px)", scale: 0.98 }}
      animate={reduced ? { opacity: 1, filter: "blur(0px)", scale: 1 } : { opacity: 1, filter: "blur(0px)", scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(8px)", scale: 0.99 }}
      transition={reduced ? { duration: 0.25, delay, ...STILL } : { duration, delay, ease: EASE_OUT_EXPO }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------- Panel3D

export interface Panel3DProps extends HTMLMotionProps<"div"> {
  /** Which edge the panel swings in from. */
  side?: "right" | "left";
}

/**
 * The detail panel entrance: rotateY 22deg -> 0, translateX 80px -> 0, opacity, over a soft spring
 * of about 600ms. Wrap in <AnimatePresence> for the exit. The parent needs no perspective: the
 * transform carries its own.
 */
export function Panel3D({ side = "right", className, children, style, ...props }: Panel3DProps) {
  const reduced = useMotionReduced();
  const dir = side === "right" ? 1 : -1;
  return (
    <motion.div
      className={className}
      style={{ transformPerspective: 1400, transformOrigin: side === "right" ? "right center" : "left center", ...style }}
      initial={reduced ? { opacity: 0, rotateY: 0, x: 0 } : { opacity: 0, rotateY: 22 * dir, x: 80 * dir }}
      animate={reduced ? { opacity: 1, rotateY: 0, x: 0 } : { opacity: 1, rotateY: 0, x: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, rotateY: 10 * dir, x: 48 * dir, transition: { duration: 0.28, ease: EASE_OUT } }}
      transition={reduced ? { duration: 0.25, ...STILL } : SPRING_SOFT}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------- LightSweep

export interface LightSweepProps extends React.ComponentProps<"div"> {
  /** Runs the sweep once when it turns true. It never loops. */
  active?: boolean;
  /** Seconds before the sweep starts. */
  delay?: number;
  /** CSS colour for the highlight; defaults to the accent. */
  color?: string;
}

/**
 * A one-shot light sweep: the border beam makes one trip around the element (1.4s), then fades.
 * The wrapper is `position: relative`; give it the border radius and the beam follows it. Under
 * reduced motion a static highlight on the top edge shows instead of the trip. Built on
 * <BorderBeam> (components/ui/effects/border-beam).
 */
export function LightSweep({ active = true, delay = 0, color, className, style, children, ...props }: LightSweepProps) {
  return (
    <div className={cn("relative isolate", className)} style={style} {...props}>
      <BorderBeam active={active} delay={delay} loops={1} duration={1.4} color={color} tone="accent" intensity="subtle" settle="none" />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- Pressable

export type PressableProps = HTMLMotionProps<"button">;

/** Press scale 0.97 and a hover lift of -1px, with a snappy spring. For raised, tactile controls. */
export const Pressable = React.forwardRef<HTMLButtonElement, PressableProps>(function Pressable({ className, children, ...props }, ref) {
  const reduced = useMotionReduced();
  return (
    <motion.button
      ref={ref}
      className={className}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      whileHover={reduced ? undefined : { y: -1 }}
      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
      {...props}
    >
      {children}
    </motion.button>
  );
});

// ---------------------------------------------------------------- SlidingPill

export interface SlidingPillProps extends HTMLMotionProps<"span"> {
  /** Shared across the siblings of one control so the pill slides between them. */
  layoutId: string;
}

/**
 * The raised active pill behind tabs and segmented controls. Render it inside the ACTIVE item
 * only, with `position: relative` on the item; `layoutId` makes it slide when the active item changes.
 */
export function SlidingPill({ layoutId, className, style, ...props }: SlidingPillProps) {
  const reduced = useMotionReduced();
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10", className)}
      style={{ borderRadius: "inherit", ...style }}
      transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
      {...props}
    />
  );
}
