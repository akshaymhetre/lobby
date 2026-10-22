"use client";

import * as React from "react";
import { AppWindow, BookOpen, Compass, House, LifeBuoy, Users, type LucideIcon } from "lucide-react";
import { AnimatedBeam, type BeamTone } from "@/components/ui/effects/animated-beam";
import { useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import styles from "./front-door-scene.module.css";

/**
 * The front door's picture of what one sign-in opens: the company mark in the middle, the six
 * places of the intranet around it, and light travelling out along each connector. It shows the
 * product's own map (never data: this renders before anyone is signed in), and it is the page's
 * one authored moment. Decorative and aria-hidden; the slab's copy says the same thing in words.
 */

interface Node {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Disc tone: neutral, or a category colour when the place carries that category's meaning. */
  tone: "neutral" | "now" | "green" | "blue" | "violet" | "amber";
  beam: BeamTone;
  side: "left" | "right";
  /** Vertical position, percent of the scene height. */
  y: number;
}

const NODES: Node[] = [
  { key: "home", href: "/", label: "Your week", icon: House, tone: "now", beam: "now", side: "left", y: 18 },
  { key: "people", href: "/people", label: "People", icon: Users, tone: "green", beam: "green", side: "left", y: 50 },
  { key: "knowledge", href: "/knowledge", label: "Knowledge", icon: BookOpen, tone: "amber", beam: "gold", side: "left", y: 82 },
  { key: "apps", href: "/apps", label: "Every app", icon: AppWindow, tone: "neutral", beam: "cyan", side: "right", y: 18 },
  { key: "help", href: "/help", label: "Help", icon: LifeBuoy, tone: "blue", beam: "accent", side: "right", y: 50 },
  { key: "journeys", href: "/journeys", label: "Onboarding", icon: Compass, tone: "violet", beam: "violet", side: "right", y: 82 },
];

const discTone: Record<Node["tone"], string> = {
  neutral: "bg-raised text-fg",
  now: "bg-now-soft text-now-text",
  green: "bg-cat-green-soft text-cat-green-text",
  blue: "bg-cat-blue-soft text-cat-blue-text",
  violet: "bg-cat-violet-soft text-cat-violet-text",
  amber: "bg-cat-amber-soft text-cat-amber-text",
};

export function FrontDoorScene({
  hub,
  lit = true,
  className,
}: {
  hub: React.ReactNode;
  /** false after sign-out: the connectors stay as quiet lines and the places dim, because nothing is open. */
  lit?: boolean;
  className?: string;
}) {
  const reduced = useMotionReduced();
  const sceneRef = React.useRef<HTMLDivElement>(null);
  const hubRef = React.useRef<HTMLDivElement>(null);
  const refs = React.useRef<Record<string, React.RefObject<HTMLSpanElement | null>>>({});
  const nodes = NODES;
  for (const n of nodes) refs.current[n.key] ??= React.createRef<HTMLSpanElement>();

  return (
    <div
      ref={sceneRef}
      aria-hidden
      data-lit={lit || undefined}
      className={cn("relative isolate", styles.scene, className)}
    >
      {/* Faint concentric rings behind the hub: the door's "reach". */}
      <span className={styles.rings} />

      {nodes.map((n, i) => (
        <AnimatedBeam
          key={n.key}
          containerRef={sceneRef}
          fromRef={hubRef}
          toRef={refs.current[n.key]!}
          fromAnchor={n.side}
          toAnchor={n.side === "left" ? "right" : "left"}
          shape="s"
          active={lit}
          tone={n.beam}
          draw="before"
          drawDuration={0.7}
          delay={0.5 + i * 0.35}
          repeat={reduced ? 0 : Infinity}
          duration={1.6}
          width={1.5}
        />
      ))}

      <div ref={hubRef} className={styles.hub}>
        {lit ? (
          <>
            <span className={styles.pulse} />
            <span className={styles.pulse} data-late />
          </>
        ) : null}
        {hub}
      </div>

      {nodes.map((n, i) => {
        const Icon = n.icon;
        const body = (
          <>
            <span
              ref={refs.current[n.key]}
              className={cn(
                !lit && "opacity-55 grayscale",
                "inline-flex size-11 shrink-0 items-center justify-center rounded-full shadow-cell transition-shadow duration-160 sm:size-12",
                discTone[n.tone],
              )}
            >
              <Icon className="size-[18px] stroke-[1.75] sm:size-5" />
            </span>
            <span
              className={cn(
                "whitespace-nowrap text-small font-medium",
                "hidden text-fg sm:inline",
              )}
            >
              {n.label}
            </span>
          </>
        );
        return (
          <span
            key={n.key}
            className={cn(styles.node, n.side === "left" ? styles.left : styles.right)}
            style={{ top: `${n.y}%`, animationDelay: `${0.25 + i * 0.07}s` } as React.CSSProperties}
          >
            {body}
          </span>
        );
      })}
    </div>
  );
}
