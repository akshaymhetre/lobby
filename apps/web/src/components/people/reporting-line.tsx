"use client";

import * as React from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedBeam } from "@/components/ui/effects/animated-beam";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { cn } from "@/lib/cn";
import { personCellClass } from "./person-card";

export interface LinePerson {
  id: string;
  displayName: string;
  title: string | null;
  avatarUrl: string | null;
}

const WIDE = "(min-width: 768px)";
function subscribe(cb: () => void) {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
/** True at `md` and up. The server renders the stacked layout; the wide one takes over after hydration. */
function useWide(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

const MAX_REPORTS = 6;

/**
 * The profile's reporting line, drawn the way the org chart draws it. Wide: three columns, the
 * manager, this person, their reports, with a lit connector from the manager (one spark runs along
 * it when the page loads, the profile's authored moment) and quiet curves fanning out to the
 * reports. Narrow: the same people stacked on a rail. Every cell links to that person.
 */
export function ReportingLine({
  manager,
  person,
  reports,
  isSelf,
}: {
  manager: LinePerson | null;
  person: LinePerson;
  reports: LinePerson[];
  isSelf: boolean;
}) {
  const wide = useWide();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const managerRef = React.useRef<HTMLDivElement>(null);
  const selfRef = React.useRef<HTMLDivElement>(null);
  const shown = reports.slice(0, MAX_REPORTS);
  const count = shown.length;
  const reportRefs = React.useMemo(() => Array.from({ length: count }, () => React.createRef<HTMLDivElement>()), [count]);

  const self = (
    <div
      ref={selfRef}
      className="relative isolate flex min-h-14 items-center gap-3 rounded-cell bg-accent-soft py-2 pl-2.5 pr-3 shadow-cell ring-1 ring-accent/30"
    >
      <span className="relative inline-flex shrink-0 rounded-full ring-2 ring-accent ring-offset-2 ring-offset-accent-soft">
        <Avatar name={person.displayName} seed={person.id} src={person.avatarUrl} size="lg" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-body font-medium text-fg">{isSelf ? "You" : person.displayName}</span>
        <span className="line-clamp-2 text-small text-accent-text">
          {reports.length ? `${reports.length} direct ${reports.length === 1 ? "report" : "reports"}` : (person.title ?? "No title yet")}
        </span>
      </span>
    </div>
  );
  const more =
    reports.length > shown.length ? (
      <p className="px-1 text-small text-muted">
        and {reports.length - shown.length} more in the{" "}
        <Link href={`/org-chart?focus=${person.id}`} className="focus-ring rounded-[3px] text-accent-text hover:underline">
          org chart
        </Link>
      </p>
    ) : null;

  if (wide) {
    return (
      <div ref={containerRef} className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-14">
        <ColumnLabel>Manager</ColumnLabel>
        <ColumnLabel>{isSelf ? "You" : person.displayName.split(/\s+/)[0]}</ColumnLabel>
        <ColumnLabel>{reports.length ? `Direct reports ${reports.length}` : "Direct reports"}</ColumnLabel>
        <div className="relative z-10">
          {manager ? <Cell p={manager} cellRef={managerRef} /> : <p className="rounded-cell bg-raised/60 px-3 py-4 text-small text-muted">Top of the org chart</p>}
        </div>
        <div className="relative z-10">{self}</div>
        <div className="relative z-10 flex flex-col gap-2">
          {shown.length ? (
            shown.map((r, i) => <Cell key={r.id} p={r} cellRef={reportRefs[i]} />)
          ) : (
            <p className="rounded-cell bg-raised/60 px-3 py-4 text-small text-muted">No direct reports</p>
          )}
          {more}
        </div>
        {manager ? (
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={managerRef}
            toRef={selfRef}
            fromAnchor="right"
            toAnchor="left"
            tone="accent"
            quiet
            draw="before"
            drawDuration={0.45}
            delay={0.8}
            repeat={2}
            width={1.5}
          />
        ) : null}
        {shown.map((r, i) => (
          <AnimatedBeam
            key={r.id}
            containerRef={containerRef}
            fromRef={selfRef}
            toRef={reportRefs[i]!}
            fromAnchor="right"
            toAnchor="left"
            shape="s"
            tone="accent"
            quiet
            draw="before"
            drawDuration={0.4}
            delay={1.5 + i * 0.06}
            repeat={0}
            width={1.25}
          />
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-3">
      {manager ? (
        <>
          <Cell p={manager} cellRef={managerRef} hint="Manager" />
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={managerRef}
            toRef={selfRef}
            fromAnchor="bottom"
            toAnchor="top"
            tone="accent"
            quiet
            draw="before"
            drawDuration={0.5}
            delay={0.9}
            repeat={2}
            width={1.5}
          />
        </>
      ) : null}
      {self}
      {shown.length ? (
        <ul className="relative flex flex-col gap-2 pl-12">
          {/* The rail: from under this person down to the last report's elbow. */}
          <li aria-hidden role="presentation" className="pointer-events-none absolute -top-3 bottom-7 left-[30px] w-px bg-border-strong" />
          {shown.map((r) => (
            <li key={r.id} className="relative">
              {/* The elbow from the rail into this report. */}
              <span aria-hidden className="absolute -left-[18px] top-1/2 h-px w-[18px] bg-border-strong" />
              <Cell p={r} />
            </li>
          ))}
        </ul>
      ) : null}
      {more}
    </div>
  );
}

function ColumnLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 truncate px-1 text-small font-medium text-muted">{children}</p>;
}

function Cell({ p, cellRef, hint }: { p: LinePerson; cellRef?: React.Ref<HTMLDivElement>; hint?: string }) {
  return (
    <div ref={cellRef} className={cn(personCellClass, "flex min-h-14 items-center gap-3 py-2 pl-2.5 pr-3")}>
      <SpotlightLayer />
      <Avatar name={p.displayName} seed={p.id} src={p.avatarUrl} size="lg" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <Link href={`/people/${p.id}`} className="-my-1 truncate py-1 text-body font-medium text-fg outline-none after:absolute after:inset-0 after:rounded-cell">
          {p.displayName}
        </Link>
        <span className="line-clamp-2 text-small text-muted">{p.title ?? "No title yet"}</span>
      </span>
      {hint ? <span className="shrink-0 self-start pt-1 text-caption text-muted">{hint}</span> : null}
    </div>
  );
}
