"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";

type Tone = "accent" | "success" | "warning" | "danger";
const fill: Record<Tone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};
const stroke: Record<Tone, string> = {
  accent: "stroke-accent",
  success: "stroke-success",
  warning: "stroke-warning",
  danger: "stroke-danger",
};

export function Progress({
  value,
  max = 100,
  tone = "accent",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { value: number; tone?: Tone; size?: "sm" | "md" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <ProgressPrimitive.Root
      value={value}
      max={max}
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-border",
        size === "md" ? "h-1.5" : "h-1",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full rounded-full transition-[width] duration-240 ease-standard", fill[tone])}
        style={{ width: `${pct}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export function ProgressRing({
  value,
  max = 100,
  size = 40,
  strokeWidth = 4,
  tone = "accent",
  label,
  showValue = true,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  tone?: Tone;
  /** Accessible name, e.g. "Onboarding progress". */
  label: string;
  showValue?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          className={cn("transition-[stroke-dashoffset] duration-240 ease-standard", stroke[tone])}
        />
      </svg>
      {showValue ? (
        <span className="tabular absolute font-semibold text-fg" style={{ fontSize: Math.max(13, size * 0.26) }}>
          {Math.round(pct)}%
        </span>
      ) : null}
    </div>
  );
}
