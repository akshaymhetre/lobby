"use client";

import { Orb } from "@/components/ui/effects/orb";
import * as React from "react";
import { RotateCw } from "lucide-react";
import { AnimatedBeam, type BeamTone } from "@/components/ui/effects/animated-beam";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Kitchen sink: animated connector beams. Every variant twice, light beside dark, so the two
 * treatments can be judged on one screen. "Replay" remounts a demo so its draw-on runs again.
 */
export default function AnimatedBeamDemo() {
  const [run, setRun] = React.useState(0);
  return (
    <main className="min-h-dvh bg-page px-4 py-10 text-fg sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-h1 font-medium text-fg">Animated beam</h1>
            <p className="mt-1 max-w-[62ch] text-body text-fg/80">
              A connector that draws itself on, then carries a spark: a bright head, a coloured tail, a soft glow on the
              surface. Light shows a saturated hue on near-white; dark shows additive light. Reduced motion keeps the lit
              line and drops the travel. Off screen it pauses.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setRun((n) => n + 1)}>
            <RotateCw aria-hidden />
            Replay
          </Button>
        </header>

        <Pair title="Hub with five targets, S-curves, repeat 3 staggered" run={run}>
          {(dark) => <Fan key={run} dark={dark} />}
        </Pair>
        <Pair title="Straight beam (forward) and a curved beam (reverse)" run={run}>
          {(dark) => <Lines key={run} dark={dark} />}
        </Pair>
        <Pair title="Spark as the pen: the first pass draws the line (draw='with')" run={run}>
          {(dark) => <Pen key={run} dark={dark} />}
        </Pair>
      </div>
    </main>
  );
}

function Pair({ title, run, children }: { title: string; run: number; children: (dark: boolean) => React.ReactNode }) {
  return (
    <section aria-label={title} data-run={run}>
      <h2 className="mb-3 text-body-lg font-medium text-fg">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-panel bg-surface p-5 shadow-panel sm:p-6">{children(false)}</div>
        <div className="dark rounded-panel bg-page p-5 text-fg shadow-panel sm:p-6">{children(true)}</div>
      </div>
    </section>
  );
}

function Node({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("cell relative z-10 flex items-center gap-2.5 rounded-card px-3.5 py-2.5 text-small text-fg", className)}
      {...props}
    >
      {children}
    </div>
  );
}

const TARGETS: { label: string; count: number; tone: BeamTone }[] = [
  { label: "Services", count: 18, tone: "gold" },
  { label: "Entities", count: 3, tone: "cyan" },
  { label: "Related laws", count: 24, tone: "gold" },
  { label: "KPIs", count: 32, tone: "violet" },
  { label: "Reports", count: 12, tone: "gold" },
];

function Fan({ dark }: { dark: boolean }) {
  const container = React.useRef<HTMLDivElement>(null);
  const hub = React.useRef<HTMLDivElement>(null);
  const targets = React.useRef<(HTMLDivElement | null)[]>([]);
  const refs = React.useMemo(() => TARGETS.map((_, i) => ({ get current() { return targets.current[i] ?? null; } })), []);
  return (
    <div ref={container} className="relative flex h-[300px] items-center justify-between">
      <div
        ref={hub}
        className={cn("glass relative z-10 flex w-[120px] flex-col items-center gap-1 rounded-card px-3 py-5 text-center sm:w-[150px] sm:px-4", dark && "shadow-glow-cyan")}
      >
        <Orb size={36} />
        <span className="mt-2 text-small font-medium">Northwind Labs</span>
        <span className="text-caption text-muted">42 people</span>
      </div>
      <ol className="flex w-[138px] flex-col gap-2.5 sm:w-[170px]" aria-label="Targets">
        {TARGETS.map((t, i) => (
          <li key={t.label}>
            <Node
              ref={(el) => {
                targets.current[i] = el;
              }}
            >
              <span className="tabular text-body-lg font-medium">{t.count}</span>
              <span className="text-muted">{t.label}</span>
            </Node>
          </li>
        ))}
      </ol>
      {TARGETS.map((t, i) => (
        <AnimatedBeam
          key={t.label}
          containerRef={container}
          fromRef={hub}
          toRef={refs[i]!}
          fromAnchor="right"
          toAnchor="left"
          shape="s"
          tone={t.tone}
          delay={i * 0.12}
          repeat={3}
        />
      ))}
    </div>
  );
}

function Lines({ dark }: { dark: boolean }) {
  const container = React.useRef<HTMLDivElement>(null);
  const a = React.useRef<HTMLDivElement>(null);
  const b = React.useRef<HTMLDivElement>(null);
  const c = React.useRef<HTMLDivElement>(null);
  const d = React.useRef<HTMLDivElement>(null);
  return (
    <div ref={container} className="relative grid h-[300px] grid-cols-2 grid-rows-2 items-center justify-items-center">
      <Node ref={a}>Manager</Node>
      <Node ref={b}>Report</Node>
      <Node ref={c}>Hub</Node>
      <Node ref={d} className={dark ? "shadow-glow-gold" : undefined}>
        Target
      </Node>
      <AnimatedBeam containerRef={container} fromRef={a} toRef={b} fromAnchor="right" toAnchor="left" tone="accent" repeat={Infinity} />
      <AnimatedBeam containerRef={container} fromRef={c} toRef={d} curvature={70} tone="gold" direction="reverse" repeat={Infinity} />
    </div>
  );
}

function Pen({ dark }: { dark: boolean }) {
  const container = React.useRef<HTMLDivElement>(null);
  const top = React.useRef<HTMLDivElement>(null);
  const bottom = React.useRef<HTMLDivElement>(null);
  return (
    <div ref={container} className="relative flex h-[300px] flex-col items-start justify-between pl-2">
      <Node ref={top}>Before day 1</Node>
      <Node ref={bottom} className={dark ? "shadow-glow-cyan" : undefined}>
        Today
      </Node>
      <AnimatedBeam containerRef={container} fromRef={top} toRef={bottom} fromAnchor="bottom" toAnchor="top" tone="now" draw="with" repeat={1} duration={1.6} delay={0.3} />
    </div>
  );
}
