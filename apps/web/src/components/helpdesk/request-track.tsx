"use client";

import * as React from "react";
import { Check, CircleCheck, Hourglass, Send, ShieldCheck, Users, X, type LucideIcon } from "lucide-react";
import { AnimatedBeam } from "@/components/ui/effects/animated-beam";
import { cn } from "@/lib/cn";
import type { StageState, TrackStage } from "./track-data";
import styles from "./request-track.module.css";

/**
 * The request track: where a request is on its way from Raised to Resolved, drawn the way the
 * Home planner draws a request (the cat-blue category, a frosted disc on the gradient). Finished
 * stages are lit, the live stage breathes and a spark runs into it, what is left is dashed.
 *
 *   <RequestTrack stages={buildStages({...})} />            the hero on a ticket and the catalog
 *   <RequestTrack stages={...} size="sm" />                 inline, in a list row
 *
 * Decorative parts are aria-hidden; the list itself reads as "Raised, done. With IT, now. ...".
 * Build the stages with buildStages() from ./track-data (server-safe).
 */

export type { StageState, TrackStage } from "./track-data";

const ICON: Record<TrackStage["key"], LucideIcon> = { raised: Send, approval: ShieldCheck, team: Users, resolved: CircleCheck };

const STATE_WORD: Record<StageState, string> = {
  done: "done",
  current: "happening now",
  waiting: "waiting on a reply",
  failed: "not approved",
  upcoming: "still to come",
};

/** The hue of a stage, for the halo, the glow and the spark. */
const HUE: Record<StageState, string> = {
  done: "var(--track-from)",
  current: "var(--track-from)",
  waiting: "var(--lb-cat-amber-to)",
  failed: "var(--lb-danger)",
  upcoming: "var(--lb-border-strong)",
};

/* Literal class names: Tailwind only generates utilities it can see written out in full. */
const FILL: Record<TrackTone, string> = {
  blue: "cat-blue",
  violet: "cat-violet",
  teal: "cat-teal",
  green: "cat-green",
};

export type TrackTone = "blue" | "violet" | "teal" | "green";

function nodeClass(st: StageState, last: boolean, tone: TrackTone = "blue") {
  if (st === "done") return last ? "cat-green shadow-cell" : `${FILL[tone]} shadow-cell`;
  if (st === "current") return `${FILL[tone]} shadow-cell-hover`;
  if (st === "waiting") return "cat-amber shadow-cell-hover";
  if (st === "failed") return "bg-danger text-danger-fg shadow-cell";
  return "cell text-subtle";
}

export function RequestTrack({
  stages,
  size = "lg",
  className,
  label = "Progress",
  spark = true,
  tone = "blue",
}: {
  stages: TrackStage[];
  /** lg: the hero. md: a row in the catalog's in-flight panel (no details). sm: dots only. */
  size?: "lg" | "md" | "sm";
  className?: string;
  label?: string;
  /** Run the spark into the live stage. Off in long lists so one row does not shout over the rest. */
  spark?: boolean;
  /** The team's category colour for the lit stages (blue by default, the request colour). */
  tone?: TrackTone;
}) {
  const toneVars = {
    "--track-from": `var(--lb-cat-${tone}-from)`,
    "--track-to": `var(--lb-cat-${tone}-to)`,
  } as React.CSSProperties;
  const md = size === "md";
  const container = React.useRef<HTMLDivElement>(null);
  const nodes = React.useRef<(HTMLSpanElement | null)[]>([]);
  const fromRef = React.useRef<HTMLSpanElement | null>(null);
  const toRef = React.useRef<HTMLSpanElement | null>(null);
  const live = stages.findIndex((st) => st.state === "current" || st.state === "waiting");
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    if (live > 0) {
      fromRef.current = nodes.current[live - 1] ?? null;
      toRef.current = nodes.current[live] ?? null;
      setReady(true);
    }
  }, [live]);

  // The run between stage i and i+1: lit when both are finished, a fade into the live stage, dashed after.
  const runClass = (i: number) => {
    const next = stages[i + 1];
    if (!next) return "";
    if (next.state === "done") return styles.lit;
    if (next.state === "current" || next.state === "waiting") return styles.into;
    if (next.state === "failed") return "bg-danger/60";
    return styles.todo;
  };

  if (size === "sm") {
    return (
      <div className={cn("inline-flex items-center", className)} style={toneVars}>
        <ol className="sr-only" aria-label={label}>
          {stages.map((st) => (
            <li key={st.key}>
              {st.label}, {STATE_WORD[st.state]}
            </li>
          ))}
        </ol>
        <span className="inline-flex items-center" aria-hidden>
          {stages.map((st, i) => {
            const isLive = i === live;
            return (
              <React.Fragment key={st.key}>
                <span
                  className="relative inline-flex"
                  style={{ "--track-hue": HUE[st.state] } as React.CSSProperties}
                >
                  {isLive ? <span className={styles.glow} /> : null}
                  <span
                    className={cn(
                      "block rounded-full",
                      isLive ? "size-3" : "size-2",
                      st.state === "upcoming"
                        ? "bg-transparent shadow-[inset_0_0_0_1.5px_var(--lb-border-strong)]"
                        : nodeClass(st.state, i === stages.length - 1, tone),
                    )}
                  />
                  {isLive ? <span className={styles.halo} style={{ inset: -4 }} /> : null}
                </span>
                {i < stages.length - 1 ? (
                  <span
                    className={cn("mx-0.5 h-0.5 w-4 rounded-full sm:w-5", runClass(i))}
                    style={{ "--track-hue": HUE[stages[i + 1]!.state] } as React.CSSProperties}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </span>
      </div>
    );
  }

  return (
    <div ref={container} className={cn("relative", className)} style={toneVars}>
      <ol
        aria-label={label}
        className="grid"
        style={{ gridTemplateColumns: `repeat(${md ? Math.max(4, stages.length) : stages.length}, minmax(0, 1fr))` }}
      >
        {stages.map((st, i) => {
          const Icon = st.state === "done" && i > 0 && i < stages.length - 1 ? Check : st.state === "failed" ? X : st.state === "waiting" ? Hourglass : ICON[st.key];
          const isLive = i === live;
          const last = i === stages.length - 1;
          return (
            <li
              key={st.key}
              className={cn("flex min-w-0 flex-col items-center text-center", md ? "gap-1" : "gap-2.5")}
              style={
                {
                  "--track-hue": HUE[st.state],
                  // In a list every track has four slots, so Raised and Resolved line up row to row.
                  gridColumn: md && stages.length === 3 && i === 1 ? "span 2" : undefined,
                } as React.CSSProperties
              }
            >
              <span className={cn("flex w-full items-center", md ? "h-9" : "h-12 sm:h-14")} aria-hidden>
                <span className={cn("h-[3px] flex-1 rounded-r-full", i === 0 ? "" : runClass(i - 1))} />
                <span
                  className="relative isolate inline-flex shrink-0"
                  style={{ "--track-hue": HUE[st.state] } as React.CSSProperties}
                >
                  {isLive ? <span className={styles.glow} /> : null}
                  <span
                    ref={(el) => {
                      nodes.current[i] = el;
                    }}
                    className={cn(
                      "inline-flex items-center justify-center rounded-full",
                      md ? (isLive ? "size-9" : "size-7") : isLive ? "size-12 sm:size-14" : "size-10 sm:size-11",
                      nodeClass(st.state, last, tone),
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center justify-center rounded-full [&_svg]:stroke-[1.75]",
                        st.state === "upcoming"
                          ? md ? "[&_svg]:size-3.5" : "[&_svg]:size-4"
                          : cn("bg-white/25 shadow-[inset_0_1px_0_rgb(255_255_255/0.45)]", md ? "[&_svg]:size-3.5" : "[&_svg]:size-4"),
                        md ? (isLive ? "size-6.5" : "size-5") : isLive ? "size-9 sm:size-10" : "size-7 sm:size-8",
                      )}
                    >
                      <Icon />
                    </span>
                  </span>
                  {isLive ? <span className={styles.halo} /> : null}
                </span>
                <span
                  className={cn("h-[3px] flex-1 rounded-l-full", last ? "" : runClass(i))}
                  style={last ? undefined : ({ "--track-hue": HUE[stages[i + 1]!.state] } as React.CSSProperties)}
                />
              </span>
              <span className="flex min-w-0 max-w-full flex-col gap-0.5 px-1">
                <span
                  className={cn(
                    md ? "text-caption font-medium" : "text-small font-medium text-balance",
                    st.state === "upcoming" ? "text-muted" : "text-fg",
                    st.state === "failed" && "text-danger-text",
                    st.state === "waiting" && "text-warning-text",
                  )}
                >
                  {st.label}
                  <span className="sr-only">, {STATE_WORD[st.state]}</span>
                </span>
                {st.detail && !md ? (
                  <span className="truncate text-caption text-muted" suppressHydrationWarning>
                    {st.detail}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      {spark && ready && live > 0 ? (
        <AnimatedBeam
          containerRef={container}
          fromRef={fromRef}
          toRef={toRef}
          fromAnchor="right"
          toAnchor="left"
          startXOffset={2}
          endXOffset={-2}
          quiet={false}
          draw={false}
          repeat={3}
          delay={0.7}
          width={md ? 2 : 3}
          tone={stages[live]!.state === "current" ? `var(--lb-cat-${tone}-from)` : HUE[stages[live]!.state]}
        />
      ) : null}
    </div>
  );
}
