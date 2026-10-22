"use client";

import * as React from "react";
import { Check, ListChecks, PartyPopper } from "lucide-react";
import { formatDay } from "@lobby/core/journeys/dates";
import { motion, useMotionReduced, EASE_OUT_EXPO } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import styles from "./phase-track.module.css";
import type { Track, TrackPhase } from "./track";

/**
 * The month track: a journey drawn as a row of phase blocks (Before day 1, Day 1, Week 1...),
 * one dot per step inside each, with today printed across it as the planner's dashed blue line.
 * Colour carries meaning only: the first day is green, the phase you are in is violet (an
 * onboarding step), finished phases settle to a quiet cell with a check, late steps are red dots.
 *
 * It builds on first view: the blocks rise in order, the dots pop in, the today line draws down.
 */
export function PhaseTrack({
  track,
  today,
  label,
  linkPhases = false,
  size = "lg",
  illustrative = false,
  className,
}: {
  track: Track;
  today: string;
  /** Accessible name for the whole track. */
  label: string;
  /** Each block links to its phase heading (`#phase-<key>`) on the same page. */
  linkPhases?: boolean;
  size?: "lg" | "sm";
  /** A picture of what a journey looks like (an empty state): no counts, no today line. */
  illustrative?: boolean;
  className?: string;
}) {
  const reduced = useMotionReduced();
  const n = track.phases.length;
  if (!n) return null;
  const pct = (track.todayAt / n) * 100;
  const pillAlign = track.todayAt < 0.35 ? "start" : track.todayAt > n - 0.35 ? "end" : "center";
  const lineDelay = reduced ? 0 : 0.12 + n * 0.07;

  return (
    <div className={cn("relative", size === "lg" ? "pt-10" : "pt-8", className)} role="group" aria-label={label}>
      <ol className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {track.phases.map((p, i) => (
          <motion.li
            key={p.key}
            className="flex px-[3px] sm:px-1"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reduced ? { duration: 0.2 } : { duration: 0.55, delay: 0.05 + i * 0.07, ease: EASE_OUT_EXPO }}
          >
            <PhaseBlock phase={p} index={i} size={size} link={linkPhases} today={today} illustrative={illustrative} />
          </motion.li>
        ))}
      </ol>

      {/* Today: the "now" pill over the track, with a short stem down to the block it falls in. */}
      {illustrative ? null : (
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-0 z-10 w-0"
        style={{ left: `${pct}%` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: lineDelay }}
      >
        <span
          className={cn(
            "absolute top-0 inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full bg-now px-2.5 text-caption font-medium text-now-fg shadow-cell",
            pillAlign === "center" && "-translate-x-1/2",
            pillAlign === "end" && "-translate-x-full",
            pillAlign === "start" && "-translate-x-2",
          )}
        >
          Today
          <span className="hidden opacity-80 sm:inline">{formatDay(today).replace(/^\w+ /, "")}</span>
        </span>
        {/* A short stem from the pill to the block's top edge, ending in a dot: it marks the
            spot without running through anything a reader needs to read. */}
        <motion.span
          className={cn("absolute left-[-1px] top-6 w-0.5 origin-top", size === "lg" ? "h-4" : "h-2", styles.todayLine)}
          initial={reduced ? { scaleY: 1 } : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={reduced ? { duration: 0 } : { duration: 0.35, delay: lineDelay + 0.1, ease: EASE_OUT_EXPO }}
        />
        <motion.span
          className={cn("absolute left-[-5px] size-2.5 rounded-full bg-now ring-[3px] ring-surface", size === "lg" ? "top-[35px]" : "top-[27px]")}
          initial={reduced ? { scale: 1, opacity: 0 } : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduced ? { duration: 0 } : { type: "spring", duration: 0.5, bounce: 0.4, delay: lineDelay + 0.35 }}
        />
      </motion.div>
      )}
      {illustrative ? null : <p className="sr-only">Today is {formatDay(today)}.</p>}
    </div>
  );
}

function PhaseBlock({ phase: p, index, size, link, today, illustrative }: { phase: TrackPhase; index: number; size: "lg" | "sm"; link: boolean; today: string; illustrative: boolean }) {
  const total = p.dots.length;
  const allDone = p.done === total;
  const late = p.dots.filter((d) => d.overdue).length;
  const tone = p.anchor ? "anchor" : p.current && !allDone ? "current" : allDone ? "done" : "plain";
  const onColour = tone === "anchor" || tone === "current";
  const dates = illustrative ? "" : p.first === p.last ? formatDay(p.first) : `${formatDay(p.first)} to ${formatDay(p.last)}`;
  const summary = illustrative ? `${p.label}: ${total} steps` : `${p.label}, ${dates}: ${p.done} of ${total} done${late ? `, ${late} overdue` : ""}${p.current && p.first <= today ? ", you are here" : ""}.`;
  const Tag = link ? "a" : "div";

  return (
    <Tag
      {...(link ? { href: `#phase-${p.key}` } : {})}
      aria-label={summary}
      className={cn(
        "group/block relative isolate flex w-full min-w-0 flex-col overflow-hidden rounded-cell",
        size === "lg" ? "min-h-[118px] gap-2 p-2.5 sm:p-3 md:min-h-[148px]" : "min-h-[92px] gap-1.5 p-2 sm:p-2.5",
        link && "focus-ring press",
        tone === "anchor" && `cat-green ${styles.anchorGlow}`,
        tone === "current" && `cat-violet ${styles.currentGlow}`,
        tone === "done" && "cell",
        tone === "plain" && "cell",
      )}
    >
      <span className="flex items-center justify-between gap-1.5">
        <span
          aria-hidden
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full [&_svg]:stroke-[1.75]",
            size === "lg" ? "size-7 [&_svg]:size-3.5" : "size-6 [&_svg]:size-3",
            onColour ? "bg-white/25 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]" : allDone ? "bg-sunken text-fg" : "bg-cat-violet-soft text-cat-violet-text",
          )}
        >
          {allDone ? <Check className="!stroke-[2.25]" /> : p.anchor ? <PartyPopper /> : <ListChecks />}
        </span>
        <span aria-hidden className="hidden items-center gap-1.5 sm:flex">
          {late && !onColour ? (
            <span className="tabular inline-flex h-5 items-center gap-1 rounded-full bg-danger-soft px-1.5 text-caption font-medium text-danger-text">
              <span className="size-1.5 rounded-full bg-danger" />
              {late}
              <span className="hidden lg:inline">late</span>
            </span>
          ) : null}
          {illustrative ? null : (
            <span className={cn("tabular text-caption font-medium", onColour ? "text-white/90" : "text-muted")}>
              {p.done}/{total}
            </span>
          )}
        </span>
      </span>
      <span aria-hidden className="flex min-w-0 flex-col">
        <span className={cn("text-small font-medium leading-tight text-pretty", onColour ? "text-white" : "text-fg")}>{p.label}</span>
        {illustrative ? null : (
          <span className={cn("tabular text-caption sm:hidden", late && !onColour ? "font-medium text-danger-text" : onColour ? "text-white/85" : "text-muted")}>
            {p.done}/{total}
          </span>
        )}
        <span className={cn("hidden truncate text-caption sm:block", onColour ? "text-white/80" : "text-muted")}>{illustrative ? p.first : formatDay(p.first)}</span>
      </span>
      {size === "lg" && p.nextTitle ? (
        <span
          aria-hidden
          className={cn(
            "hidden min-w-0 items-start gap-1.5 rounded-[12px] py-1 pl-2 pr-2.5 text-caption leading-[17px] md:flex",
            onColour ? "bg-white/18 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]" : "bg-sunken text-muted",
          )}
        >
          <span className={cn("mt-[6px] size-1.5 shrink-0 rounded-full", onColour ? "bg-white" : "bg-cat-violet")} />
          {/* Two lines rather than an ellipsis: a step name cut mid-word tells the reader nothing. */}
          <span className="line-clamp-2">{p.nextTitle}</span>
        </span>
      ) : null}
      <span aria-hidden className={cn("mt-auto flex flex-wrap", size === "lg" ? "gap-1.5" : "gap-1")}>
        {p.dots.map((d, j) => (
          <span
            key={d.id}
            className={cn(
              styles.dot,
              d.next && styles.next,
              "block rounded-full",
              size === "lg" ? "size-2.5" : "size-1.5",
              onColour
                ? d.status !== "pending"
                  ? "bg-white"
                  : d.overdue
                    ? "bg-danger ring-2 ring-white/80"
                    : d.next
                      ? "bg-white text-white"
                      : "ring-[1.5px] ring-inset ring-white/75"
                : d.status !== "pending"
                  ? "bg-fg/45"
                  : d.overdue
                    ? "bg-danger"
                    : d.next
                      ? "bg-cat-violet text-cat-violet"
                      : "ring-[1.5px] ring-inset ring-border-strong",
            )}
            style={{ "--d": `${180 + index * 70 + j * 35}ms` } as React.CSSProperties}
          />
        ))}
      </span>
    </Tag>
  );
}
