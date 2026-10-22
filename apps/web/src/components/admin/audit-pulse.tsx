"use client";

import type { ReactNode } from "react";
import { LifeBuoy, LogIn, Shapes, SlidersHorizontal } from "lucide-react";
import { motion } from "motion/react";
import { CountUp, EASE_OUT_EXPO, useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { CategoryBlock, type CategoryTone } from "@/components/ui/category-block";
import { HeroLight } from "@/components/ui/hero-light";

export type PulseKind = "auth" | "admin" | "helpdesk" | "other";

export interface PulseBucket {
  /** e.g. "Fri 14:00" */
  label: string;
  counts: Record<PulseKind, number>;
  now?: boolean;
  /** First hour of a new day: draws a day tick under the bar. */
  day?: string;
}

const KINDS: { kind: PulseKind; label: string; short: string; bar: string; tone: CategoryTone; icon: ReactNode; filter: string }[] = [
  { kind: "admin", label: "Admin changes", short: "Admin", bar: "bg-cat-violet", tone: "violet", icon: <SlidersHorizontal />, filter: "" },
  { kind: "auth", label: "Sign-ins", short: "Sign-ins", bar: "bg-cat-blue", tone: "blue", icon: <LogIn />, filter: "auth" },
  { kind: "helpdesk", label: "Helpdesk", short: "Help", bar: "bg-cat-green", tone: "green", icon: <LifeBuoy />, filter: "helpdesk" },
  { kind: "other", label: "Everything else", short: "Other", bar: "bg-cat-amber", tone: "amber", icon: <Shapes />, filter: "" },
];

/**
 * The audit log's lead: the last 48 hours of activity as stacked hourly bars, coloured by what kind
 * of thing happened. The bars grow in left to right on first load (the page's authored moment);
 * kinds that map to one action prefix link to the log filtered to it.
 */
export function AuditPulse({ buckets, totals }: { buckets: PulseBucket[]; totals: Record<PulseKind, number> }) {
  const reduced = useMotionReduced();
  const max = Math.max(1, ...buckets.map((b) => b.counts.admin + b.counts.auth + b.counts.helpdesk + b.counts.other));
  const sum = totals.admin + totals.auth + totals.helpdesk + totals.other;
  return (
    <section aria-labelledby="pulse-heading" className="relative isolate flex flex-col gap-6 overflow-hidden rounded-panel panel p-6 dark:glass sm:p-8">
      {/* Blue: the log is information, never an alarm. */}
      <HeroLight tone="blue" position="top-left" />
      <div className="flex flex-col gap-2">
        <h2 id="pulse-heading" className="text-balance text-h2 font-medium text-fg md:text-hero">
          <CountUp value={sum} duration={1.1} className="tabular" /> {sum === 1 ? "entry" : "entries"} in the last 48 hours
        </h2>
        <p className="text-row text-muted">Coloured by what happened. Sign-ins and helpdesk open the log filtered to them.</p>
      </div>
      {/* The four kinds as filled category blocks: the same colours as the bars below. */}
      <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {KINDS.map((k) => (
          <li key={k.kind} className="min-w-0">
            {/* A kind with nothing in it stays quiet: a filled block is for something that happened. */}
            {!totals[k.kind] ? (
              <span className="flex min-h-11 items-center justify-between gap-2 rounded-cell bg-sunken/60 px-3.5 text-body text-subtle shadow-inset">
                <span className="truncate">
                  <span className="sm:hidden">{k.short}</span>
                  <span className="hidden sm:inline">{k.label}</span>
                </span>
                <span className="tabular">0</span>
              </span>
            ) : (
            <CategoryBlock
              size="sm"
              tone={k.tone}
              icon={k.icon}
              href={k.filter ? `/admin/audit?action=${encodeURIComponent(k.filter)}` : undefined}
              aria-label={k.filter ? `${k.label}: ${totals[k.kind]}. Show only these` : undefined}
              className="min-w-0"
              title={
                <span className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="truncate">
                    <span className="sm:hidden">{k.short}</span>
                    <span className="hidden sm:inline">{k.label}</span>
                  </span>
                  <span className="tabular font-medium">{totals[k.kind]}</span>
                </span>
              }
            />
            )}
          </li>
        ))}
      </ul>
      <div>
        <div
          className="flex h-28 items-end gap-[2px] sm:gap-[3px]"
          role="img"
          aria-label={`Audit entries per hour over the last 48 hours: ${KINDS.map((k) => `${totals[k.kind]} ${k.label.toLowerCase()}`).join(", ")}.`}
        >
          {buckets.map((b, i) => {
            const total = b.counts.admin + b.counts.auth + b.counts.helpdesk + b.counts.other;
            return (
              <motion.span
                key={i}
                title={`${b.label}: ${total} ${total === 1 ? "entry" : "entries"}`}
                className={cn(
                  "relative flex min-w-0 flex-1 origin-bottom flex-col-reverse overflow-hidden rounded-[3px]",
                  b.now && total > 0 && "outline outline-2 outline-offset-2 outline-now",
                )}
                style={{ height: total ? `${Math.max(8, (total / max) * 100)}%` : "4px" }}
                initial={{ scaleY: reduced ? 1 : 0 }}
                animate={{ scaleY: 1 }}
                transition={reduced ? { duration: 0 } : { delay: 0.15 + i * 0.012, duration: 0.5, ease: EASE_OUT_EXPO }}
              >
                {total ? (
                  KINDS.map((k) =>
                    b.counts[k.kind] ? <span key={k.kind} className={cn("w-full shrink-0", k.bar)} style={{ height: `${(b.counts[k.kind] / total) * 100}%` }} /> : null,
                  )
                ) : (
                  <span className={cn("h-full w-full", b.now ? "bg-now" : "bg-sunken")} />
                )}
              </motion.span>
            );
          })}
        </div>
        <div className="relative mt-2 flex h-4 text-caption text-subtle" aria-hidden>
          {buckets.map((b, i) =>
            b.day ? (
              <span key={i} className="absolute -translate-x-0" style={{ left: `${(i / buckets.length) * 100}%` }}>
                {b.day}
              </span>
            ) : null,
          )}
          <span className="absolute right-0">Now</span>
        </div>
      </div>
    </section>
  );
}
