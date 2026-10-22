"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppWindow, ArrowRight, Bot, Cpu, KeyRound, RefreshCcw, Unplug, Users } from "lucide-react";
import { motion } from "motion/react";
import { BrandMark } from "@/components/brand-mark";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedBeam, type BeamTone } from "@/components/ui/effects/animated-beam";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { HeroLight, type LightTone } from "@/components/ui/hero-light";
import { CountUp, EASE_OUT_EXPO, Reveal, RevealItem, useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import styles from "./system-map.module.css";

export type NodeIcon = "sso" | "scim" | "people" | "apps" | "ai" | "worker";
export type NodeTone = "success" | "warning" | "danger" | "neutral";

export interface MapNode {
  key: NodeIcon;
  label: string;
  /** The headline. A number counts up; a word is shown as it is. */
  value: string | number;
  unit?: string;
  detail: string;
  tone: NodeTone;
  status: string;
  href: string;
  /** Set when this connection is something the admin must fix. */
  attention?: string;
  /** The verb on the fix button when this is the first thing that needs the admin. */
  fix?: string;
}

export interface HourBucket {
  /** Hour label, e.g. "14:00". */
  label: string;
  done: number;
  failed: number;
  /** The current, still-running hour. */
  now?: boolean;
}

const ICONS: Record<NodeIcon, React.ComponentType<{ className?: string }>> = {
  sso: KeyRound,
  scim: RefreshCcw,
  people: Users,
  apps: AppWindow,
  ai: Bot,
  worker: Cpu,
};

/** A soft halo in the link's own state colour, so green, coral and off read at arm's length. */
const GLOW: Record<NodeTone, string> = {
  success: "[filter:drop-shadow(0_0_5px_color-mix(in_oklab,var(--lb-cat-green-to)_55%,transparent))]",
  warning: "[filter:drop-shadow(0_0_5px_color-mix(in_oklab,var(--lb-cat-amber-to)_60%,transparent))]",
  danger: "[filter:drop-shadow(0_0_6px_color-mix(in_oklab,var(--lb-cat-coral-to)_65%,transparent))]",
  neutral: "opacity-60",
};
const ROW = ["md:row-start-1", "md:row-start-2", "md:row-start-3"];
const BEAM: Record<NodeTone, BeamTone> = { success: "green", warning: "gold", danger: "coral", neutral: "accent" };

/**
 * The admin overview's hero: the system as a live picture. The company mark sits in the middle and
 * each connection (sign-on, provisioning, people, apps, the assistant, the worker) hangs off it on a
 * connector. Working links are lit in green, a broken one in coral with no spark, an unused one stays
 * a quiet line. On load the links draw out from the hub one by one and the numbers count up; after
 * that one healthy link at a time carries a spark every few seconds, so the picture is visibly alive
 * without ever having more than one moving beam. The page refreshes its data every minute.
 */
export function SystemMap({
  nodes,
  hours,
  completed24h,
  failed24h,
  productName,
  companyName,
  logoUrl,
}: {
  nodes: MapNode[];
  hours: HourBucket[];
  completed24h: number;
  failed24h: number;
  productName: string;
  companyName: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const reduced = useMotionReduced();
  const working = nodes.filter((n) => n.tone === "success").length;
  const needs = nodes.filter((n) => n.attention);
  const first = needs[0];
  const off = nodes.filter((n) => n.tone === "neutral");
  // The light sits on the side of the thing that needs the admin (the hub when all is well).
  const worstAt = nodes.findIndex((n) => n.tone === "danger") >= 0 ? nodes.findIndex((n) => n.tone === "danger") : nodes.findIndex((n) => n.tone === "warning");
  const lightAt = worstAt < 0 ? "center" : worstAt < 3 ? "bottom-left" : "bottom-right";
  const light: LightTone = nodes.some((n) => n.tone === "danger") ? "red" : nodes.some((n) => n.tone === "warning") ? "amber" : "green";

  // Live: re-read the server's numbers every minute while the tab is visible.
  React.useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => window.clearInterval(t);
  }, [router]);

  // The heartbeat: after the draw-on, one lit link at a time carries a spark.
  const lit = React.useMemo(() => nodes.map((n, i) => (n.tone === "success" || n.tone === "warning" ? i : -1)).filter((i) => i >= 0), [nodes]);
  const [beat, setBeat] = React.useState<{ i: number; n: number } | null>(null);
  React.useEffect(() => {
    if (reduced || !lit.length) return;
    let n = 0;
    const start = window.setTimeout(function tick() {
      n += 1;
      setBeat({ i: lit[n % lit.length]!, n });
      timer = window.setTimeout(tick, 3200);
    }, 3600);
    let timer = start;
    return () => window.clearTimeout(timer);
  }, [lit, reduced]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const hubRef = React.useRef<HTMLDivElement>(null);
  const nodeRefs = React.useRef<(HTMLAnchorElement | null)[]>([]);
  const refObjs = React.useMemo(() => nodes.map((_, i) => ({ get current() { return nodeRefs.current[i] ?? null; } }) as React.RefObject<HTMLElement | null>), [nodes]);

  const left = nodes.slice(0, 3);
  const right = nodes.slice(3, 6);
  const max = Math.max(1, ...hours.map((h) => h.done + h.failed));

  return (
    <section aria-labelledby="health-heading" className="relative isolate overflow-hidden rounded-panel panel dark:glass">
      {/* One light source, from the data: red while a link is broken, amber while one is untested, green when all is well. */}
      <HeroLight tone={light} position={lightAt} />
      <div className="flex flex-col gap-8 p-5 sm:p-7">
        {/* The verdict: one line of words beside the worker's last 24 hours. The map below is the lead. */}
        <Reveal stagger={0.07} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:items-end lg:gap-10">
          <RevealItem className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h2 id="health-heading" className="text-hero font-medium text-fg">
                System health
              </h2>
              <span className="inline-flex items-center gap-2 rounded-full bg-raised px-3 py-1 text-caption text-muted shadow-cell">
                <span className={styles.live} aria-hidden />
                Live
              </span>
            </div>
            <p className="max-w-xl text-row text-muted text-pretty">
              <span className="text-fg">
                {working} of {nodes.length} connections working.
              </span>{" "}
              {first ? <>{capitalise(needs.map((n) => n.attention).join(", "))}.</> : "Nothing needs you."}{" "}
              {off.length ? `${off.map((n) => n.label).join(" and ")} ${off.length === 1 ? "is" : "are"} off by choice.` : null}
            </p>
          </RevealItem>

          <RevealItem className="flex flex-col justify-end gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-small text-muted">
                <span className="text-h4 font-medium text-fg">
                  <CountUp value={completed24h} duration={1.2} delay={0.4} />
                </span>{" "}
                jobs in 24 hours
              </p>
              <p className={cn("text-caption", failed24h ? "text-cat-coral-text" : "text-subtle")}>{failed24h ? `${failed24h} failed` : "none failed"}</p>
            </div>
            <div className="flex h-16 items-end gap-[3px]" role="img" aria-label={`Background jobs per hour over the last 24 hours: ${completed24h} done, ${failed24h} failed.`}>
              {hours.map((h, i) => {
                const total = h.done + h.failed;
                return (
                  <motion.span
                    key={h.label}
                    title={`${h.label}: ${h.done} done${h.failed ? `, ${h.failed} failed` : ""}`}
                    className={cn(styles.bar, "flex min-w-0 flex-1 flex-col-reverse overflow-hidden rounded-[3px]")}
                    style={{ height: `${Math.max(6, (total / max) * 100)}%` }}
                    initial={{ scaleY: reduced ? 1 : 0 }}
                    animate={{ scaleY: 1 }}
                    transition={reduced ? { duration: 0 } : { delay: 0.5 + i * 0.025, duration: 0.45, ease: EASE_OUT_EXPO }}
                  >
                    <span className={cn("w-full flex-1", total ? (h.now ? "bg-now" : "bg-cat-green/75 dark:bg-cat-green") : "bg-sunken")} />
                    {h.failed ? <span className="w-full bg-cat-coral" style={{ height: `${(h.failed / total) * 100}%` }} /> : null}
                  </motion.span>
                );
              })}
            </div>
            <div className="flex justify-between text-caption text-subtle" aria-hidden>
              <span>{hours[0]?.label}</span>
              <span>Now</span>
            </div>
          </RevealItem>
        </Reveal>

        {/* The map. */}
        <div ref={containerRef} className="relative min-w-0 rounded-card md:px-2 md:py-4">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_148px_minmax(0,1fr)] md:items-center md:gap-x-20 md:gap-y-4 xl:grid-cols-[minmax(0,300px)_148px_minmax(0,300px)] xl:justify-between xl:gap-x-10">
            {/* Phones: the hub becomes the head of the stack, so the readout survives without the connectors. */}
            <li className="flex items-center gap-4 rounded-card bg-raised/60 p-4 shadow-cell max-md:order-first sm:col-span-2 md:hidden">
              <span className={`${styles.hub} ${styles.hubSm}`}>
                <span className="flex items-baseline font-medium leading-none text-fg">
                  <span className="text-[28px] tracking-[-0.04em]">{working}</span>
                  <span className="text-body text-subtle">/{nodes.length}</span>
                </span>
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-row font-medium text-fg">connections working</span>
                <span className="text-caption text-muted">
                  {needs.length ? `${needs.length} ${needs.length === 1 ? "needs" : "need"} you, shown first` : `${productName} for ${companyName}`}
                </span>
              </span>
            </li>
            <li className="hidden justify-center md:flex md:col-span-1 md:col-start-2 md:row-span-3 md:row-start-1 md:p-0">
              <motion.div
                ref={hubRef}
                className={styles.hub}
                initial={{ scale: reduced ? 1 : 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduced ? { duration: 0.2 } : { duration: 0.7, ease: EASE_OUT_EXPO }}
              >
                <span className={styles.ring} aria-hidden />
                <span className={cn(styles.ring, styles.ring2)} aria-hidden />
                <span className="flex flex-col items-center gap-1">
                  <BrandMark name={companyName} logoUrl={logoUrl} size={26} className="rounded-full shadow-cell" />
                  <span className="flex items-baseline font-medium leading-none text-fg">
                    <CountUp value={working} duration={1.1} delay={0.3} className="text-[40px] tracking-[-0.04em]" />
                    <span className="text-h4 text-subtle">/{nodes.length}</span>
                  </span>
                  <span className="text-caption text-muted">working</span>
                </span>
                <span className="absolute -bottom-10 whitespace-nowrap text-center text-caption text-muted">{productName} for {companyName}</span>
              </motion.div>
            </li>
            {[left, right].map((col, c) =>
              col.map((n, j) => {
                const i = c * 3 + j;
                return (
                  <li key={n.key} className={cn("min-w-0", c === 0 ? "md:col-start-1" : "md:col-start-3", ROW[j], n.attention && "max-md:order-first")}>
                    <NodeCell
                      node={n}
                      index={i}
                      ref={(el) => {
                        nodeRefs.current[i] = el;
                      }}
                      reduced={reduced}
                      beam={n === first}
                    />
                  </li>
                );
              }),
            )}
          </ul>
          {/* Connectors, from the hub out to each node. Hidden on phones, where the nodes are a grid. */}
          {nodes.map((n, i) => {
            const isLeft = i < 3;
            const tone = BEAM[n.tone];
            const on = n.tone !== "neutral";
            if (n.tone === "danger")
              return <BrokenLink key={n.key} containerRef={containerRef} hubRef={hubRef} toRef={refObjs[i]!} isLeft={isLeft} reduced={reduced} delay={0.5 + i * 0.12} />;
            return (
              <React.Fragment key={n.key}>
                <AnimatedBeam
                  className={cn("hidden md:block", GLOW[n.tone])}
                  containerRef={containerRef}
                  fromRef={hubRef as React.RefObject<HTMLElement | null>}
                  toRef={refObjs[i]!}
                  fromAnchor={isLeft ? "left" : "right"}
                  toAnchor={isLeft ? "right" : "left"}
                  direction="forward"
                  shape="s"
                  active={on}
                  tone={tone}
                  width={on ? 2.5 : 1.25}
                  draw="before"
                  drawDuration={0.55}
                  delay={0.5 + i * 0.12}
                  repeat={1}
                />
                {beat && beat.i === i ? (
                  <HeartbeatBeam key={beat.n} containerRef={containerRef} hubRef={hubRef} toRef={refObjs[i]!} isLeft={isLeft} tone={tone} />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type Pt = { x: number; y: number };
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
/** The piece of a cubic between t0 and t1 (de Casteljau, twice). */
function subCubic([a, b, c, d]: Pt[], t0: number, t1: number): Pt[] {
  const split = (p: Pt[], t: number) => {
    const [p0, p1, p2, p3] = p as [Pt, Pt, Pt, Pt];
    const ab = lerp(p0, p1, t), bc = lerp(p1, p2, t), cd = lerp(p2, p3, t);
    const abc = lerp(ab, bc, t), bcd = lerp(bc, cd, t);
    const m = lerp(abc, bcd, t);
    return { left: [p0, ab, abc, m], right: [m, bcd, cd, p3] };
  };
  const head = split([a!, b!, c!, d!], t1).left;
  return split(head, t0 / t1).right;
}
const pathOf = (p: Pt[]) => {
  const f = (n: number) => Math.round(n * 100) / 100;
  const [a, b, c, d] = p as [Pt, Pt, Pt, Pt];
  return `M${f(a.x)},${f(a.y)} C${f(b.x)},${f(b.y)} ${f(c.x)},${f(c.y)} ${f(d.x)},${f(d.y)}`;
};

/**
 * A broken connection, drawn as broken: the coral link leaves the hub lit, SNAPS short of the node
 * (a coral break marker with an unplugged icon sits in the gap), and only a dashed coral stub reaches
 * the node. No spark ever runs on it. Unlike an unused link, which stays a quiet grey line, this one
 * is the loudest line on the map, so the eye goes from the red beam straight to the thing to fix.
 */
function BrokenLink({
  containerRef,
  hubRef,
  toRef,
  isLeft,
  reduced,
  delay,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  hubRef: React.RefObject<HTMLDivElement | null>;
  toRef: React.RefObject<HTMLElement | null>;
  isLeft: boolean;
  reduced: boolean;
  delay: number;
}) {
  const [g, setG] = React.useState<{ live: string; stub: string; gap: Pt; w: number; h: number } | null>(null);
  React.useEffect(() => {
    const update = () => {
      const c = containerRef.current;
      const a = hubRef.current;
      const b = toRef.current;
      if (!c || !a || !b) return;
      const cr = c.getBoundingClientRect();
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const p = { x: (isLeft ? ar.left : ar.right) - cr.left, y: ar.top + ar.height / 2 - cr.top };
      const q = { x: (isLeft ? br.right : br.left) - cr.left, y: br.top + br.height / 2 - cr.top };
      const cx = (p.x + q.x) / 2;
      const curve = [p, { x: cx, y: p.y }, { x: cx, y: q.y }, q];
      const gapAt = subCubic(curve, 0, 0.56)[3]!;
      setG({ live: pathOf(subCubic(curve, 0, 0.47)), stub: pathOf(subCubic(curve, 0.65, 1)), gap: gapAt, w: cr.width, h: cr.height });
    };
    update();
    const ro = new ResizeObserver(update);
    for (const r of [containerRef, hubRef, toRef]) if (r.current) ro.observe(r.current);
    return () => ro.disconnect();
  }, [containerRef, hubRef, toRef, isLeft]);
  if (!g) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
      <svg width={g.w} height={g.h} viewBox={`0 0 ${g.w} ${g.h}`} className="absolute inset-0 overflow-visible">
        <motion.path
          d={g.live}
          fill="none"
          stroke="var(--lb-cat-coral-to)"
          strokeWidth={3}
          strokeLinecap="round"
          className={styles.brokenLive}
          initial={{ pathLength: reduced ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={reduced ? { duration: 0 } : { delay, duration: 0.5, ease: EASE_OUT_EXPO }}
        />
        <motion.path
          d={g.stub}
          fill="none"
          stroke="var(--lb-cat-coral-to)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="3 6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.85 }}
          transition={reduced ? { duration: 0 } : { delay: delay + 0.45, duration: 0.4 }}
        />
      </svg>
      <motion.span
        className={styles.breakMark}
        style={{ left: g.gap.x, top: g.gap.y }}
        initial={{ scale: reduced ? 1 : 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0.2 } : { delay: delay + 0.4, type: "spring", stiffness: 420, damping: 16 }}
      >
        <Unplug className="size-3.5 stroke-[2]" />
      </motion.span>
    </div>
  );
}

/** One spark pass along an already-lit link, mounted fresh for each heartbeat. */
function HeartbeatBeam({
  containerRef,
  hubRef,
  toRef,
  isLeft,
  tone,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  hubRef: React.RefObject<HTMLDivElement | null>;
  toRef: React.RefObject<HTMLElement | null>;
  isLeft: boolean;
  tone: BeamTone;
}) {
  return (
    <AnimatedBeam
      className="hidden md:block"
      containerRef={containerRef}
      fromRef={hubRef as React.RefObject<HTMLElement | null>}
      toRef={toRef}
      fromAnchor={isLeft ? "left" : "right"}
      toAnchor={isLeft ? "right" : "left"}
      shape="s"
      quiet={false}
      draw={false}
      repeat={1}
      duration={1.1}
      width={2}
      tone={tone}
    />
  );
}

const NodeCell = React.forwardRef<
  HTMLAnchorElement,
  { node: MapNode; index: number; reduced: boolean; beam: boolean }
>(function NodeCell({ node: n, index, reduced, beam }, ref) {
  const Icon = ICONS[n.key];
  return (
    <motion.div
      initial={{ opacity: 0, x: reduced ? 0 : index < 3 ? 18 : -18, scale: reduced ? 1 : 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={reduced ? { duration: 0.25 } : { delay: 0.55 + index * 0.12, duration: 0.6, ease: EASE_OUT_EXPO }}
      className="h-full"
    >
      <Wrap
        ref={ref}
        href={n.href}
        action={beam}
        className={cn(
          "focus-ring press relative isolate flex h-full min-h-[96px] flex-col gap-3 rounded-card bg-raised p-3.5 shadow-cell hover:shadow-cell-hover sm:p-4",
          n.tone === "danger" && styles.alarm,
        )}
      >
        {beam ? <BorderBeam settle="none" tone={n.tone === "danger" ? "danger" : "amber"} loops={2} intensity="vivid" delay={1.4} /> : null}
        <SpotlightLayer />
        <span className="flex items-center gap-3">
          <span className={styles.disc} data-tone={n.tone} aria-hidden>
            <Icon className="size-[18px] stroke-[1.75]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-small text-muted">{n.label}</span>
            <span className="flex min-w-0 items-baseline gap-1.5 text-h4 font-medium leading-tight text-fg">
              {typeof n.value === "number" ? <CountUp value={n.value} duration={1} delay={0.7 + index * 0.12} /> : <span className="truncate">{n.value}</span>}
              {n.unit ? <span className="truncate text-small font-normal text-muted">{n.unit}</span> : null}
            </span>
          </span>
        </span>
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="min-w-0 text-caption text-muted">{n.detail}</span>
          <Badge tone={n.tone as BadgeTone} dot size="sm">
            {n.status}
          </Badge>
        </span>
        {beam ? (
          <Button asChild size="sm" className="self-start">
            <Link href={n.href}>
              {n.fix ?? "Fix it"}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </Wrap>
    </motion.div>
  );
});


const capitalise = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** The node is one big link, unless it carries its own fix button: then it is a plain cell around that link. */
const Wrap = React.forwardRef<HTMLAnchorElement, { href: string; action: boolean; className: string; children: React.ReactNode }>(function Wrap(
  { href, action, className, children },
  ref,
) {
  if (action)
    return (
      <div ref={ref as unknown as React.Ref<HTMLDivElement>} className={className.replace("focus-ring press", "")}>
        {children}
      </div>
    );
  return (
    <Link ref={ref} href={href} className={className}>
      {children}
    </Link>
  );
});
