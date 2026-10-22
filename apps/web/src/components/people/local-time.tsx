"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { isValidTimezone, isWorkingNow, localTime } from "@lobby/core/people/format";
import { cn } from "@/lib/cn";

function subscribe(cb: () => void) {
  // Tick on the minute boundary, then every minute.
  let interval: ReturnType<typeof setInterval> | undefined;
  const timeout = setTimeout(() => {
    cb();
    interval = setInterval(cb, 60_000);
  }, 60_000 - (Date.now() % 60_000));
  return () => {
    clearTimeout(timeout);
    if (interval) clearInterval(interval);
  };
}
const minute = () => Math.floor(Date.now() / 60_000);

/** The current minute, re-rendering when it changes. */
export function useMinute(): number {
  return React.useSyncExternalStore(subscribe, minute, minute);
}

/** A zone's UTC offset in minutes at `now`, or null for an unknown zone. */
export function offsetMinutes(tz: string | null | undefined, now: Date): number | null {
  if (!isValidTimezone(tz)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - Math.floor(now.getTime() / 60_000) * 60_000) / 60_000);
}

/** Whole hours between two zones right now (positive when `tz` is ahead of `viewerTz`), or null when either is unknown. */
export function hoursApart(tz: string | null | undefined, viewerTz: string | null | undefined, now: Date): number | null {
  const a = offsetMinutes(tz, now);
  const b = offsetMinutes(viewerTz, now);
  if (a === null || b === null) return null;
  return (a - b) / 60;
}

/** "4:12 pm local" for a person's time zone, with an optional "outside working hours" hint. */
export function LocalTime({
  timezone,
  workingHours,
  showIcon = true,
  suffix = "local",
  className,
}: {
  timezone: string | null;
  workingHours?: string | null;
  showIcon?: boolean;
  suffix?: string;
  className?: string;
}) {
  const m = useMinute();
  const now = new Date(m * 60_000);
  const label = localTime(timezone, now);
  if (!label) return null;
  const working = workingHours === undefined ? null : isWorkingNow(timezone, workingHours, now);
  return (
    <span className={cn("tabular inline-flex items-center gap-1.5", className)} suppressHydrationWarning>
      {showIcon ? <Clock className="size-3.5 shrink-0 stroke-[1.5] text-subtle" aria-hidden /> : null}
      <span suppressHydrationWarning>
        {suffix ? `${label} ${suffix}` : label}
      </span>
      {working === false ? <span className="text-subtle" suppressHydrationWarning>· outside hours</span> : null}
    </span>
  );
}

/**
 * The directory's local time: shown only when the person is more than an hour away from the viewer,
 * so a column of forty identical "5:41 pm local" strings never happens (audit C3).
 * Renders "10:11 pm" plus a quiet "+4½h" so the reader knows which way the gap goes.
 */
export function RelativeLocalTime({
  timezone,
  viewerTimezone,
  always = false,
  className,
}: {
  timezone: string | null;
  viewerTimezone: string | null;
  /** Show the time even when they share (or nearly share) the reader's clock. */
  always?: boolean;
  className?: string;
}) {
  const m = useMinute();
  const now = new Date(m * 60_000);
  const apart = hoursApart(timezone, viewerTimezone, now);
  const label = localTime(timezone, now);
  if (apart === null || !label || (!always && Math.abs(apart) <= 1)) return null;
  const sign = apart > 0 ? "+" : "-";
  const whole = Math.floor(Math.abs(apart));
  const half = Math.abs(apart) % 1 >= 0.5 ? "½" : "";
  return (
    <span className={cn("tabular inline-flex items-baseline gap-1.5 whitespace-nowrap", className)} suppressHydrationWarning>
      <span className="md:w-[60px] md:text-right" suppressHydrationWarning>{label}</span>
      {apart === 0 ? (
        <span className="hidden md:inline-block md:w-[34px]" aria-hidden />
      ) : (
        <span className="text-muted md:w-[34px]" suppressHydrationWarning>
          {sign}
          {whole}
          {half}h
        </span>
      )}
    </span>
  );
}
