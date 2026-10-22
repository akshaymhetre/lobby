"use client";

import * as React from "react";
import { motion, useMotionReduced, EASE_OUT } from "@/components/ui/motion";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

/**
 * A person's face inside their progress: the generated avatar sits in a ring that fills in the
 * onboarding violet as their steps get done (green once everything is). The arc draws itself on
 * first view. The ring is a picture of the number next to it, so it is aria-hidden; the caller
 * prints the count.
 */
export function AvatarRing({
  person,
  done,
  total,
  size = 96,
  stroke = 5,
  delay = 0.2,
  className,
}: {
  person: { id: string; name: string; avatarUrl: string | null };
  done: number;
  total: number;
  size?: number;
  stroke?: number;
  delay?: number;
  className?: string;
}) {
  const reduced = useMotionReduced();
  const id = React.useId().replace(/:/g, "");
  const pct = total ? Math.min(1, done / total) : 1;
  const complete = total > 0 && done >= total;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = stroke + 5;
  const inner = size - gap * 2;

  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={complete ? "var(--lb-cat-green-from)" : "var(--lb-cat-violet-from)"} />
            <stop offset="100%" stopColor={complete ? "var(--lb-cat-green-to)" : "var(--lb-cat-violet-to)"} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-cat-violet-soft" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#ring-${id})`}
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduced ? c * (1 - pct) : c }}
          animate={{ strokeDashoffset: pct === 0 ? c : c * (1 - pct) }}
          transition={reduced ? { duration: 0 } : { duration: 1.1, delay, ease: EASE_OUT }}
          style={{ opacity: pct === 0 ? 0 : 1 }}
        />
        {/* At zero, a single violet bead marks where the ring starts filling. */}
        {pct === 0 ? <circle cx={size - stroke / 2} cy={size / 2} r={stroke / 2 + 0.5} fill={`url(#ring-${id})`} /> : null}
      </svg>
      <Avatar name={person.name} seed={person.id} src={person.avatarUrl} size="xl" style={{ width: inner, height: inner }} />
    </span>
  );
}
