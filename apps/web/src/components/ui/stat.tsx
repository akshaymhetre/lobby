import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** e.g. "+12%" or "-3". Direction drives the arrow; `good` decides colour. */
  delta?: { value: string; direction: "up" | "down" | "flat"; good?: boolean };
  /** Context for the delta, e.g. "vs last month". */
  hint?: React.ReactNode;
  className?: string;
}

export function Stat({ label, value, delta, hint, className }: StatProps) {
  const Icon = delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : Minus;
  const tone =
    !delta || delta.direction === "flat" || delta.good === undefined
      ? "text-muted"
      : delta.good
        ? "text-success-text"
        : "text-danger-text";
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <dt className="text-small text-muted">{label}</dt>
      <dd className="tabular text-h2 font-medium text-fg">{value}</dd>
      {delta || hint ? (
        <dd className="flex items-center gap-1.5 text-small">
          {delta ? (
            <span className={cn("tabular inline-flex items-center gap-0.5 font-medium", tone)}>
              <Icon className="size-3.5 stroke-[2]" aria-hidden />
              {delta.value}
            </span>
          ) : null}
          {hint ? <span className="text-muted">{hint}</span> : null}
        </dd>
      ) : null}
    </div>
  );
}

/** Wraps several Stat items in a definition-list grid with hairline dividers. */
export function StatGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-card bg-border shadow-panel md:grid-cols-4",
        "[&>div]:bg-surface [&>div]:p-5",
        className,
      )}
    >
      {children}
    </dl>
  );
}
