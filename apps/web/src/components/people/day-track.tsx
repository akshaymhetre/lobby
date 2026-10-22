"use client";

import * as React from "react";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { isValidTimezone, isWorkingNow, localTime, parseWorkingHours } from "@lobby/core/people/format";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { AnimatedBeam } from "@/components/ui/effects/animated-beam";
import { cn } from "@/lib/cn";
import { HeroLight } from "@/components/ui/hero-light";
import { offsetMinutes, useMinute } from "./local-time";
import styles from "./day-track.module.css";

/*
 * "Around the clock": the People area's hero material. A day is a track of 24 hours in the
 * READER's time; a zone's working hours sit on it as a band, green while they are working, and
 * the dashed blue line is now. The directory shows every office on one board, the profile shows
 * one person's day, the edit sheet previews your own. Same object everywhere.
 */

const DAY = 24 * 60;
const mod = (n: number, m = DAY) => ((n % m) + m) % m;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekdayIndex(tz: string, now: Date): number {
  const d = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(d);
}

/** "3h 15m", "45m", "14h". */
export function span(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function clock(min: number): string {
  const hh = Math.floor(mod(min) / 60);
  const mm = Math.round(mod(min) % 60);
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"}`;
}

export interface ZoneClock {
  /** Minutes since the reader's midnight. */
  viewerMinute: number;
  /** Minutes since midnight in the zone. */
  zoneMinute: number;
  /** Zone minus reader, in minutes. */
  delta: number;
  /** Working hours of the zone's today, mapped into the reader's day (split when they wrap). */
  segments: { from: number; to: number }[];
  weekend: boolean;
  working: boolean | null;
  /** Minutes left in the working day, while working. */
  left: number | null;
  /** When the next working day starts: minutes from now, and a phrase ("tomorrow", "Monday"). */
  next: { in: number; at: string; day: string | null } | null;
  /** Their working start and end, in the reader's clock ("4:00 pm"). */
  startsForViewer: string | null;
}

export function zoneClock(tz: string | null, hours: string | null, viewerTz: string | null, now: Date): ZoneClock | null {
  const zone = isValidTimezone(tz) ? tz : null;
  if (!zone) return null;
  const viewer = isValidTimezone(viewerTz) ? viewerTz : zone;
  const oz = offsetMinutes(zone, now) ?? 0;
  const ov = offsetMinutes(viewer, now) ?? 0;
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  const zoneMinute = mod(utc + oz);
  const viewerMinute = mod(utc + ov);
  const delta = oz - ov;
  const h = parseWorkingHours(hours);
  const wd = weekdayIndex(zone, now);
  const weekend = wd === 0 || wd === 6;
  const working = isWorkingNow(zone, hours, now);
  const segments: { from: number; to: number }[] = [];
  if (h && !weekend) {
    const len = mod(h.end - h.start) || DAY;
    const from = mod(h.start - delta);
    if (from + len <= DAY) segments.push({ from, to: from + len });
    // A day that wraps past the reader's midnight splits in two; a sliver under 45 minutes is
    // dropped rather than drawn as a stray blob at the far edge of the track.
    else segments.push(...[{ from, to: DAY }, { from: 0, to: from + len - DAY }].filter((g) => g.to - g.from >= 45));
  }
  let left: number | null = null;
  let next: ZoneClock["next"] = null;
  if (h) {
    if (working) left = mod(h.end - zoneMinute);
    else {
      let days = 0;
      let wait = h.start - zoneMinute;
      if (wait <= 0 || weekend) {
        days = 1;
        while ([0, 6].includes((wd + days) % 7)) days++;
        wait = DAY - zoneMinute + (days - 1) * DAY + h.start;
      }
      next = { in: wait, at: clock(h.start), day: days === 0 ? null : days === 1 ? "tomorrow" : (WEEKDAYS[(wd + days) % 7] ?? null) };
    }
  }
  return {
    viewerMinute,
    zoneMinute,
    delta,
    segments,
    weekend,
    working,
    left,
    next,
    startsForViewer: h ? clock(h.start - delta) : null,
  };
}

/** One plain sentence about where someone is in their day. */
export function dayStatus(c: ZoneClock, sameZone: boolean): string {
  if (c.working && c.left !== null) return `Working now, ${span(c.left)} left in the day`;
  if (!c.next) return "Working hours not set";
  const when = c.next.day ? `${c.next.day === "tomorrow" ? "tomorrow" : `on ${c.next.day}`} at ${c.next.at}` : `at ${c.next.at}`;
  if (c.weekend) return `Weekend. Back ${when}${sameZone ? "" : " their time"}`;
  return `Off now. Back ${when}${sameZone ? "" : " their time"}, in ${span(c.next.in)}`;
}

/** The headline on a band that is not working right now. */
function offTitle(c: ZoneClock): string {
  if (!c.next) return "Hours not set";
  if (!c.next.day) return `Starts in ${span(c.next.in)}`;
  return c.next.day === "tomorrow" ? "Back tomorrow" : `Back ${c.next.day}`;
}

const pct = (min: number) => `${(min / DAY) * 100}%`;

// --------------------------------------------------------------------------- the board

export interface ClockZone {
  tz: string;
  /** "London", or "Remote" when the zone is shared by people who list no office. */
  label: string;
  /** Filter link for the zone's main location. */
  href: string | null;
  /** The zone's most common working hours. */
  hours: string | null;
  people: { id: string; name: string; avatarUrl: string | null; workingHours: string | null }[];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const hourLabel = (h: number) => ({ n: h % 12 === 0 ? 12 : h % 12, ap: h < 12 ? "am" : "pm" });

/**
 * The directory hero. Rows are time zones (west to east), columns the reader's 24 hours, and each
 * row's band is that office's working day. Green means they are working right now. The dashed
 * blue line is now, and one spark runs down it once the board has built.
 */
export function ClockBoard({
  zones,
  viewerTimezone,
  everyone,
  viewerPlace,
}: {
  zones: ClockZone[];
  viewerTimezone: string | null;
  everyone: number;
  viewerPlace: string | null;
}) {
  const minute = useMinute();
  const now = new Date(minute * 60_000);
  const nowLineRef = React.useRef<HTMLDivElement>(null);

  const rows = zones
    .map((z) => {
      const c = zoneClock(z.tz, z.hours, viewerTimezone, now);
      const workingNow = z.people.filter((p) => isWorkingNow(z.tz, p.workingHours, now)).length;
      return c ? { z, c, workingNow } : null;
    })
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((a, b) => a.c.delta - b.c.delta);
  if (!rows.length) return null;

  const viewerMinute = rows[0]!.c.viewerMinute;
  const nowHour = Math.floor(viewerMinute / 60);
  const working = rows.reduce((a, r) => a + r.workingNow, 0);
  const placed = rows.reduce((a, r) => a + r.z.people.length, 0);
  const nowLabel = localTime(isValidTimezone(viewerTimezone) ? viewerTimezone : rows[0]!.z.tz, now) ?? clock(viewerMinute);
  const template = "248px repeat(24, minmax(0, 1fr))";

  return (
    <section id="clock" aria-labelledby="clock-heading" className="panel relative isolate flex scroll-mt-24 flex-col gap-5 overflow-hidden rounded-panel p-4 sm:p-5 md:p-6">
      {/* Lit teal: people are working right now. */}
      <HeroLight tone={working ? "teal" : "blue"} position="top-right" />
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="clock-heading" className="text-h2 font-medium text-fg md:text-hero">
            Around the clock
          </h2>
          <p className="mt-1 text-body text-muted" suppressHydrationWarning>
            <span className="tabular font-medium text-fg" suppressHydrationWarning>
              {working}
            </span>{" "}
            of {placed === everyone ? everyone : placed} people are in their working hours.{" "}
            <span className="hidden sm:inline">The hours are your day{viewerPlace ? `, in ${viewerPlace} time` : ""}.</span>
          </p>
        </div>
        <ul className="hidden flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-muted md:flex" aria-label="Legend">
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-cat-green" aria-hidden />
            Working now
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-[3px] bg-raised ring-1 ring-border-strong dark:ring-white/15" aria-hidden />
            Working hours
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className={cn(styles.off, "h-2 w-3 rounded-[3px]")} aria-hidden />
            Off hours
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-3.5 w-[3px] rounded-full bg-now" aria-hidden />
            Now
          </li>
        </ul>
      </header>

      {/* Desktop: the board. */}
      <div className="relative hidden md:grid" style={{ gridTemplateColumns: template, gridAutoRows: "52px", rowGap: 6, columnGap: 3 }} role="table" aria-label="Working hours by office, in your time">
        <div className="flex items-center text-small font-medium text-muted" role="columnheader" style={{ gridRow: 1, gridColumn: 1 }}>
          Office
        </div>
        {HOURS.map((h) => {
          const { n, ap } = hourLabel(h);
          const current = h === nowHour;
          return (
            <div
              key={h}
              aria-hidden
              className={cn(
                "flex flex-col items-center justify-center rounded-cell leading-none",
                current ? "bg-now text-now-fg shadow-cell" : "text-muted",
              )}
              style={{ gridRow: 1, gridColumn: h + 2 }}
            >
              <span className="tabular text-small font-medium">{n}</span>
              <span className={cn("mt-0.5 text-caption leading-none", current ? "text-now-fg/90" : "text-muted")}>{ap}</span>
            </div>
          );
        })}

        {rows.map(({ z, c, workingNow }, ri) => {
          const gridRow = ri + 2;
          const offH = c.delta / 60;
          const offText = offH === 0 ? "you" : `${offH > 0 ? "+" : "-"}${Math.floor(Math.abs(offH))}${Math.abs(offH) % 1 >= 0.5 ? "½" : ""}h`;
          const label = (
            <>
              <AvatarStack people={z.people.map((p) => ({ name: p.name, seed: p.id, src: p.avatarUrl }))} max={3} size="md" className="shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-small font-medium text-fg">{z.label}</span>
                <span className="tabular truncate text-caption text-muted" suppressHydrationWarning>
                  {localTime(z.tz, now)}{offH === 0 ? "" : ` ${offText}`}
                </span>
              </span>
            </>
          );
          return (
            <React.Fragment key={z.tz}>
              <div role="rowheader" style={{ gridRow, gridColumn: 1 }} className="min-w-0">
                {z.href ? (
                  <Link
                    href={z.href}
                    className="focus-ring press flex h-full items-center gap-2.5 rounded-cell bg-raised pl-2 pr-2.5 shadow-cell hover:shadow-cell-hover"
                    aria-label={`${z.label}, ${z.people.length} people. Show them in the directory`}
                  >
                    {label}
                  </Link>
                ) : (
                  <div className="flex h-full items-center gap-2.5 rounded-cell bg-raised pl-2 pr-2.5 shadow-cell">{label}</div>
                )}
              </div>
              {HOURS.map((h) => {
                const mid = h * 60 + 30;
                const inHours = c.segments.some((s) => mid >= s.from && mid < s.to);
                return (
                  <div
                    key={h}
                    aria-hidden
                    className={cn(styles.cells, "rounded-[8px]", inHours ? (h === nowHour ? "bg-now-soft/80" : "bg-raised/80 dark:bg-raised") : styles.off)}
                    style={{ gridRow, gridColumn: h + 2, ["--d" as string]: `${80 + ri * 50}ms` }}
                  />
                );
              })}
              <div role="cell" className="relative z-20 min-w-0" style={{ gridRow, gridColumn: "2 / -1" }}>
                {c.segments.length === 0 ? (
                  <span className="absolute inset-y-1.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-raised px-3 text-caption font-medium text-muted shadow-cell">
                    <Moon className="size-3.5 stroke-[1.75]" aria-hidden />
                    Weekend in {z.label}
                  </span>
                ) : (
                  c.segments.map((s, si) => {
                    const live = !!c.working;
                    const widthMin = s.to - s.from;
                    const roomy = widthMin >= 240;
                    const tiny = widthMin < 90;
                    return (
                      <div
                        key={si}
                        className={cn(
                          styles.band,
                          "absolute inset-y-1 flex min-w-0 items-center gap-2 overflow-hidden rounded-cell",
                          live ? cn("cat-green", styles.live) : "bg-raised text-fg shadow-cell",
                          roomy ? "pl-1.5 pr-2.5" : "justify-center px-1",
                        )}
                        style={{ left: pct(s.from), width: `calc(${pct(widthMin)} - 2px)`, ["--d" as string]: `${260 + ri * 70}ms` }}
                      >
                        {tiny ? null : (
                          <span
                            className={cn(
                              "inline-flex size-8 shrink-0 items-center justify-center rounded-full",
                              live ? "bg-white/25 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]" : "bg-sunken text-muted",
                            )}
                            aria-hidden
                          >
                            {live ? <Sun className="size-4 stroke-[1.75]" /> : <Moon className="size-4 stroke-[1.75]" />}
                          </span>
                        )}
                        {roomy && si === 0 ? (
                          <span className="flex min-w-0 flex-col leading-tight" suppressHydrationWarning>
                            <span className="truncate text-small font-medium">
                              {live ? `${workingNow} working` : offTitle(c)}
                            </span>
                            <span className={cn("truncate text-caption", live ? "opacity-90" : "text-muted")}>
                              {live && c.left !== null ? `${span(c.left)} left in their day` : `Starts ${c.startsForViewer} your time`}
                            </span>
                          </span>
                        ) : (
                          <span className="sr-only">{live ? `${workingNow} working` : "Off now"}</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </React.Fragment>
          );
        })}

        {/* Now: a dashed blue line through every row, placed by the minute inside its hour. */}
        <div aria-hidden className="pointer-events-none relative z-10" style={{ gridRow: `2 / ${rows.length + 2}`, gridColumn: nowHour + 2 }}>
          <div
            ref={nowLineRef}
            className={cn(styles.now, "absolute -top-1.5 bottom-0 w-0.5 -translate-x-1/2")}
            style={{ left: `${((viewerMinute % 60) / 60) * 100}%`, ["--d" as string]: `${200 + rows.length * 70}ms` }}
          >
            {/* The lit rail and its head: now, glowing, with a glint that travels down it. */}
            <span className="now-rail absolute inset-0" />
            <span className="now-dot absolute -top-1 left-1/2 size-2.5 -translate-x-1/2" />
            <AnimatedBeam
              containerRef={nowLineRef}
              fromRef={nowLineRef}
              toRef={nowLineRef}
              fromAnchor="top"
              toAnchor="bottom"
              tone="now"
              quiet={false}
              draw={false}
              repeat={1}
              delay={0.9 + rows.length * 0.07}
              duration={1.2}
              width={1.5}
            />
          </div>
        </div>
      </div>

      {/* Phone: one card per office, each with a slim track of the same day. */}
      <ul className="flex flex-col gap-2 md:hidden" aria-label="Working hours by office, in your time">
        {rows.map(({ z, c, workingNow }, ri) => {
          const live = !!c.working;
          const inner = (
            <>
              <div className="flex items-center gap-2.5">
                <AvatarStack people={z.people.map((p) => ({ name: p.name, seed: p.id, src: p.avatarUrl }))} max={3} size="md" className="shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-small font-medium text-fg">{z.label}</span>
                  <span className="tabular truncate text-caption text-muted" suppressHydrationWarning>
                    {localTime(z.tz, now)}
                  </span>
                </span>
                {live ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cat-green-soft px-2.5 py-1 text-caption font-medium text-cat-green-text" suppressHydrationWarning>
                    <span className={cn(styles.pulse, "size-1.5 rounded-full bg-cat-green text-cat-green")} aria-hidden />
                    {workingNow} working
                  </span>
                ) : (
                  <span className="shrink-0 text-caption text-muted" suppressHydrationWarning>
                    {c.weekend ? "Weekend" : offTitle(c)}
                  </span>
                )}
              </div>
              <MiniTrack c={c} delay={160 + ri * 60} />
            </>
          );
          return (
            <li key={z.tz}>
              {z.href ? (
                <Link href={z.href} className="focus-ring press flex flex-col gap-2.5 rounded-card bg-raised p-3 shadow-cell">
                  {inner}
                </Link>
              ) : (
                <div className="flex flex-col gap-2.5 rounded-card bg-raised p-3 shadow-cell">{inner}</div>
              )}
            </li>
          );
        })}
        <li className="flex justify-between px-1 text-caption text-subtle" aria-hidden>
          <span>12 am</span>
          <span>6 am</span>
          <span>12 pm</span>
          <span>6 pm</span>
          <span>12 am</span>
        </li>
        <li className="sr-only">Now is {nowLabel}.</li>
      </ul>
    </section>
  );
}

/** A slim day track: hatched off hours, the working band (green while working), the now tick. */
function MiniTrack({ c, delay = 0, tall = false, onCell = false }: { c: ZoneClock; delay?: number; tall?: boolean; /** On a raised cell: the off band needs ink, not white. */ onCell?: boolean }) {
  return (
    <div className={cn(styles.off, "relative w-full overflow-hidden rounded-full", tall ? "h-4" : "h-2.5")} aria-hidden>
      {c.segments.map((s, i) => (
        <span
          key={i}
          className={cn(styles.band, "absolute inset-y-0 rounded-full", c.working ? "cat-green" : onCell ? "bg-fg/30 dark:bg-white/35" : "bg-raised shadow-cell")}
          style={{ left: pct(s.from), width: pct(s.to - s.from), ["--d" as string]: `${delay}ms` }}
        />
      ))}
      <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-now" style={{ left: pct(c.viewerMinute) }} />
    </div>
  );
}

/**
 * One person's day, for the profile hero and the edit sheet's preview: the track in the reader's
 * hours with the person's band, a scale, and a sentence ("Working now, 3h 15m left in the day").
 */
export function DayBand({
  timezone,
  workingHours,
  viewerTimezone,
  name,
  avatar,
  className,
}: {
  timezone: string | null;
  workingHours: string | null;
  viewerTimezone: string | null;
  /** Shown as "Your day" when null. */
  name: string | null;
  avatar?: { id: string; name: string; src: string | null };
  className?: string;
}) {
  const minute = useMinute();
  const now = new Date(minute * 60_000);
  const c = zoneClock(timezone, workingHours, viewerTimezone, now);
  const same = !viewerTimezone || viewerTimezone === timezone;
  if (!c) {
    return (
      <div className={cn("flex items-center gap-3 rounded-card bg-raised/70 px-4 py-3 text-small text-muted", className)}>
        <Moon className="size-4 stroke-[1.5] text-subtle" aria-hidden />
        {name ? `${name} has not set a time zone yet.` : "Set your time zone so people know when to reach you."}
      </div>
    );
  }
  const live = !!c.working;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="flex min-w-0 items-center gap-2 text-body text-fg" suppressHydrationWarning>
          <span
            className={cn("relative inline-flex size-2 shrink-0 rounded-full", live ? cn(styles.pulse, "bg-cat-green text-cat-green") : "bg-subtle")}
            aria-hidden
          />
          <span suppressHydrationWarning>{dayStatus(c, same)}</span>
        </p>
        <p className="tabular text-small text-muted" suppressHydrationWarning>
          {same ? (name ? `${name}'s day` : "Your day") : `${name ? `${name}'s day` : "Their day"} in your time`}
          {c.startsForViewer && !same ? `, starting ${c.startsForViewer}` : ""}
        </p>
      </div>
      <div className={cn("relative", avatar && "mt-6")}>
        <div className={cn(styles.off, "@container relative h-11 w-full overflow-hidden rounded-cell")} aria-hidden>
          {/* Now runs behind the band (as on the Home planner) and shows above and below it. */}
          <span
            className={cn(styles.now, "pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2")}
            style={{ left: pct(c.viewerMinute), ["--d" as string]: "620ms" }}
          >
            <span className="now-rail absolute inset-0" />
          </span>
          {c.segments.map((s, i) => (
            <span
              key={i}
              className={cn(
                styles.band,
                "absolute inset-y-1 flex items-center rounded-[9px] px-2",
                live ? cn("cat-green", styles.live) : "bg-raised shadow-cell",
              )}
              style={{ left: `calc(${pct(s.from)} + 2px)`, width: `calc(${pct(s.to - s.from)} - 4px)`, ["--d" as string]: "380ms" }}
            >
              {i === 0 && s.to - s.from >= 300 ? (
                <span className={cn("hidden items-center gap-1.5 truncate text-caption font-medium @[400px]:inline-flex", live ? "" : "text-muted")}>
                  {live ? <Sun className="size-3.5 shrink-0 stroke-[1.75]" /> : <Moon className="size-3.5 shrink-0 stroke-[1.75]" />}
                  {clock(s.from)} to {clock(s.to)}
                </span>
              ) : null}
            </span>
          ))}
        </div>
        {avatar ? (
          <span
            className={cn(styles.now, "pointer-events-none absolute -top-[30px] -translate-x-1/2 rounded-full ring-2 ring-now")}
            style={{ left: pct(c.viewerMinute), ["--d" as string]: "620ms" }}
            aria-hidden
          >
            <Avatar name={avatar.name} seed={avatar.id} src={avatar.src} size="sm" />
          </span>
        ) : null}
      </div>
      <div className="flex justify-between text-caption text-subtle" aria-hidden>
        <span>12 am</span>
        <span>6 am</span>
        <span>12 pm</span>
        <span>6 pm</span>
        <span>12 am</span>
      </div>
    </div>
  );
}

/**
 * A directory cell's trailing day: their local time over a slim track of their working day in the
 * reader's hours (green while they are working, the blue tick is now). The same object as the
 * Around the clock board, one person wide, so every cell says "can I reach them" at a glance.
 */
export function PersonDay({
  timezone,
  workingHours,
  viewerTimezone,
  delay = 0,
  className,
}: {
  timezone: string | null;
  workingHours: string | null;
  viewerTimezone: string | null;
  delay?: number;
  className?: string;
}) {
  const minute = useMinute();
  const now = new Date(minute * 60_000);
  const c = zoneClock(timezone, workingHours, viewerTimezone, now);
  const label = localTime(timezone, now);
  if (!c || !label) return null;
  const h = c.delta / 60;
  const off = h === 0 ? null : `${h > 0 ? "+" : "-"}${Math.floor(Math.abs(h))}${Math.abs(h) % 1 >= 0.5 ? "½" : ""}h`;
  return (
    <span className={cn("flex w-[72px] flex-col items-end gap-1.5 sm:w-[112px] xl:w-[152px]", className)} suppressHydrationWarning>
      <span className="tabular whitespace-nowrap text-caption leading-none" suppressHydrationWarning>
        <span className="font-medium text-fg" suppressHydrationWarning>{label}</span>
        {off ? <span className="ml-1.5 text-muted max-sm:hidden" suppressHydrationWarning>{off}</span> : null}
      </span>
      <MiniTrack c={c} delay={delay} onCell />
      <span className="sr-only">{c.working ? "Working now" : "Outside working hours"}</span>
    </span>
  );
}

export { MiniTrack };
