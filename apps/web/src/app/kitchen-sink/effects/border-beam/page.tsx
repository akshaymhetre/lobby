"use client";

import * as React from "react";
import { ArrowUpRight, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { BorderBeam, type BeamTone, type BorderBeamProps } from "@/components/ui/effects/border-beam";
import { LightSweep } from "@/components/ui/motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const TONES: BeamTone[] = ["danger", "accent", "now", "violet", "amber", "green"];

/**
 * Demo for BorderBeam: every tone in light and dark side by side, on a default card, a glass card
 * and a pill, plus the LightSweep compatibility wrapper and a reduced-motion note. "Replay"
 * remounts the beams so the fixed-loop variants run again.
 */
export default function BorderBeamDemo() {
  const [run, setRun] = React.useState(1);
  const [loops, setLoops] = React.useState<number | "infinite">(2);
  const [intensity, setIntensity] = React.useState<NonNullable<BorderBeamProps["intensity"]>>("vivid");
  return (
    <main className="min-h-dvh bg-canvas px-4 py-6 text-fg md:px-8">
      <div className="mx-auto max-w-[1400px] rounded-slab bg-page p-5 shadow-slab md:p-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-h2 font-medium">Border beam</h1>
            <p className="mt-1 max-w-[56ch] text-body text-fg">
              A thin light travels around the border, a glow on the surface follows it, and a faint bloom sits outside the edge. One clock drives all three. Finite runs settle to a static top-edge highlight.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-small text-fg">
              Intensity
              <select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value === "subtle" ? "subtle" : "vivid")}
                className="focus-ring h-11 cursor-pointer rounded-full bg-raised px-3 text-small text-fg shadow-cell md:h-9"
              >
                <option value="vivid">vivid</option>
                <option value="subtle">subtle</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-small text-fg">
              Loops
              <select
                value={String(loops)}
                onChange={(e) => setLoops(e.target.value === "infinite" ? "infinite" : Number(e.target.value))}
                className="focus-ring h-11 cursor-pointer rounded-full bg-raised px-3 text-small text-fg shadow-cell md:h-9"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="infinite">infinite</option>
              </select>
            </label>
            <Button variant="secondary" className="h-11 md:h-9" onClick={() => setRun((n) => n + 1)}>
              <RefreshCw />
              Replay
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <ThemeColumn theme="light" run={run} loops={loops} intensity={intensity} />
          <ThemeColumn theme="dark" run={run} loops={loops} intensity={intensity} />
        </div>

        <section className="mt-10">
          <h2 className="text-h4 font-medium">Reduced motion</h2>
          <p className="mt-1 max-w-[56ch] text-body text-fg">
            With prefers-reduced-motion the beam does not travel: only the static highlight on the top edge renders. Toggle it in the devtools rendering tab to check.
          </p>
        </section>
      </div>
    </main>
  );
}

function ThemeColumn({ theme, run, loops, intensity }: { theme: "light" | "dark"; run: number; loops: number | "infinite"; intensity: NonNullable<BorderBeamProps["intensity"]> }) {
  return (
    <div className={cn("min-w-0 rounded-panel bg-canvas p-3 sm:p-5 md:p-6", theme === "dark" && "dark text-fg")} data-theme={theme}>
      <p className="mb-4 text-caption font-medium uppercase tracking-[0.08em] text-fg">{theme}</p>
      <div className="min-w-0 rounded-panel bg-page p-3 shadow-slab sm:p-5" data-demo-root>
        <h2 className="mb-3 text-small font-medium text-fg">Default card, every tone</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TONES.map((tone, i) => (
            <div key={`${tone}-${run}`} className="relative isolate rounded-card panel p-4" data-demo={`card-${tone}`}>
              <BorderBeam tone={tone} loops={loops} delay={i * 0.12} intensity={intensity} />
              <div className="flex items-start gap-3">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-raised shadow-cell" aria-hidden>
                  <ShieldAlert className="size-4 stroke-[1.75] text-muted" />
                </span>
                <div className="min-w-0">
                  <p className="text-body font-medium text-fg">Critical concern · {tone}</p>
                  <p className="mt-0.5 text-small text-muted">Two policies have faced unexpected challenges from multiple teams during rollout.</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mb-3 mt-6 text-small font-medium text-fg">On the amber announcement block (the hardest surface)</h2>
        <div key={`amber-${run}`} className="relative isolate cat-amber rounded-card p-4 shadow-cell" data-demo="amber-block">
          <BorderBeam tone="danger" loops={loops} intensity={intensity} />
          <p className="text-body-lg font-medium">Please read the updated information security policy</p>
          <p className="mt-1 text-small opacity-85">We have updated the security policy with new rules for AI tools, personal devices and sharing.</p>
        </div>

        <h2 className="mb-3 mt-6 text-small font-medium text-fg">Glass card</h2>
        <div className="relative rounded-panel p-1" style={{ background: "radial-gradient(120% 90% at 30% 0%, var(--lb-glow-cyan), transparent 60%), radial-gradient(80% 80% at 90% 100%, var(--lb-glow-violet), transparent 60%)" }}>
          <div key={`glass-${run}`} className="relative isolate rounded-panel glass p-5" data-demo="glass">
            <BorderBeam tone="danger" loops={loops} intensity={intensity} />
            <p className="text-caption font-medium uppercase tracking-[0.08em] text-subtle">RI analysis</p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-[240px]">
                <p className="text-body-lg font-medium text-fg">Critical concerns</p>
                <p className="mt-1 max-w-[52ch] text-small text-muted">The following policies have faced unexpected challenges from multiple entities throughout the implementation process.</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-small text-muted">
                Travel policy v4 <ArrowUpRight className="size-3.5" aria-hidden />
              </span>
            </div>
          </div>
        </div>

        <h2 className="mb-3 mt-6 text-small font-medium text-fg">Pill and button (size sm)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span key={`pill-${run}`} className="relative isolate inline-flex h-9 items-center gap-2 rounded-full bg-raised px-4 text-small font-medium text-fg shadow-cell" data-demo="pill">
            <BorderBeam tone="accent" size="sm" loops={loops} duration={1.8} intensity={intensity} />
            <Sparkles className="size-4 text-muted" aria-hidden />
            Thinking
          </span>
          <span key={`pill2-${run}`} className="relative isolate inline-flex h-9 items-center rounded-full bg-accent px-4 text-small font-medium text-accent-fg shadow-cell" data-demo="pill-accent">
            <BorderBeam tone="now" size="sm" loops={loops} duration={1.8} intensity={intensity} />
            Approve
          </span>
          <span key={`pill3-${run}`} className="relative isolate inline-flex h-9 items-center rounded-full cat-amber px-4 text-small font-medium shadow-cell" data-demo="pill-amber">
            <BorderBeam tone="danger" size="sm" loops={loops} duration={1.8} intensity={intensity} />
            Due Friday
          </span>
        </div>

        <h2 className="mb-3 mt-6 text-small font-medium text-fg">LightSweep (compatibility wrapper, one trip)</h2>
        <LightSweep key={`sweep-${run}`} delay={0.2} className="rounded-card">
          <div className="rounded-card bg-raised px-4 py-3 text-body text-fg shadow-cell" data-demo="sweep">
            Top source: Parental leave policy
          </div>
        </LightSweep>
      </div>
    </div>
  );
}
