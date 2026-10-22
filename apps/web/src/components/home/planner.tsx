"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight, Banknote, CalendarCheck, CheckCheck, CircleAlert, LifeBuoy, ListChecks, Megaphone, PartyPopper, RotateCw, X, type LucideIcon,
} from "lucide-react";
import type { PlannerBlock, PlannerCategory, PlannerData, PlannerRow } from "@/server/planner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { HeroLight } from "@/components/ui/hero-light";
import { buttonVariants } from "@/components/ui/button-variants";
import { BlurIn, CountUp, Panel3D, Reveal, RevealItem, Words, useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";

const DAY = 86_400_000;
const toUtc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const addDays = (d: string, n: number) => new Date(toUtc(d) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY);
const weekdayOf = (d: string) => new Date(toUtc(d)).getUTCDay();
const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(toUtc(d)));

const LEGEND: { label: string; dot: string }[] = [
  { label: "Onboarding step", dot: "bg-cat-violet" },
  { label: "First day", dot: "bg-cat-green" },
  { label: "Request or approval", dot: "bg-cat-blue" },
  { label: "Acknowledge by", dot: "bg-cat-amber" },
  { label: "Payday", dot: "bg-cat-coral" },
];

/** How many empty cells a point marker may borrow for its label. */
const LABEL_RUN = 6;

export const CATEGORY: Record<PlannerCategory, { label: string; tone: string; dot: string; icon: LucideIcon; soft?: string }> = {
  onboarding: { label: "Onboarding step", tone: "cat-violet", dot: "bg-cat-violet", soft: "bg-cat-violet-soft", icon: ListChecks },
  joiner: { label: "First day", tone: "cat-green", dot: "bg-cat-green", soft: "bg-cat-green-soft", icon: PartyPopper },
  request: { label: "Request due", tone: "cat-blue", dot: "bg-cat-blue", soft: "bg-cat-blue-soft", icon: LifeBuoy },
  approval: { label: "Approval", tone: "cat-blue", dot: "bg-cat-blue", soft: "bg-cat-blue-soft", icon: CheckCheck },
  announcement: { label: "Acknowledge by", tone: "cat-amber", dot: "bg-cat-amber", soft: "bg-cat-amber-soft", icon: Megaphone },
  payday: { label: "Payday", tone: "cat-coral", dot: "bg-cat-coral", soft: "bg-cat-coral-soft", icon: Banknote },
};

/** The people column: name and role at full width, name only when the planner is squeezed. */
const NAME_COL = { full: 200, slim: 140 } as const;
type NameMode = keyof typeof NAME_COL;
const LANE = 48;
const LANE_GAP = 6;
const MIN_CELL = 42;
const GAP = 5;

/**
 * How the grid reflows into the width it has (the assistant panel docks beside Home and takes
 * ~450px). It never clips: it trades the role line for days first, then whole weeks.
 * Three weeks when they fit, then two weeks with a slim people column, then one week (the phone
 * agenda takes over below md).
 */
function useLayout(ref: React.RefObject<HTMLElement | null>, max: number): { days: number; names: NameMode } {
  const [layout, setLayout] = React.useState<{ days: number; names: NameMode }>({ days: max, names: "full" });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth - 48;
      const fits = (names: NameMode) => Math.floor((width - NAME_COL[names]) / (MIN_CELL + GAP));
      const next =
        fits("full") >= max
          ? { days: max, names: "full" as const }
          : fits("slim") >= max
            ? { days: max, names: "slim" as const }
            : fits("full") >= 14
              ? { days: 14, names: "full" as const }
              : fits("slim") >= 14
                ? { days: 14, names: "slim" as const }
                : { days: 7, names: "full" as const };
      setLayout((prev) => (prev.days === next.days && prev.names === next.names ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, max]);
  return layout;
}

/** The same data cut to `days` columns from the start, with blocks clipped to the window. */
function windowed(data: PlannerData, days: number): PlannerData {
  if (days >= data.days) return data;
  const end = addDays(data.start, days - 1);
  const rows = data.rows
    .map((r) => ({ ...r, blocks: r.blocks.filter((b) => b.day <= end).map((b) => (b.endDay > end ? { ...b, endDay: end } : b)) }))
    .filter((r) => r.kind === "me" || r.blocks.length > 0);
  // The count describes what the window shows, not the three weeks behind it.
  const dueCount = rows.reduce((n, r) => n + r.blocks.filter((b) => b.endDay >= data.today).length, 0);
  return { ...data, days, rows, dueCount };
}

/**
 * Blocks that overlap in time go into separate lanes so nothing covers anything. A one-day block
 * (a point) may run its label over the empty cells to its right, up to the next block in its lane.
 */
function lanesFor(
  blocks: PlannerBlock[],
  start: string,
  days: number,
  todayIndex: number,
  captions = true,
): { block: PlannerBlock; lane: number; run: number; side: "right" | "left" }[] {
  const ends: string[] = [];
  const placed = blocks.map((block) => {
    let lane = ends.findIndex((e) => e < block.day);
    if (lane === -1) {
      lane = ends.length;
      ends.push(block.endDay);
    } else ends[lane] = block.endDay;
    return { block, lane, run: 0, side: "right" as "right" | "left" };
  });
  // Free cells to the LEFT of a point in a lane, for a caption that would otherwise clip at the grid's right edge.
  // A caption never crosses the today line: the free run stops at today's column on either side.
  const leftRunFor = (p: (typeof placed)[number], lane: number) => {
    const from = daysBetween(start, p.block.day);
    const prev = placed
      .filter((q) => q !== p && q.lane === lane && q.block.endDay < p.block.day)
      .reduce<number>((max, q) => Math.max(max, daysBetween(start, q.block.endDay)), -1);
    const stop = todayIndex < from ? Math.max(prev, todayIndex) : prev;
    return Math.max(0, Math.min(LABEL_RUN, from - stop - 1));
  };
  const runFor = (p: (typeof placed)[number], lane: number) => {
    const to = daysBetween(start, p.block.endDay);
    const next = placed
      .filter((q) => q !== p && q.lane === lane && q.block.day > p.block.endDay)
      .reduce<number>((min, q) => Math.min(min, daysBetween(start, q.block.day)), days);
    const stop = todayIndex > to ? Math.min(next, todayIndex) : next;
    return Math.max(0, Math.min(LABEL_RUN, stop - to - 1));
  };
  if (!captions) return placed;
  const free = (p: (typeof placed)[number], lane: number) =>
    !placed.some((q) => q !== p && q.lane === lane && q.block.day <= p.block.endDay && q.block.endDay >= p.block.day);
  // A point with no caption room moves to a lane where its caption fits (or a new lane), so a
  // single-day item is never reduced to a bare icon while another lane has space.
  for (const p of placed) {
    if (p.block.day !== p.block.endDay) continue;
    if (runFor(p, p.lane) >= 2) continue;
    const lanes = Math.max(...placed.map((q) => q.lane)) + 1;
    for (let lane = 0; lane <= lanes; lane++) {
      if (lane !== p.lane && free(p, lane) && runFor(p, lane) >= 2) {
        p.lane = lane;
        break;
      }
    }
  }
  for (const p of placed) {
    if (p.block.day !== p.block.endDay) continue;
    const right = runFor(p, p.lane);
    const left = leftRunFor(p, p.lane);
    // Near the right edge the caption reads better on the left; otherwise it runs right.
    if (right < 3 && left > right) {
      p.run = left;
      p.side = "left";
    } else p.run = right;
  }
  return placed;
}

/**
 * The Home hero: "This week" as a planner. Rows are the people the viewer is responsible for
 * (plus a company row), columns are days with a dashed blue today line and hatched non-working
 * days, and the blocks are real obligations in category gradients. Clicking a block opens a
 * detail panel that swings in and builds its content. Under 768px the same data is a day strip
 * with a per-day agenda.
 */
export function Planner({ data: full }: { data: PlannerData }) {
  const [selected, setSelected] = React.useState<PlannerBlock | null>(null);
  const [open, setOpen] = React.useState(false);
  const show = (b: PlannerBlock) => {
    setSelected(b);
    setOpen(true);
  };
  const sectionRef = React.useRef<HTMLElement>(null);
  const layout = useLayout(sectionRef, full.days);
  const data = React.useMemo(() => windowed(full, layout.days), [full, layout.days]);
  const days = Array.from({ length: data.days }, (_, i) => addDays(data.start, i));
  const todayIndex = Math.max(0, Math.min(data.days - 1, daysBetween(data.start, data.today)));
  const total = data.rows.reduce((n, r) => n + r.blocks.length, 0);
  const rangeLabel = `${fmt(data.start, { day: "numeric", month: "short" })} to ${fmt(days[days.length - 1]!, { day: "numeric", month: "short" })}`;

  return (
    <section ref={sectionRef} id="planner" aria-labelledby="planner-heading" className="scroll-mt-24 relative isolate overflow-hidden rounded-panel panel p-4 sm:p-5 md:p-6">
      {/* One light source, the "now" blue of the today rail: the planner is about what is due from today. */}
      <HeroLight tone="blue" position="top" />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-5">
        <div className="min-w-0">
          <h2 id="planner-heading" className="text-h2 font-medium text-fg md:text-hero">
            {data.days <= 7 ? "This week" : data.days <= 14 ? "This week and next" : "The next three weeks"}
          </h2>
          <p className="mt-1 text-body text-muted">
            {total === 0 ? (
              <>Nothing is on the calendar from {rangeLabel}.</>
            ) : (
              <>
                <span className="font-medium tabular text-fg">{data.dueCount}</span> {data.dueCount === 1 ? "thing" : "things"} coming up for you and your people, {rangeLabel}.
              </>
            )}
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-muted" aria-label="Legend">
          {LEGEND.map((k) => (
            <li key={k.label} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", k.dot)} aria-hidden />
              {k.label}
            </li>
          ))}
        </ul>
      </header>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card bg-raised/60 px-6 py-12 text-center">
          <CalendarCheck className="size-6 stroke-[1.5] text-muted" aria-hidden />
          <p className="text-body-lg font-medium text-fg">A clear three weeks</p>
          <p className="max-w-[380px] text-body text-muted">
            Onboarding steps, requests under SLA, approvals, acknowledgement deadlines and payday will land here on the day they are due.
          </p>
          <Link href="/journeys" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Open onboarding
            <ArrowRight aria-hidden />
          </Link>
        </div>
      ) : (
        <>
          <Timeline data={data} days={days} todayIndex={todayIndex} names={layout.names} onSelect={show} />
          <Agenda data={data} days={days} onSelect={show} />
        </>
      )}

      <DetailPanel block={selected} open={open} onOpenChange={setOpen} />
    </section>
  );
}

// ---------------------------------------------------------------- desktop timeline

function Timeline({
  data,
  days,
  todayIndex,
  names,
  onSelect,
}: {
  data: PlannerData;
  days: string[];
  todayIndex: number;
  names: NameMode;
  onSelect: (b: PlannerBlock) => void;
}) {
  const laneRows = data.rows.map((row) => {
    const placed = lanesFor(row.blocks, data.start, data.days, todayIndex, data.days > 7);
    const lanes = Math.max(1, ...placed.map((p) => p.lane + 1));
    return { row, placed, lanes };
  });
  // Grid rows: one header row, then one row per lane of each person row.
  let r = 2;
  const rowStart = laneRows.map(({ lanes }) => {
    const start = r;
    r += lanes;
    return start;
  });
  const lastRow = r;
  const template = `${NAME_COL[names]}px repeat(${data.days}, minmax(${MIN_CELL}px, 1fr))`;

  return (
    <div className="-mx-4 hidden overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:-mx-5 sm:px-5 md:-mx-6 md:block md:px-6" role="region" aria-label="Planner timeline">
      <Reveal
        stagger={0.03}
        delay={0.15}
        className="relative grid"
        style={{ gridTemplateColumns: template, gridAutoRows: `${LANE}px`, rowGap: LANE_GAP, columnGap: GAP }}
        role="grid"
        aria-rowcount={data.rows.length + 1}
      >
        {/* Header: the people column label and one cell per day. */}
        <div className="sticky left-0 z-30 flex items-center bg-surface pr-3 text-small font-medium text-muted" role="columnheader" style={{ gridRow: 1, gridColumn: 1 }}>
          People
        </div>
        {days.map((d, i) => {
          const wd = weekdayOf(d);
          const off = !data.workingDays.includes(wd);
          const today = i === todayIndex;
          return (
            <div
              key={d}
              role="columnheader"
              aria-current={today ? "date" : undefined}
              className={cn(
                "flex flex-col items-center justify-center rounded-cell text-center leading-tight",
                today ? "bg-now text-now-fg shadow-cell" : off ? "bg-sunken text-muted" : "bg-raised text-fg shadow-cell",
              )}
              style={{ gridRow: 1, gridColumn: i + 2 }}
            >
              <span className={cn("text-caption", today ? "text-now-fg/85" : "text-muted")}>{fmt(d, { weekday: "short" })}</span>
              <span className="text-small font-medium tabular-nums">{fmt(d, { day: "numeric" })}</span>
            </div>
          );
        })}

        {laneRows.map(({ row, placed, lanes }, ri) => {
          const start = rowStart[ri]!;
          return (
            <React.Fragment key={row.id}>
              <RevealItem
                from="fade"
                role="rowheader"
                className="sticky left-0 z-30 flex items-center gap-3 rounded-cell bg-raised pl-2 pr-3 shadow-cell"
                style={{ gridRow: `${start} / span ${lanes}`, gridColumn: 1 }}
              >
                {row.kind === "company" ? (
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text" aria-hidden>
                    <Megaphone className="size-4 stroke-[1.75]" />
                  </span>
                ) : (
                  <Avatar name={row.name} seed={row.seed} src={row.avatarUrl} size="lg" className="size-9" />
                )}
                <span className="flex min-w-0 flex-col" title={names === "slim" ? row.name : undefined}>
                  <span className="truncate text-small font-medium text-fg" aria-hidden={names === "slim" || undefined}>
                    {/* Slim column: the company row says who it is for, people go by first name. */}
                    {names === "slim" ? (row.kind === "company" ? "Everyone" : row.name.split(" ")[0]) : row.name}
                  </span>
                  {names === "slim" ? <span className="sr-only">{row.name}</span> : null}
                  {row.subtitle && names === "full" ? <span className="truncate text-caption text-muted">{row.subtitle}</span> : null}
                </span>
              </RevealItem>
              {days.map((d, i) => {
                const off = !data.workingDays.includes(weekdayOf(d));
                return (
                  <div
                    key={d}
                    role="gridcell"
                    className={cn("rounded-cell", off ? "hatch" : i === todayIndex ? "bg-now-soft/70" : "bg-raised/70")}
                    style={{ gridRow: `${start} / span ${lanes}`, gridColumn: i + 2 }}
                  />
                );
              })}
              {placed.map(({ block, lane, run, side }) => {
                const from = Math.max(0, daysBetween(data.start, block.day));
                const to = Math.min(data.days - 1, daysBetween(data.start, block.endDay));
                const span = Math.max(1, to - from + 1);
                const first = side === "left" ? from + 2 - run : from + 2;
                return (
                  <RevealItem
                    key={block.id}
                    from="scale"
                    className={cn("z-20 min-w-0", span === 1 && run > 0 && "grid items-stretch gap-x-1")}
                    style={{
                      gridRow: start + lane,
                      gridColumn: `${first} / span ${span + run}`,
                      gridTemplateColumns: span === 1 && run > 0 ? "subgrid" : undefined,
                    }}
                  >
                    {span === 1 && data.days > 7 ? (
                      <Point block={block} run={run} side={side} onSelect={onSelect} />
                    ) : (
                      <Block block={block} span={span} onSelect={onSelect} labelInside={data.days <= 7} />
                    )}
                  </RevealItem>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* The today line: a lit now-rail through every row, running in the gutter on the leading edge
            of today's column so it never covers today's blocks, with a lit head under the column pill.
            Its glint travels down every few seconds (static under reduced motion). */}
        <div
          aria-hidden
          className="pointer-events-none relative z-[25] -mt-1 w-0.5 -translate-x-[3.5px] justify-self-start"
          style={{ gridRow: `2 / ${lastRow}`, gridColumn: todayIndex + 2 }}
        >
          <span className="now-rail absolute inset-0" />
          <span className="now-dot absolute -top-1.5 left-1/2 size-3 -translate-x-1/2" />
        </div>
      </Reveal>
    </div>
  );
}

function Block({
  block,
  span,
  onSelect,
  compact = false,
  labelInside = false,
}: {
  block: PlannerBlock;
  span: number;
  onSelect: (b: PlannerBlock) => void;
  compact?: boolean;
  /** At the week scale a cell is wide enough for the label inside the chip, even for one day. */
  labelInside?: boolean;
}) {
  const cat = CATEGORY[block.category];
  const Icon = cat.icon;
  const wide = span >= 5;
  const showLabel = span > 1 || labelInside;
  return (
    <button
      type="button"
      onClick={() => onSelect(block)}
      title={`${block.label} · ${block.status.label}`}
      className={cn(
        "focus-ring press group flex w-full min-w-0 items-center gap-2 rounded-cell text-left shadow-cell hover:shadow-cell-hover",
        compact ? "min-h-11 px-2 py-1.5" : "h-full",
        cat.tone,
        compact ? "" : showLabel ? "pl-1.5 pr-1.5" : "justify-center px-1",
      )}
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/25 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] backdrop-blur-sm" aria-hidden>
        <Icon className="size-4 stroke-[1.75]" />
      </span>
      {compact ? (
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="line-clamp-2 text-small font-medium">{block.label}</span>
          <span className="inline-flex items-center gap-1.5 truncate text-caption opacity-90">
            <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
            {block.status.label}
          </span>
        </span>
      ) : showLabel ? (
        // At the week scale a one or two-day block wraps its label to two lines rather than clip it.
        <span className={cn("min-w-0 flex-1 text-small font-medium", span <= 2 ? "line-clamp-2 break-words leading-[17px]" : "truncate")}>{block.label}</span>
      ) : (
        <span className="sr-only">{block.label}</span>
      )}
      {!compact && wide ? (
        <Badge tone="neutral" size="sm" className="shrink-0">
          <span className={cn("size-1.5 rounded-full", toneDot(block.status.tone))} aria-hidden />
          {block.status.label}
        </Badge>
      ) : !compact ? (
        <span className="sr-only">{block.status.label}</span>
      ) : null}
    </button>
  );
}

/**
 * A point: one filled cell on the day it is due, with the title and status running to the right as
 * plain text over the empty cells (never a filled span, which would read as duration).
 */
function Point({ block, run, side = "right", onSelect }: { block: PlannerBlock; run: number; side?: "right" | "left"; onSelect: (b: PlannerBlock) => void }) {
  const cat = CATEGORY[block.category];
  const Icon = cat.icon;
  const caption =
    run > 0 ? (
      // The caption over the empty cells beside the marker. Decorative for assistive tech (the button
      // already names the item); a click on it opens the same panel.
      <span
        aria-hidden
        onClick={() => onSelect(block)}
        // A tinted tab in the category's soft tone, so the caption reads as part of its marker (a label,
        // not a duration: the filled gradient stays on the day itself).
        className={cn(
          // As wide as its words (never the whole free run, which would read as a duration).
          "flex h-full w-fit min-w-0 max-w-full cursor-pointer flex-col justify-center overflow-hidden rounded-cell px-2.5 leading-tight",
          cat.soft,
          side === "left" ? "items-end justify-self-end text-right" : "justify-self-start",
        )}
        style={{ gridColumn: `span ${run}` }}
      >
        <span className="w-full truncate text-small font-medium text-fg">{block.label}</span>
        <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5 text-caption text-fg/75", side === "left" && "flex-row-reverse")}>
          <span className={cn("size-1.5 shrink-0 rounded-full", toneDot(block.status.tone))} />
          <span className="truncate">{block.status.label}</span>
        </span>
      </span>
    ) : null;
  return (
    <>
      {side === "left" ? caption : null}
      <button
        type="button"
        onClick={() => onSelect(block)}
        title={`${block.label} · ${block.status.label}`}
        className={cn("focus-ring press inline-flex h-full w-full min-w-0 items-center justify-center rounded-cell shadow-cell hover:shadow-cell-hover", cat.tone)}
      >
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/25 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]" aria-hidden>
          <Icon className="size-4 stroke-[1.75]" />
        </span>
        <span className="sr-only">
          {block.label}, {block.status.label}
        </span>
      </button>
      {side === "right" ? caption : null}
    </>
  );
}

function toneDot(tone: PlannerBlock["status"]["tone"]) {
  return { neutral: "bg-subtle", success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-info" }[tone];
}

// ---------------------------------------------------------------- phone agenda

function Agenda({ data, days, onSelect }: { data: PlannerData; days: string[]; onSelect: (b: PlannerBlock) => void }) {
  const [day, setDay] = React.useState(data.today);
  const stripRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>("[aria-pressed='true']")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);
  const items = data.rows.flatMap((row) => row.blocks.filter((b) => b.day <= day && b.endDay >= day).map((block) => ({ row, block })));
  const countFor = (d: string) => data.rows.reduce((n, r) => n + r.blocks.filter((b) => b.day <= d && b.endDay >= d).length, 0);
  return (
    <div className="md:hidden">
      <div ref={stripRef} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:-mx-5 sm:px-5" role="group" aria-label="Pick a day">
        {days.map((d) => {
          const active = d === day;
          const today = d === data.today;
          const off = !data.workingDays.includes(weekdayOf(d));
          const n = countFor(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              onClick={() => setDay(d)}
              className={cn(
                "focus-ring press relative flex h-16 w-12 shrink-0 flex-col items-center justify-center rounded-cell leading-tight",
                active ? "bg-now text-now-fg shadow-cell" : today ? "bg-now-soft text-now-text" : off ? "hatch text-muted" : "bg-raised text-fg shadow-cell",
              )}
            >
              <span className={cn("text-caption", active ? "text-now-fg/85" : "text-muted")}>{fmt(d, { weekday: "short" })}</span>
              <span className="text-body font-medium tabular-nums">{fmt(d, { day: "numeric" })}</span>
              {n > 0 ? <span className={cn("mt-0.5 size-1.5 rounded-full", active ? "bg-now-fg" : "bg-accent")} aria-hidden /> : null}
              <span className="sr-only">{n ? `, ${n} items` : ""}</span>
            </button>
          );
        })}
      </div>
      <p className="mb-2 text-small font-medium text-muted">
        {day === data.today ? "Today" : fmt(day, { weekday: "long", day: "numeric", month: "long" })}
        {items.length ? ` · ${items.length}` : ""}
      </p>
      {items.length ? (
        <ul className="flex flex-col gap-2">
          {items.map(({ row, block }) => (
            <li key={block.id} className="flex items-center gap-2">
              {row.kind === "company" ? (
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text" aria-label={row.name}>
                  <Megaphone className="size-4 stroke-[1.75]" aria-hidden />
                </span>
              ) : (
                <Avatar name={row.name} seed={row.seed} src={row.avatarUrl} size="md" />
              )}
              <div className="min-w-0 flex-1">
                <Block block={block} span={3} onSelect={onSelect} compact />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-cell bg-raised/70 px-4 py-6 text-center text-body text-muted">Nothing due on this day.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- detail panel

/**
 * The detail panel. It swings in from the right edge in perspective, arrives as a tinted slab,
 * then its content resolves top to bottom: kicker and title word by word, the summary from blur,
 * the stat tiles counting up, then the facts and the action. A modal dialog, so Escape closes it
 * and focus returns to the block.
 */
function DetailPanel({ block, open, onOpenChange }: { block: PlannerBlock | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const reduced = useMotionReduced();
  const last = React.useRef<PlannerBlock | null>(null);
  if (block) last.current = block;
  const b = block ?? last.current;
  const cat = b ? CATEGORY[b.category] : null;
  const Icon = cat?.icon ?? ListChecks;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && b && cat ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0.2 : 0.3 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <Panel3D
                key={b.id}
                className={cn(
                  "glass fixed z-50 flex flex-col overflow-hidden text-fg outline-none",
                  "inset-x-2 bottom-2 max-h-[88dvh] rounded-panel",
                  "md:bottom-auto md:left-auto md:right-4 md:top-4 md:max-h-[calc(100dvh-2rem)] md:w-[440px]",
                )}
              >
                <div className={cn("relative shrink-0 px-6 pb-6 pt-6", cat.tone)} style={{ borderRadius: "inherit", borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex size-11 items-center justify-center rounded-full bg-white/25 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]" aria-hidden>
                      <Icon className="size-5 stroke-[1.75]" />
                    </span>
                    <DialogPrimitive.Close
                      className="focus-ring touch-target inline-flex size-9 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/35"
                      aria-label="Close"
                    >
                      <X className="size-4 stroke-[1.75]" aria-hidden />
                    </DialogPrimitive.Close>
                  </div>
                  <p className="mt-5 text-small font-medium opacity-90">
                    <Words text={b.panel.kicker} delay={0.18} stagger={0.04} />
                  </p>
                  <DialogPrimitive.Title className="mt-1.5 text-h2 font-medium text-balance">
                    <Words text={b.panel.title} delay={0.26} stagger={0.045} />
                  </DialogPrimitive.Title>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <BlurIn delay={0.4} duration={0.45}>
                    <p className="text-body text-muted text-pretty">{b.panel.summary}</p>
                  </BlurIn>
                  <Reveal stagger={0.06} delay={0.5} className="mt-5 grid grid-cols-2 gap-2">
                    {b.panel.stats.map((st, i) => (
                      <RevealItem key={st.label} from="up" duration={0.4} className={cn("cell rounded-card px-4 py-3", b.panel.stats.length === 1 && "col-span-2")}>
                        <p className="text-caption text-muted">{st.label}</p>
                        <p className="mt-0.5 text-h2 font-medium text-fg">
                          <CountUp value={st.value} duration={0.8} delay={0.55 + i * 0.06} suffix={st.suffix} />
                        </p>
                      </RevealItem>
                    ))}
                  </Reveal>
                  <Reveal stagger={0.06} delay={0.62} className="mt-5">
                    <RevealItem from="fade" duration={0.35}>
                      <dl className="divide-y divide-border">
                        {b.panel.facts.map((f) => (
                          <div key={f.label} className="flex items-baseline justify-between gap-4 py-2.5">
                            <dt className="text-small text-muted">{f.label}</dt>
                            <dd className="text-small font-medium capitalize text-fg">{f.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </RevealItem>
                    <RevealItem from="fade" duration={0.35} className="mt-5">
                      <Link href={b.panel.action.href} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")} onClick={() => onOpenChange(false)}>
                        {b.panel.action.label}
                        <ArrowRight aria-hidden />
                      </Link>
                    </RevealItem>
                  </Reveal>
                </div>
              </Panel3D>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

/**
 * The planner's error state: the header stays, the grid gives way to one plain sentence and a
 * retry. Rendered by Home when the planner query fails, so the rest of the page still works.
 */
export function PlannerError({ onRetry }: { onRetry?: () => void }) {
  const router = useRouter();
  return (
    <section aria-labelledby="planner-heading" className="rounded-panel panel p-4 sm:p-5 md:p-6" role="alert">
      <header className="mb-4 md:mb-5">
        <h2 id="planner-heading" className="text-h2 font-medium text-fg md:text-hero">
          Coming up
        </h2>
        <p className="mt-1 text-body text-muted">Your people and the days their work is due.</p>
      </header>
      <div className="flex flex-col items-center gap-3 rounded-card bg-raised/60 px-6 py-12 text-center">
        <CircleAlert className="size-6 stroke-[1.5] text-danger-text" aria-hidden />
        <p className="text-body-lg font-medium text-fg">The planner could not load</p>
        <p className="max-w-[380px] text-body text-muted">
          Your onboarding steps, requests and deadlines are safe; this view did not come back in time. The rest of Home is working.
        </p>
        <button type="button" onClick={() => (onRetry ? onRetry() : router.refresh())} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <RotateCw aria-hidden />
          Try again
        </button>
      </div>
    </section>
  );
}

export type { PlannerRow };
