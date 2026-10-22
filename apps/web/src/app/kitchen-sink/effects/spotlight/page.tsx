"use client";

/**
 * Demo: spotlight, tilt and shimmer, light and dark side by side. Reached from the kitchen sink.
 * Everything here is mock data; nothing reads the database.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, CalendarDays, FolderGit2, ListChecks, Receipt, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ShimmerText } from "@/components/ui/effects/shimmer-text";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { Tilt } from "@/components/ui/effects/tilt";
import { cn } from "@/lib/cn";

const APPS = [
  { name: "Grafana", icon: BarChart3, tone: "text-cat-amber-text bg-cat-amber-soft" },
  { name: "Expenses", icon: Receipt, tone: "text-cat-green-text bg-cat-green-soft" },
  { name: "Repos", icon: FolderGit2, tone: "text-cat-violet-text bg-cat-violet-soft" },
];

const PEOPLE = [
  { id: "p-ines", name: "Inês Carvalho", title: "Product designer", done: 5, total: 10 },
  { id: "p-tomas", name: "Tomás Reyes", title: "Platform engineer", done: 2, total: 12 },
];

function AppTileDemo({ name, icon: Icon, tone }: (typeof APPS)[number]) {
  return (
    <Tilt
      className={cn(
        "group relative isolate flex h-[104px] w-[132px] flex-col items-center justify-center gap-2.5 rounded-card bg-surface px-2 shadow-lift dark:bg-raised",
        "transition-[background-color,box-shadow] duration-120 ease-standard hover:bg-sunken/40 hover:shadow-cell-hover dark:hover:bg-hover",
      )}
      data-demo="tile"
    >
      <SpotlightLayer />
      <span className={cn("inline-flex size-10 items-center justify-center rounded-cell", tone)}>
        <Icon className="size-5 stroke-[1.5]" aria-hidden />
      </span>
      <span className="w-full truncate text-center text-small font-medium text-fg">{name}</span>
      <a href="#" aria-label={`${name}. Demo tile.`} className="absolute inset-0 rounded-card outline-none" onClick={(e) => e.preventDefault()} />
    </Tilt>
  );
}

function PersonTileDemo({ id, name, title, done, total }: (typeof PEOPLE)[number]) {
  return (
    <Link
      href="#"
      onClick={(e) => e.preventDefault()}
      className="focus-ring press relative isolate flex h-full w-[168px] flex-col items-center gap-2 rounded-card bg-raised px-3 pb-3 pt-4 text-center shadow-cell hover:shadow-cell-hover"
      data-demo="person"
    >
      <SpotlightLayer />
      <Avatar name={name} seed={id} size="xl" className="size-14" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body font-medium text-fg">{name}</span>
        <span className="truncate text-caption text-muted">{title}</span>
      </span>
      <span className="mt-auto inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-full bg-sunken px-2.5 text-caption font-medium text-fg">
        <ListChecks className="size-3.5 shrink-0 stroke-[1.75] text-muted" aria-hidden />
        <span className="truncate">{`${done}/${total} tasks done`}</span>
      </span>
    </Link>
  );
}

function LeadStoryDemo() {
  return (
    <div
      className="relative isolate overflow-hidden rounded-card bg-raised shadow-cell transition-[box-shadow,transform] duration-160 ease-standard hover:-translate-y-px hover:shadow-cell-hover"
      data-demo="lead"
    >
      <SpotlightLayer />
      <div className="flex flex-col gap-3 px-5 pb-4 pt-5">
        <div className="flex items-center gap-2.5 text-caption font-medium uppercase tracking-[0.08em] text-subtle">
          <span>Company</span>
          <Badge tone="accent" size="sm">
            Pinned
          </Badge>
        </div>
        <h3 className="text-h3 font-medium text-fg text-balance">Lisbon office moves to the river in March</h3>
        <p className="max-w-[520px] text-body text-muted text-pretty">
          Four floors, a roof terrace and a proper kitchen. Desk booking opens on the 2nd; the move weekend is the 14th and 15th.
        </p>
        <div className="flex items-center gap-2.5 border-t border-border pt-3">
          <Avatar name="Maya Chen" seed="maya" size="md" />
          <span className="flex flex-col">
            <span className="text-small font-medium text-fg">Maya Chen</span>
            <span className="text-caption text-muted">Head of People · 2 hours ago</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function PersonCardDemo({ name, title, seed, department }: { name: string; title: string; seed: string; department: string }) {
  return (
    <div
      className="group relative isolate flex w-[300px] items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5 shadow-lift transition-[border-color,background-color] duration-120 ease-standard hover:border-border-strong hover:bg-sunken/40 dark:hover:bg-raised"
      data-demo="card"
    >
      <SpotlightLayer />
      <Avatar name={name} seed={seed} size="md" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-body font-medium text-fg">{name}</span>
          <Badge tone="info" size="sm">
            Starting soon
          </Badge>
        </span>
        <span className="truncate text-small text-muted">{title}</span>
        <span className="truncate text-caption text-subtle">{department}</span>
      </div>
    </div>
  );
}

function Column({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-8 rounded-slab bg-page p-8 shadow-slab">
      <div className="flex items-baseline justify-between">
        <h2 className="text-h2 font-medium text-fg">{title}</h2>
        <span className="text-caption text-subtle">hover anything below</span>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-caption font-medium uppercase tracking-[0.08em] text-subtle">Spotlight + tilt: pinned app tiles</h3>
        <div className="flex flex-wrap gap-3">
          {APPS.map((a) => (
            <AppTileDemo key={a.name} {...a} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-caption font-medium uppercase tracking-[0.08em] text-subtle">Spotlight: onboarding tiles</h3>
        <div className="flex gap-2">
          {PEOPLE.map((p) => (
            <PersonTileDemo key={p.id} {...p} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-caption font-medium uppercase tracking-[0.08em] text-subtle">Spotlight: the lead story</h3>
        <LeadStoryDemo />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-caption font-medium uppercase tracking-[0.08em] text-subtle">Spotlight: directory grid card</h3>
        <PersonCardDemo name="Noor Haddad" title="Security engineer" seed="noor" department="Engineering · Lisbon" />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-caption font-medium uppercase tracking-[0.08em] text-subtle">Shimmer: thinking and loading labels</h3>
        <div className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-panel">
          <p className="flex items-center gap-2 text-small" data-demo="shimmer">
            <Sparkles className="size-3.5 text-muted" aria-hidden />
            <ShimmerText>Thinking</ShimmerText>
            <span className="text-muted">…</span>
          </p>
          <p className="flex items-center gap-2 text-small">
            <CalendarDays className="size-3.5 text-muted" aria-hidden />
            <ShimmerText duration={1.4}>Loading this week</ShimmerText>
          </p>
          <p className="flex items-center gap-2 text-body">
            <ShimmerText tone="fg">Summarising 3 pages from Knowledge</ShimmerText>
          </p>
          <p className="flex items-center gap-2 text-small">
            <ShimmerText active={false}>Not active: plain muted text</ShimmerText>
          </p>
        </div>
      </section>
    </div>
  );
}

export default function SpotlightEffectsPage() {
  return (
    <main className="min-h-screen bg-canvas p-6 text-fg">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 font-medium text-fg">Effects: spotlight, tilt, shimmer</h1>
          <p className="text-body text-muted">
            Hover-level micro-interactions. Touch and reduced motion get a still state. Light and dark are designed separately, not inverted.
          </p>
        </div>
        <Link href="/kitchen-sink" className="focus-ring press inline-flex h-9 items-center gap-1.5 rounded-full bg-raised px-4 text-small font-medium text-fg shadow-cell">
          <ArrowUpRight className="size-3.5" aria-hidden />
          Kitchen sink
        </Link>
      </header>
      <div className="grid gap-6 xl:grid-cols-2">
        <div data-theme-col="light">
          <Column title="Light" />
        </div>
        <div className="dark" data-theme-col="dark" style={{ colorScheme: "dark" }}>
          <Column title="Dark" />
        </div>
      </div>
    </main>
  );
}
