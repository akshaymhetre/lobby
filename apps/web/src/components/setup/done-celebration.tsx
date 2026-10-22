"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AnimatedBeam } from "@/components/ui/effects/animated-beam";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { CountUp, EASE_OUT_EXPO, Reveal, RevealItem, useMotionReduced, Words } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import styles from "./done-celebration.module.css";
import { STEP_ICONS } from "./step-icons";
import { STEPS } from "./steps";

type StepStatus = "done" | "skipped" | undefined;

export interface DoneStats {
  people: number;
  apps: number;
  pages: number;
}

/**
 * The finish page's one celebratory moment, and the only place in the product that shows it.
 * The six steps sit in a column; one by one each sends a light into a miniature of the company's
 * own Lobby, already in its brand colour. When the last one lands the window lights up, a ring of
 * light runs once round it, the first faces arrive and the numbers of what is now live count up.
 * Then the page is still. Reduced motion: everything is simply there.
 */
export function DoneCelebration({
  title,
  lead,
  productName,
  companyName,
  logoUrl,
  status,
  stats,
  faces,
}: {
  title: string;
  lead: string;
  productName: string;
  companyName: string;
  logoUrl: string | null;
  status: Record<string, StepStatus>;
  stats: DoneStats;
  faces: { id: string; name: string }[];
}) {
  const reduced = useMotionReduced();
  const done = STEPS.filter((s) => status[s.key] === "done").length;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const windowRef = React.useRef<HTMLDivElement>(null);
  const stepRefs = React.useRef<(HTMLLIElement | null)[]>([]);
  const refObjs = React.useMemo(
    () => STEPS.map((_, i) => ({ get current() { return stepRefs.current[i] ?? null; } }) as React.RefObject<HTMLElement | null>),
    [],
  );
  const BEAM_AT = (i: number) => 0.8 + i * 0.2;
  const IGNITE = reduced ? 0 : BEAM_AT(STEPS.length - 1) + 0.7;
  const shown = faces.slice(0, 7);
  const more = Math.max(0, stats.people - shown.length);

  const cta = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button asChild size="lg">
        <Link href="/">
          Go to {productName}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
      <Button asChild variant="secondary">
        <Link href="/admin">Open admin</Link>
      </Button>
    </div>
  );

  return (
    <Reveal stagger={0.08} className="section-stack">
      <header className="flex flex-col gap-3" data-masthead>
        <RevealItem from="fade">
          <p className="flex items-center gap-1.5 text-small font-medium text-success-text">
            <Sparkles className="size-3.5 stroke-[1.75]" aria-hidden />
            <span>
              Setup complete, <CountUp value={done} duration={0.8} delay={0.3} /> of {STEPS.length} steps
            </span>
          </p>
        </RevealItem>
        <RevealItem from="fade">
          <h1 className="text-balance text-[40px] font-medium leading-[1.05] tracking-[-0.03em] text-fg md:text-[56px]">
            <Words text={title} stagger={0.07} delay={0.15} />
          </h1>
        </RevealItem>
        <RevealItem>
          <p className="max-w-lg text-pretty text-body-lg text-muted">{lead}</p>
        </RevealItem>
        {/* The way in sits under the promise, before the picture. */}
        <RevealItem className="pt-2">{cta}</RevealItem>
      </header>

      <RevealItem from="scale" duration={0.6}>
        <div ref={containerRef} className="relative isolate overflow-hidden rounded-panel panel p-4 dark:glass sm:p-6">
          <div aria-hidden className={styles.wash} />
          <div className="grid gap-6 md:grid-cols-[168px_minmax(0,1fr)] md:items-center md:gap-14">
            {/* The six steps. */}
            <ol className="grid grid-cols-3 gap-2 md:grid-cols-1 md:gap-2.5" aria-label="Setup steps">
              {STEPS.map((s, i) => {
                const st = status[s.key];
                const Icon = STEP_ICONS[s.key] ?? Check;
                return (
                  <li
                    key={s.key}
                    ref={(el) => {
                      stepRefs.current[i] = el;
                    }}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: reduced ? 0 : -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={reduced ? { duration: 0.25 } : { delay: 0.3 + i * 0.07, duration: 0.5, ease: EASE_OUT_EXPO }}
                      className="flex flex-col items-center gap-1.5 text-center md:flex-row md:gap-3 md:text-left"
                    >
                      <span className={styles.disc} data-state={st ?? "none"} aria-hidden>
                        <Icon className="size-4 stroke-[1.75]" />
                        {st === "done" ? (
                          <motion.span
                            className={styles.tick}
                            initial={{ scale: reduced ? 1 : 0 }}
                            animate={{ scale: 1 }}
                            transition={reduced ? { duration: 0 } : { delay: BEAM_AT(i) + 0.4, type: "spring", bounce: 0.5, duration: 0.5 }}
                          >
                            <Check className="size-2.5 stroke-[3]" />
                          </motion.span>
                        ) : null}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-caption text-fg md:text-body">{s.label}</span>
                        {st === "done" ? (
                          <span className="sr-only">done</span>
                        ) : (
                          <Link href={`/setup/${s.key}`} className="focus-ring rounded-[4px] text-caption font-medium text-accent-text hover:underline">
                            {st === "skipped" ? "Finish it" : "Not started"}
                          </Link>
                        )}
                      </span>
                    </motion.div>
                  </li>
                );
              })}
            </ol>

            {/* The company's own Lobby, live. */}
            <div className="relative">
              <motion.div
                aria-hidden
                className={styles.halo}
                initial={{ opacity: reduced ? 1 : 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: IGNITE, duration: 0.8 }}
              />
              <motion.div
                ref={windowRef}
                initial={{ scale: reduced ? 1 : 0.97 }}
                animate={{ scale: reduced ? 1 : [0.97, 0.97, 1.015, 1] }}
                transition={{ duration: reduced ? 0 : IGNITE + 0.6, times: reduced ? undefined : [0, IGNITE / (IGNITE + 0.6), (IGNITE + 0.25) / (IGNITE + 0.6), 1] }}
                className="relative isolate flex flex-col gap-4 rounded-card bg-page p-4 shadow-popover sm:p-5"
                role="img"
                aria-label={`${productName} home for ${companyName}: ${stats.people} people in the directory, ${stats.apps} apps in the catalogue and ${stats.pages} published pages.`}
              >
                <BorderBeam tone="accent" loops={1} duration={2} delay={IGNITE} intensity="vivid" settle="none" />
                <div className="flex items-center gap-2">
                  <BrandMark name={companyName} logoUrl={logoUrl} size={32} className="rounded-full" />
                  <span className="flex items-center gap-0.5 rounded-full bg-sunken p-0.5 shadow-inset">
                    <span className="rounded-full bg-raised px-2.5 py-1 text-caption font-medium text-fg shadow-cell">Home</span>
                    <span className="px-2 py-1 text-caption text-muted">Apps</span>
                    <span className="hidden px-2 py-1 text-caption text-muted sm:inline">People</span>
                  </span>
                  <span className="ml-auto inline-flex h-7 items-center gap-1 rounded-full bg-accent px-3 text-caption font-medium text-accent-fg shadow-cell">
                    <Sparkles className="size-3 stroke-[2]" />
                    Ask
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-h3 font-medium tracking-[-0.02em] text-fg">Welcome to {productName}</p>
                  <p className="text-small text-muted">Everything {companyName} needs, in one place.</p>
                </div>
                {/* The first faces arrive once the window lights. */}
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {shown.map((f, i) => (
                      <motion.span
                        key={f.id}
                        initial={{ opacity: 0, scale: reduced ? 1 : 0.4, y: reduced ? 0 : 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={reduced ? { duration: 0.2 } : { delay: IGNITE + 0.15 + i * 0.07, type: "spring", bounce: 0.45, duration: 0.55 }}
                        className="rounded-full ring-2 ring-page"
                      >
                        <Avatar name={f.name} seed={f.id} size="md" />
                      </motion.span>
                    ))}
                  </div>
                  {more ? <span className="tabular text-small text-muted">+{more} more</span> : null}
                </div>
                <dl className="grid grid-cols-3 gap-2">
                  {[
                    { n: stats.people, label: stats.people === 1 ? "person in the directory" : "people in the directory", cls: "bg-accent text-accent-fg shadow-cell" },
                    { n: stats.apps, label: stats.apps === 1 ? "app in the catalogue" : "apps in the catalogue", cls: "bg-accent-soft text-accent-text" },
                    { n: stats.pages, label: stats.pages === 1 ? "published page" : "published pages", cls: "bg-accent-soft text-accent-text" },
                  ].map((x) => (
                    <div key={x.label} className={cn("flex flex-col gap-0.5 rounded-cell p-3", x.cls)}>
                      <dd className="order-1 text-h2 font-medium leading-none">
                        <CountUp value={x.n} duration={1.2} delay={IGNITE + 0.2} />
                      </dd>
                      <dt className="order-2 text-small">{x.label}</dt>
                    </div>
                  ))}
                </dl>
              </motion.div>
            </div>
          </div>
          {STEPS.map((s, i) => (
            <AnimatedBeam
              key={s.key}
              className="hidden md:block"
              containerRef={containerRef}
              fromRef={refObjs[i]!}
              toRef={windowRef as React.RefObject<HTMLElement | null>}
              fromAnchor="right"
              toAnchor="left"
              startXOffset={6}
              shape="s"
              active={status[s.key] === "done"}
              draw="with"
              repeat={1}
              duration={0.8}
              delay={BEAM_AT(i)}
              width={2}
              tone={i % 2 ? "cyan" : "violet"}
            />
          ))}
        </div>
      </RevealItem>

    </Reveal>
  );
}
