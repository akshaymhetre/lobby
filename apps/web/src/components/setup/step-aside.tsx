import * as React from "react";
import { HeroLight, type LightTone } from "@/components/ui/hero-light";

/**
 * The right-hand pane of a setup step: one lit panel showing what this step produces, the way
 * Stripe and Vercel onboarding keep the result in view while you fill the form. `visual` is the
 * step's picture (a chain, a launcher, shelves); `caption` says what it means in one line.
 */
export function StepAside({ tone, title, caption, children }: { tone: LightTone; title: React.ReactNode; caption?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="relative isolate flex flex-col gap-5 overflow-hidden rounded-panel panel p-6 dark:glass">
      <HeroLight tone={tone} position="top-right" />
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 font-medium text-fg">{title}</h2>
        {caption ? <p className="text-body text-muted text-pretty">{caption}</p> : null}
      </div>
      {children}
    </section>
  );
}
