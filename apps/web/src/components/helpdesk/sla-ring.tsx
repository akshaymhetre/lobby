"use client";

import * as React from "react";
import { motion } from "motion/react";
import { EASE_OUT_EXPO, useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/time";
import { compact, useNow } from "./badges";

export type RingTone = "ok" | "soon" | "breached" | "met" | "missed" | "paused";

const STROKE: Record<RingTone, string> = {
  ok: "var(--lb-cat-blue-from)",
  soon: "var(--lb-warning)",
  breached: "var(--lb-danger)",
  met: "var(--lb-success)",
  missed: "var(--lb-danger)",
  paused: "var(--lb-border-strong)",
};

const TEXT: Record<RingTone, string> = {
  ok: "text-fg",
  soon: "text-warning-text",
  breached: "text-danger-text",
  met: "text-success-text",
  missed: "text-danger-text",
  paused: "text-muted",
};

export function ringState(
  start: number,
  due: number,
  now: number,
  doneAt: number | null,
  breached: boolean,
): { tone: RingTone; used: number; value: string; unit: string } {
  const span = Math.max(1, due - start);
  if (doneAt) {
    const ok = doneAt <= due && !breached;
    return { tone: ok ? "met" : "missed", used: Math.min(1, (doneAt - start) / span), value: ok ? "Met" : compact(doneAt - due), unit: ok ? "on time" : "late" };
  }
  if (now >= due || breached) return { tone: "breached", used: 1, value: compact(now - due), unit: "overdue" };
  const left = due - now;
  return { tone: left <= 2 * 3600_000 ? "soon" : "ok", used: Math.max(0.02, (now - start) / span), value: compact(left), unit: "left" };
}

/**
 * An SLA clock as a ring: the arc is the share of the target already used, drawn on when it
 * mounts. Blue while there is time, amber in the last two hours, red once it is overdue, green
 * when it was met. The value in the middle is what a reader needs: the time left, or how late.
 */
export function SlaRing({
  start,
  due,
  doneAt,
  breachedAt,
  label,
  size = 88,
  className,
}: {
  start: string | Date;
  due: string | Date | null | undefined;
  doneAt?: string | Date | null;
  breachedAt?: string | Date | null;
  label: string;
  size?: number;
  className?: string;
}) {
  const reduced = useMotionReduced();
  const now = useNow();
  const ref = Date.now();
  const startMs = new Date(start).getTime();
  const dueMs = due ? new Date(due).getTime() : null;
  const st = dueMs
    ? ringState(startMs, dueMs, now ?? ref, doneAt ? new Date(doneAt).getTime() : null, !!breachedAt)
    : { tone: "paused" as RingTone, used: 0, value: "None", unit: "no target" };
  const r = 42;
  const big = size >= 64;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="relative isolate shrink-0"
        style={{ width: size, height: size }}
        role="img"
        suppressHydrationWarning
        aria-label={`${label}: ${st.value} ${st.unit}${dueMs ? `, due ${formatDateTime(new Date(dueMs))}` : ""}`}
      >
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="7" style={{ stroke: "var(--lb-hatch-bg)" }} />
          <motion.circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            style={{ stroke: STROKE[st.tone], filter: st.tone === "breached" ? "drop-shadow(0 0 4px color-mix(in srgb, var(--lb-danger) 60%, transparent))" : undefined }}
            initial={{ pathLength: reduced ? st.used : 0 }}
            animate={{ pathLength: st.used }}
            transition={{ duration: reduced ? 0 : 1.1, delay: reduced ? 0 : 0.35, ease: EASE_OUT_EXPO }}
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
          <span className={cn("tabular font-medium leading-none tracking-tight", size >= 96 ? "text-h4" : big ? "text-body" : "text-small", TEXT[st.tone])} suppressHydrationWarning>
            {st.value}
          </span>
          {big ? (
            <span className={cn("text-muted", size >= 96 ? "mt-1 text-caption" : "mt-0.5 text-caption leading-none")} suppressHydrationWarning>
              {/* Small rings say "late" for "overdue", so 13px text clears the stroke. */}
              {size >= 96 ? st.unit : st.unit === "overdue" ? "late" : st.unit === "no target" ? "none" : st.unit}
            </span>
          ) : null}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5" aria-hidden>
        <span className="text-small font-medium text-fg">{label}</span>
        <span className="text-caption text-muted" suppressHydrationWarning>
          {dueMs ? (st.tone === "met" || st.tone === "missed" ? `Target ${formatDateTime(new Date(dueMs))}` : `Due ${formatDateTime(new Date(dueMs))}`) : "No target"}
        </span>
      </div>
    </div>
  );
}
