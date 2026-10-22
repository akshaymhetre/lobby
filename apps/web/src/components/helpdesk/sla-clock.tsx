"use client";

import * as React from "react";
import Link from "next/link";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { CategoryBlock, type CategoryTone } from "@/components/ui/category-block";
import { HeroLight } from "@/components/ui/hero-light";
import { pulseNode } from "@/components/ui/effects/animated-beam";
import { CountUp, EASE_OUT_EXPO, useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { compact, useNow } from "./badges";
import type { QueueRow } from "./queue-table";
import { AlarmClock, Clock3, Hourglass } from "lucide-react";

/*
 * The SLA clock: the queue's hero. Every open request in the view sits on a dial by when it is
 * due. "Now" is the glowing hand at twelve; the week ahead runs clockwise round the face (the next
 * two hours get the first sixty degrees, so the ones that matter have room), and everything already
 * overdue sits in the red quarter just BEHIND the hand, counter-clockwise, as if the clock had
 * already passed it. Requests sweep out from the hand to their place on first load (the queue's one
 * authored moment), and the most overdue one pulses when it lands. One light lights the card,
 * from the data: red when something is overdue, amber when something is due within two hours.
 * Beside the dial, the four most urgent requests as filled blocks: coral overdue, amber due soon.
 */

const H = 3600_000;
/** [time until due, degrees clockwise from twelve]. Overdue is negative on both. */
const STOPS: [number, number][] = [
  [-72 * H, -84],
  [-24 * H, -62],
  [-2 * H, -28],
  [0, -6],
];
const AHEAD: [number, number][] = [
  [0, 6],
  [2 * H, 60],
  [24 * H, 180],
  [7 * 24 * H, 266],
];

function lerp(stops: [number, number][], t: number) {
  if (t <= stops[0]![0]) return stops[0]![1];
  for (let i = 1; i < stops.length; i++) {
    const [t1, a1] = stops[i]!;
    const [t0, a0] = stops[i - 1]!;
    if (t <= t1) return a0 + ((t - t0) / (t1 - t0)) * (a1 - a0);
  }
  return stops[stops.length - 1]![1];
}
const angleFor = (delta: number) => (delta < 0 ? lerp(STOPS, delta) : lerp(AHEAD, delta));

/** Lane radii as a share of the dial's half-width: the outer lane first. */
const LANES = [0.8, 0.62, 0.44];
const HUB = 0.27;
const DOT = 34;

const TICKS: { t: number; label: string }[] = [
  { t: 2 * H, label: "2h" },
  { t: 8 * H, label: "8h" },
  { t: 24 * H, label: "Tomorrow" },
  { t: 3 * 24 * H, label: "3 days" },
  { t: 7 * 24 * H, label: "A week" },
];

type Tone = "late" | "soon" | "ok";
const RING: Record<Tone, string> = { late: "ring-danger", soon: "ring-warning", ok: "ring-cat-blue" };
const BLOCK: Record<Tone, CategoryTone> = { late: "coral", soon: "amber", ok: "blue" };

const polar = (deg: number, k: number) => {
  const r = (deg * Math.PI) / 180;
  return { x: 50 + 50 * k * Math.sin(r), y: 50 - 50 * k * Math.cos(r) };
};

function arc(a0: number, a1: number, k0: number, k1: number) {
  // A donut sector in a 100 x 100 box.
  const p = (a: number, k: number) => polar(a, k);
  const large = a1 - a0 > 180 ? 1 : 0;
  const o0 = p(a0, k1);
  const o1 = p(a1, k1);
  const i1 = p(a1, k0);
  const i0 = p(a0, k0);
  return `M${o0.x} ${o0.y} A${50 * k1} ${50 * k1} 0 ${large} 1 ${o1.x} ${o1.y} L${i1.x} ${i1.y} A${50 * k0} ${50 * k0} 0 ${large} 0 ${i0.x} ${i0.y} Z`;
}

export function SlaClock({ rows, meId, now0 }: { rows: QueueRow[]; meId: string; now0: number }) {
  // The same 30s tick as the table's due cells, so a request never shows two different times.
  const ticked = useNow(30_000);
  const now = ticked ?? now0;

  const due = rows.filter((r) => r.dueAt && !["resolved", "closed", "rejected", "pending_approval"].includes(r.status));
  const live = due
    .map((r) => {
      const delta = new Date(r.dueAt!).getTime() - now;
      const tone: Tone = delta < 0 ? "late" : delta <= 2 * H ? "soon" : "ok";
      return { r, delta, tone, angle: angleFor(delta) };
    })
    .sort((a, b) => a.delta - b.delta);

  // Lanes: each request takes the outermost lane where it clears its neighbour by a token's width
  // (measured on a 340px dial, the smallest one we draw).
  // A request that fits no lane joins the token nearest it as "+N", so a busy afternoon reads as
  // one stack with a count, never as avatars piled on each other.
  const lastAngle: number[] = [];
  const lastIdx: number[] = [];
  const placed: Placed[] = [];
  for (const p of live) {
    const lane = LANES.findIndex((k, i) => {
      const gapDeg = (((DOT + 14) / (170 * k)) * 180) / Math.PI;
      return lastAngle[i] === undefined || p.angle - lastAngle[i]! >= gapDeg;
    });
    if (lane === -1) {
      let best = 0;
      for (let i = 1; i < lastIdx.length; i++) if (Math.abs(p.angle - lastAngle[i]!) < Math.abs(p.angle - lastAngle[best]!)) best = i;
      placed[lastIdx[best]!]!.extra.push(p.r);
      continue;
    }
    lastAngle[lane] = p.angle;
    lastIdx[lane] = placed.length;
    placed.push({ ...p, lane, extra: [] });
  }

  const late = live.filter((p) => p.tone === "late").length;
  const soon = live.filter((p) => p.tone === "soon").length;
  const today = live.filter((p) => p.delta >= 0 && p.delta <= 24 * H).length;
  const unassigned = rows.filter((r) => !r.assigneeId && !["resolved", "closed", "rejected", "pending_approval"].includes(r.status)).length;
  const next = live.find((p) => p.delta >= 0);
  const urgent = live.slice(0, 4);

  if (!due.length) return null;

  const light = late ? "red" : soon ? "amber" : "teal";

  return (
    <section aria-labelledby="sla-clock-title" className="relative isolate overflow-hidden rounded-panel panel p-5 sm:p-7 dark:glass">
      <HeroLight tone={light} position="top-left" intensity={late ? "strong" : "normal"} />
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-12">
        <Dial placed={placed} meId={meId} late={late} next={next ? compact(next.delta) : null} />

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 id="sla-clock-title" className="text-hero font-medium text-fg">
              Against the clock
            </h2>
            <p className="text-body text-muted">
              Every open request in this view, placed by when it&apos;s due. Overdue sits in the red quarter, just behind now.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <Kpi label="Overdue" value={late} tone={late ? "danger" : "quiet"} />
            <Kpi label="Next 2 hours" value={soon} tone={soon ? "warning" : "quiet"} />
            <Kpi label="Next 24 hours" value={today} tone="quiet" />
            <Kpi label="Unassigned" value={unassigned} tone="quiet" />
          </dl>
          <div className="flex flex-col gap-3">
            <h3 className="text-row font-medium text-fg">Most urgent</h3>
            <ul className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
              {urgent.map((p) => (
                <li key={p.r.id} className="min-w-0">
                  <CategoryBlock
                    href={`/queue/${p.r.number}`}
                    tone={BLOCK[p.tone]}
                    icon={p.tone === "late" ? <AlarmClock /> : p.tone === "soon" ? <Hourglass /> : <Clock3 />}
                    title={p.r.subject}
                    subtitle={
                      <>
                        <span className="tabular">#{p.r.number}</span> {p.r.requesterName}
                      </>
                    }
                    status={{
                      label: <span suppressHydrationWarning>{p.delta < 0 ? `${compact(-p.delta)} late` : `in ${compact(p.delta)}`}</span>,
                      dot: true,
                    }}
                    aria-label={`#${p.r.number} ${p.r.subject}, ${p.delta < 0 ? `${compact(-p.delta)} overdue` : `due in ${compact(p.delta)}`}`}
                    className="min-w-0"
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

type Placed = { r: QueueRow; delta: number; tone: Tone; angle: number; lane: number; extra: QueueRow[] };

function Dial({ placed, meId, late, next }: { placed: Placed[]; meId: string; late: number; next: string | null }) {
  const reduced = useMotionReduced();
  return (
    <div className="mx-auto w-full max-w-[420px] px-6 py-7 sm:px-8 sm:py-8">
      <div className="relative aspect-square w-full">
        {/* The face: the red quarter behind now, the amber next two hours, quiet lane guides. */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible" aria-hidden>
          <defs>
            <pattern id="sla-hatch" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2.4" height="2.4" fill="var(--lb-danger-soft)" />
              <line x1="0" y1="0" x2="0" y2="2.4" stroke="var(--lb-danger)" strokeOpacity="0.28" strokeWidth="0.7" />
            </pattern>
            <radialGradient id="sla-face" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--lb-surface)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--lb-fg)" stopOpacity="0.06" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="45" fill="var(--lb-raised)" fillOpacity="0.7" />
          <circle cx="50" cy="50" r="45" fill="url(#sla-face)" />
          <path d={arc(-90, 0, HUB, 0.9)} fill="url(#sla-hatch)" />
          <path d={arc(0, 60, HUB, 0.9)} fill="var(--lb-warning-soft)" fillOpacity="0.85" />
          {LANES.map((k) => (
            <circle key={k} cx="50" cy="50" r={50 * k} fill="none" stroke="var(--lb-border)" strokeWidth="0.3" strokeDasharray="0.8 1.2" />
          ))}
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--lb-border-strong)" strokeOpacity="0.6" strokeWidth="0.35" />
          {TICKS.map((t) => {
            const a = angleFor(t.t);
            const p0 = polar(a, 0.86);
            const p1 = polar(a, 0.9);
            return <line key={t.label} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="var(--lb-border-strong)" strokeWidth="0.5" strokeLinecap="round" />;
          })}
        </svg>

        {/* Tick labels outside the face, in HTML so they never drop under 13px on a small dial. */}
        <div aria-hidden className="absolute inset-0 text-caption text-muted">
          {TICKS.map((t) => {
            const p = polar(angleFor(t.t), 1.05);
            return (
              <span
                key={t.label}
                className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                {t.label}
              </span>
            );
          })}
          {/* Inside the red quarter, between the hub and the inner lane, on its own frosted pill. */}
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface/85 px-2 py-0.5 font-medium text-danger-text shadow-cell backdrop-blur-sm"
            style={{ left: `${polar(-45, 0.355).x}%`, top: `${polar(-45, 0.355).y}%` }}
          >
            Late
          </span>
        </div>

        {/* Now: the glowing hand at twelve, with its lit head. */}
        <div aria-hidden className="now-rail absolute left-1/2 w-0.5 -translate-x-1/2" style={{ top: "5%", height: `${45 - 50 * HUB}%` }} />
        <div aria-hidden className="now-dot absolute left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2" style={{ top: "5%" }} />
        <span aria-hidden className="absolute left-1/2 -translate-x-1/2 text-caption font-medium text-now-text" style={{ top: "-7%" }}>
          Now
        </span>

        {/* The hub: what the clock says, in one number. */}
        <div
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full cell text-center"
          style={{ width: `${HUB * 100 - 2}%`, height: `${HUB * 100 - 2}%` }}
        >
          {late ? (
            <>
              <span className="tabular text-h2 font-medium leading-none text-danger-text">
                <CountUp value={late} duration={0.9} delay={0.3} />
              </span>
              <span className="mt-1 text-caption text-muted">overdue</span>
            </>
          ) : next ? (
            <>
              <span className="tabular text-h4 font-medium leading-none text-fg" suppressHydrationWarning>
                {next}
              </span>
              <span className="mt-1 text-caption text-muted">to the next</span>
            </>
          ) : (
            <span className="text-caption text-muted">All clear</span>
          )}
        </div>

        <ul aria-label="Open requests by due time" className="absolute inset-0">
          {placed.map((p, i) => (
            <Token key={p.r.id} p={p} i={i} meId={meId} reduced={reduced} first={i === 0 && p.tone === "late"} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function Token({ p, i, meId, reduced, first }: { p: Placed; i: number; meId: string; reduced: boolean; first: boolean }) {
  const k = LANES[p.lane]!;
  // Each request sweeps round the face from the now hand to where it is due.
  const angle = useMotionValue(reduced ? p.angle : 0);
  const left = useTransform(angle, (a) => `calc(${polar(a, k).x}% - ${DOT / 2}px)`);
  const top = useTransform(angle, (a) => `calc(${polar(a, k).y}% - ${DOT / 2}px)`);
  const ref = React.useRef<HTMLAnchorElement>(null);
  const target = p.angle;
  React.useEffect(() => {
    if (reduced) {
      angle.set(target);
      return;
    }
    const c = animate(angle, target, {
      duration: 1.1,
      delay: 0.2 + i * 0.05,
      ease: EASE_OUT_EXPO,
      onComplete: () => {
        if (first) pulseNode(ref.current, "var(--lb-danger)");
      },
    });
    return () => c.stop();
  }, [angle, target, reduced, i, first]);

  const when = p.delta < 0 ? `${compact(-p.delta)} overdue` : `due in ${compact(p.delta)}`;
  return (
    <motion.li
      className="absolute"
      style={{ left, top }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduced ? 0.2 : 0.5, delay: reduced ? 0 : 0.2 + i * 0.05 }}
    >
      <Tooltip
        label={
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">
              #{p.r.number} {p.r.subject}
            </span>
            <span className="opacity-80" suppressHydrationWarning>
              {p.r.requesterName}, {when}
              {p.r.assigneeName ? `, with ${p.r.assigneeId === meId ? "you" : p.r.assigneeName}` : ", unassigned"}
            </span>
            {p.extra.length ? (
              <span className="opacity-80">
                Also due around then: {p.extra.map((x) => `#${x.number}`).join(", ")}
              </span>
            ) : null}
          </span>
        }
      >
        <Link
          ref={ref}
          href={`/queue/${p.r.number}`}
          aria-label={`#${p.r.number} ${p.r.subject}, ${when}${p.extra.length ? `, and ${p.extra.length} more due around then` : ""}`}
          className={cn("focus-ring press relative block rounded-full ring-2 ring-offset-2 ring-offset-surface", RING[p.tone])}
          style={{ width: DOT, height: DOT }}
        >
          <Avatar name={p.r.requesterName} seed={p.r.requesterId} src={p.r.requesterAvatar} className="size-full" />
          {p.r.priority === "urgent" || p.r.priority === "high" ? (
            <span
              aria-hidden
              className={cn("absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-surface", p.r.priority === "urgent" ? "bg-danger" : "bg-warning")}
            />
          ) : null}
          {p.extra.length ? (
            <span
              aria-hidden
              className="tabular absolute -bottom-2 -right-3 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fg px-1.5 text-[13px] font-medium leading-none text-surface shadow-cell"
            >
              +{p.extra.length}
            </span>
          ) : null}
        </Link>
      </Tooltip>
    </motion.li>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: "danger" | "warning" | "quiet" }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-cell px-3.5 py-2.5",
        tone === "danger" ? "cat-coral" : tone === "warning" ? "cat-amber" : "cell",
      )}
    >
      <dt className={cn("truncate text-caption", tone === "quiet" ? "text-muted" : "")}>{label}</dt>
      <dd className={cn("text-h3 font-medium leading-tight", tone === "quiet" ? "text-fg" : "")}>
        <CountUp value={value} duration={0.9} delay={0.2} />
      </dd>
    </div>
  );
}
