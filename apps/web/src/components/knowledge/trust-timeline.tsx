"use client";

import * as React from "react";
import { motion } from "motion/react";
import type { FreshnessState } from "@lobby/core/knowledge/freshness";
import { EASE_OUT_EXPO, useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { FRESH, dueWords, isoAddDays, isoDaysBetween, isoFmt } from "./freshness-tone";

/** The review cycle the core module uses; a page with no recorded check is drawn from review date minus one cycle. */
const CYCLE = 180;

/**
 * One page's span of trust, for the page's own dateline: verified on the left, due on the right,
 * today as a blue marker somewhere along it. On a stale page today sits past the end, and the gap
 * is the hatched coral run. The used part of the cycle fills, then the marker drops in on today.
 */
export function PageTimeline({
  state,
  verifiedOn,
  verifiedBy,
  reviewBy,
  today,
  compact = false,
}: {
  state: FreshnessState;
  verifiedOn: string | null;
  verifiedBy: string | null;
  reviewBy: string;
  today: string;
  /** Narrow column (the editor's settings panel): the caption stacks and drops the cycle share. */
  compact?: boolean;
}) {
  const reduced = useMotionReduced();
  const start = verifiedOn ?? isoAddDays(reviewBy, -CYCLE);
  const end = today > reviewBy ? today : reviewBy;
  const total = Math.max(1, isoDaysBetween(start, end));
  const pad = 3;
  const x = (d: string) => pad + (isoDaysBetween(start, d) / total) * (100 - pad * 2);
  const dueX = x(reviewBy);
  const nowX = x(today);
  const stale = state === "stale";
  const left = isoDaysBetween(today, reviewBy);
  const progress = Math.round(Math.min(100, Math.max(0, (isoDaysBetween(start, today) / Math.max(1, isoDaysBetween(start, reviewBy))) * 100)));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative h-9" role="img" aria-label={`Checked ${isoFmt(start, { day: "numeric", month: "short", year: "numeric" })}, due ${isoFmt(reviewBy, { day: "numeric", month: "short", year: "numeric" })}. ${dueWords(left)}.`}>
        {/* The whole cycle as a sunken track, then the part already used, up to today. */}
        <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-sunken shadow-inset" />
        {/* The planned span, start to due, in its freshness tint: the part still to run. */}
        {stale ? null : (
          <span className={cn("absolute top-1/2 h-2 -translate-y-1/2 rounded-full", FRESH[state].soft)} style={{ left: `${pad}%`, width: `${dueX - pad}%` }} />
        )}
        <motion.span
          className={cn("absolute top-1/2 h-2 -translate-y-1/2 origin-left rounded-full", stale ? "cat-coral" : state === "due-soon" ? "cat-amber" : "cat-green")}
          style={{ left: `${pad}%`, width: `${Math.max(0, Math.min(nowX, dueX) - pad)}%` }}
          initial={reduced ? { opacity: 0 } : { scaleX: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={reduced ? { duration: 0.2 } : { duration: 0.9, delay: 0.2, ease: EASE_OUT_EXPO }}
        />
        {stale ? (
          <motion.span
            className="absolute top-1/2 h-2 -translate-y-1/2 origin-left rounded-r-full"
            style={{
              left: `${dueX}%`,
              width: `${nowX - dueX}%`,
              backgroundImage: "repeating-linear-gradient(135deg, var(--lb-cat-coral-soft) 0 4px, color-mix(in oklab, var(--lb-cat-coral-to) 55%, transparent) 4px 6px)",
            }}
            initial={reduced ? { opacity: 0 } : { scaleX: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={reduced ? { duration: 0.2 } : { duration: 0.5, delay: 1, ease: EASE_OUT_EXPO }}
          />
        ) : null}
        {/* Start and due ticks. */}
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-raised shadow-cell ring-2 ring-cat-green" style={{ left: `${pad}%` }} />
        <span
          className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-raised shadow-cell ring-2", stale ? "ring-cat-coral" : "ring-border-strong")}
          style={{ left: `${dueX}%` }}
        />
        {/* Today: a blue marker that travels from the start to where we are. */}
        <motion.span
          className="absolute top-0 flex h-full -translate-x-1/2 flex-col items-center"
          style={{ left: `${nowX}%` }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={reduced ? { duration: 0.2 } : { type: "spring", duration: 0.6, bounce: 0.35, delay: 0.9 }}
        >
          <span className="now-rail relative h-full w-0.5" />
          <span className="absolute top-1/2 size-3.5 -translate-y-1/2 now-dot" />
        </motion.span>
      </div>
      <div className={cn("flex items-start justify-between gap-x-4 gap-y-1 text-caption", compact ? "flex-col" : "flex-wrap")}>
        <span className="text-muted">
          {verifiedOn ? "Checked" : "Cycle began"} <span className="font-medium text-fg">{isoFmt(start, { day: "numeric", month: "short", year: "numeric" })}</span>
          {verifiedOn && verifiedBy ? <> by {verifiedBy}</> : null}
        </span>
        <span className={cn(!compact && "text-right", stale ? "font-medium text-cat-coral-text" : "text-muted")}>
          {stale ? (
            <>
              Was due {isoFmt(reviewBy, { day: "numeric", month: "short", year: "numeric" })}, {dueWords(left)}
            </>
          ) : (
            <>
              Next check <span className="font-medium text-fg">{isoFmt(reviewBy, { day: "numeric", month: "short", year: "numeric" })}</span>
              {compact ? null : <span className="tabular"> · {progress}% of the cycle used</span>}
            </>
          )}
        </span>
      </div>
    </div>
  );
}
