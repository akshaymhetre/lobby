"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { motion } from "motion/react";
import { BrandMark } from "@/components/brand-mark";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedBeam } from "@/components/ui/effects/animated-beam";
import { HeroLight } from "@/components/ui/hero-light";
import { CountUp, EASE_OUT_EXPO, Words, useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import type { ProviderKey } from "./identity-providers";
import { ProviderLogo } from "./provider-logo";

/**
 * The identity page's hero: how a person gets in, as a verdict and the real chain. The verdict on
 * the left at hero size ("Keycloak lets 40 people in"); on the right the identity provider, the
 * company's Lobby and the people it lets in, joined by connectors. A tested connection is lit green
 * and a comet runs provider to Lobby to people once on load (the page's authored moment); a saved
 * but untested one is amber with quiet lines; no provider at all is red. The card's one light source
 * is the same colour, so in dark the state reads across the room.
 */
export function IdentityFlow({
  provider,
  providerKey,
  issuerHost,
  tested,
  testedLabel,
  companyName,
  logoUrl,
  people,
  faces,
  scim,
}: {
  provider: string | null;
  /** The provider's key, for its logo. */
  providerKey?: ProviderKey | null;
  issuerHost: string | null;
  tested: boolean;
  testedLabel: string;
  companyName: string;
  logoUrl: string | null;
  people: number;
  faces: { id: string; name: string }[];
  scim: boolean;
}) {
  const reduced = useMotionReduced();
  const box = React.useRef<HTMLDivElement>(null);
  const a = React.useRef<HTMLDivElement>(null);
  const b = React.useRef<HTMLDivElement>(null);
  const c = React.useRef<HTMLDivElement>(null);
  const state = tested ? "tested" : provider ? "saved" : "none";
  const verdict =
    state === "tested" ? `${provider} lets ${people} people in` : state === "saved" ? `${provider} is saved, not tested` : "Nobody can sign in with single sign-on yet";
  const sub =
    state === "tested"
      ? `${testedLabel}. ${scim ? "Accounts are kept in step by SCIM." : "Accounts appear the first time each person signs in."}`
      : state === "saved"
        ? "Sign in once with a real account to prove it, before employees try."
        : "Pick a provider below. Until then only the administrator account can sign in.";
  const enter = (i: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 10 },
    animate: { opacity: 1, y: 0 },
    transition: reduced ? { duration: 0.2 } : { delay: 0.15 + i * 0.12, duration: 0.5, ease: EASE_OUT_EXPO },
  });
  const node = "flex min-w-0 flex-col items-center gap-2.5 text-center";
  return (
    <section aria-labelledby="identity-verdict" className="relative isolate overflow-hidden rounded-panel panel dark:glass">
      <HeroLight tone={state === "tested" ? "green" : state === "saved" ? "amber" : "red"} position="top-left" />
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-center lg:gap-12">
        <div className="flex min-w-0 flex-col gap-3">
          <span
            className={cn(
              "inline-flex h-7 items-center gap-2 self-start rounded-full px-3 text-caption font-medium",
              state === "tested" ? "bg-success-soft text-success-text" : state === "saved" ? "bg-warning-soft text-warning-text" : "bg-danger-soft text-danger-text",
            )}
          >
            <span aria-hidden className={cn("size-1.5 rounded-full", state === "tested" ? "bg-success" : state === "saved" ? "bg-warning" : "bg-danger")} />
            {state === "tested" ? "Single sign-on working" : state === "saved" ? "Untested" : "Not connected"}
          </span>
          <h2 id="identity-verdict" className="text-balance text-h2 font-medium text-fg md:text-hero">
            <Words text={verdict} />
          </h2>
          <p className="max-w-lg text-row text-muted text-pretty">{sub}</p>
        </div>

        <div ref={box} className="relative grid grid-cols-3 items-start gap-3 sm:gap-6">
          <motion.div className={node} {...enter(0)}>
            <div ref={a} className="grid size-16 shrink-0 place-items-center rounded-full">
              {providerKey ? (
                <ProviderLogo provider={providerKey} size={64} />
              ) : (
                <span className="grid size-16 place-items-center rounded-full bg-raised text-fg shadow-cell">
                  <KeyRound className="size-7 stroke-[1.5]" aria-hidden />
                </span>
              )}
            </div>
            <span className="flex min-w-0 max-w-full flex-col">
              <span className="truncate text-row font-medium text-fg">{provider ?? "No provider"}</span>
              <span className="truncate text-caption text-muted">{issuerHost ?? "Pick one below"}</span>
            </span>
          </motion.div>
          <motion.div className={node} {...enter(1)}>
            <div
              ref={b}
              className={cn(
                "grid size-16 shrink-0 place-items-center rounded-full bg-raised shadow-cell",
                tested && "shadow-[var(--lb-shadow-cell),0_0_0_6px_color-mix(in_oklab,var(--lb-cat-green-to)_16%,transparent),0_0_28px_-4px_color-mix(in_oklab,var(--lb-cat-green-to)_55%,transparent)]",
              )}
            >
              <BrandMark name={companyName} logoUrl={logoUrl} size={40} className="rounded-full" />
            </div>
            <span className="flex min-w-0 max-w-full flex-col">
              <span className="truncate text-row font-medium text-fg">Lobby</span>
              <span className={cn("truncate text-caption", tested ? "text-success-text" : provider ? "text-warning-text" : "text-danger-text")}>{testedLabel}</span>
            </span>
          </motion.div>
          <motion.div className={node} {...enter(2)}>
            <div ref={c} className="flex h-16 shrink-0 items-center -space-x-3 rounded-full">
              {faces.slice(0, 3).map((f) => (
                <Avatar key={f.id} name={f.name} seed={f.id} size="lg" className="rounded-full ring-2 ring-surface" />
              ))}
            </div>
            <span className="flex min-w-0 max-w-full flex-col">
              <span className="truncate text-row font-medium text-fg">
                <CountUp value={people} duration={1} delay={0.5} /> people
              </span>
              <span className="truncate text-caption text-muted">{scim ? "Synced by SCIM" : "Join at first sign-in"}</span>
            </span>
          </motion.div>
          <AnimatedBeam containerRef={box} fromRef={a} toRef={b} fromAnchor="right" toAnchor="left" startXOffset={6} endXOffset={-6} active={tested} tone="green" width={2.5} delay={0.6} repeat={1} />
          <AnimatedBeam containerRef={box} fromRef={b} toRef={c} fromAnchor="right" toAnchor="left" startXOffset={6} endXOffset={-6} active={tested} tone="green" width={2.5} delay={1.3} repeat={1} pulseTarget={false} />
        </div>
      </div>
    </section>
  );
}
