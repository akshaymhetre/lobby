"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { controlBase } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/*
 * DateField: a themed date picker that replaces `<Input type="date">`.
 *
 * It posts the same thing a native date input posts: a hidden input carrying `name` with the value
 * as YYYY-MM-DD (or "" when empty), so every existing server action keeps working unchanged.
 *
 *   <Field label="Start date">
 *     <DateField name="startDate" value={form.startDate} onValueChange={(v) => set("startDate", v)} />
 *   </Field>
 *
 * The trigger is a button styled as an input (so <Field> can label it and mark it invalid), the
 * calendar is a Popover: arrows move a day or a week, PageUp/PageDown a month (with Shift, a year),
 * Home/End jump to the start and end of the week, Enter picks, Escape closes and returns focus.
 * Dates are built from components only, never through toISOString, so a day never shifts with the timezone.
 */

export interface DateFieldProps {
  /** Form field name; the hidden input posts the ISO date under it. */
  name?: string;
  id?: string;
  /** Controlled value, YYYY-MM-DD or "". */
  value?: string;
  defaultValue?: string;
  /** Called with YYYY-MM-DD, or "" when cleared. */
  onValueChange?: (iso: string) => void;
  /** Inclusive bounds, YYYY-MM-DD. */
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  /** Shown when empty. */
  placeholder?: string;
  /** Show the clear control when a date is set. */
  clearable?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-required"?: boolean;
}

export function DateField({
  name,
  id,
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  disabled,
  required,
  placeholder = "Pick a date",
  clearable = true,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
}: DateFieldProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const [open, setOpen] = React.useState(false);
  const iso = value ?? internal;
  const parsed = parseIso(iso);

  const commit = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      {name ? <input type="hidden" name={name} value={iso} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-haspopup="dialog"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            aria-required={ariaRequired ?? required ?? undefined}
            data-empty={parsed ? undefined : ""}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && !open) {
                e.preventDefault();
                setOpen(true);
              }
            }}
            className={cn(
              controlBase,
              "flex h-10 items-center gap-2 px-3 text-left md:h-9",
              parsed && clearable && !disabled ? "pr-9" : null,
              !parsed && "text-subtle",
            )}
          >
            <CalendarDays aria-hidden className="size-4 shrink-0 stroke-[1.5] text-subtle" />
            <span className="min-w-0 flex-1 truncate tabular">{parsed ? formatLong(parsed) : placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto min-w-(--radix-popover-trigger-width) p-3"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Calendar
            value={iso}
            min={min}
            max={max}
            autoFocus
            onSelect={(next) => {
              commit(next);
              setOpen(false);
            }}
            onClear={clearable ? () => commit("") : undefined}
          />
        </PopoverContent>
      </Popover>
      {parsed && clearable && !disabled ? (
        <button
          type="button"
          onClick={() => commit("")}
          aria-label="Clear date"
          className="focus-ring absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-[4px] text-subtle transition-colors duration-120 hover:bg-hover hover:text-fg"
        >
          <X aria-hidden className="size-3.5 stroke-[1.75]" />
        </button>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- */

export interface CalendarProps {
  /** Selected date, YYYY-MM-DD or "". */
  value?: string;
  min?: string;
  max?: string;
  onSelect: (iso: string) => void;
  /** Renders a "Clear" action. */
  onClear?: () => void;
  /** Move keyboard focus into the grid on mount (the selected day, else today). */
  autoFocus?: boolean;
  className?: string;
}

const WEEKDAYS = [
  ["Mo", "Monday"],
  ["Tu", "Tuesday"],
  ["We", "Wednesday"],
  ["Th", "Thursday"],
  ["Fr", "Friday"],
  ["Sa", "Saturday"],
  ["Su", "Sunday"],
] as const;

/** A month grid, Monday first, with full keyboard navigation. Used inside DateField; usable on its own. */
export function Calendar({ value = "", min, max, onSelect, onClear, autoFocus = false, className }: CalendarProps) {
  const today = React.useMemo(() => todayParts(), []);
  const selected = parseIso(value);
  const [view, setView] = React.useState<{ y: number; m: number }>(() => {
    const p = selected ?? today;
    return { y: p.y, m: p.m };
  });
  const [focused, setFocused] = React.useState<string>(() => toIso(selected ?? today));
  const pendingFocus = React.useRef(autoFocus);
  const cells = React.useRef(new Map<string, HTMLButtonElement>());
  const labelId = React.useId();

  React.useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    cells.current.get(focused)?.focus();
  }, [focused, view]);

  const minP = parseIso(min ?? "");
  const maxP = parseIso(max ?? "");
  const inRange = (p: Parts) => (!minP || compare(p, minP) >= 0) && (!maxP || compare(p, maxP) <= 0);

  const moveFocus = (next: Parts) => {
    const isoNext = toIso(next);
    pendingFocus.current = true;
    setFocused(isoNext);
    if (next.y !== view.y || next.m !== view.m) setView({ y: next.y, m: next.m });
  };

  const onKeyDown = (e: React.KeyboardEvent, p: Parts) => {
    const key = e.key;
    let next: Parts | null = null;
    if (key === "ArrowLeft") next = addDays(p, -1);
    else if (key === "ArrowRight") next = addDays(p, 1);
    else if (key === "ArrowUp") next = addDays(p, -7);
    else if (key === "ArrowDown") next = addDays(p, 7);
    else if (key === "Home") next = addDays(p, -weekdayIndex(p));
    else if (key === "End") next = addDays(p, 6 - weekdayIndex(p));
    else if (key === "PageUp") next = e.shiftKey ? addMonths(p, -12) : addMonths(p, -1);
    else if (key === "PageDown") next = e.shiftKey ? addMonths(p, 12) : addMonths(p, 1);
    if (!next) return;
    e.preventDefault();
    moveFocus(next);
  };

  const weeks = React.useMemo(() => monthGrid(view.y, view.m), [view]);
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(view.y, view.m - 1, 1));

  return (
    <div className={cn("flex w-full min-w-[272px] flex-col gap-2", className)} data-calendar>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setView(prevMonth(view))}>
          <ChevronLeft />
        </Button>
        <span id={labelId} className="text-body font-medium text-fg" aria-live="polite">
          {monthLabel}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setView(nextMonth(view))}>
          <ChevronRight />
        </Button>
      </div>

      <table role="grid" aria-labelledby={labelId} className="w-full border-separate border-spacing-0.5">
        <thead>
          <tr>
            {WEEKDAYS.map(([short, long]) => (
              <th key={short} scope="col" className="h-8 text-center text-caption font-medium text-subtle">
                <span aria-hidden>{short}</span>
                <span className="sr-only">{long}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((p) => {
                const isoDay = toIso(p);
                const isSelected = selected ? compare(p, selected) === 0 : false;
                const isToday = compare(p, today) === 0;
                const outside = p.m !== view.m;
                const enabled = inRange(p);
                return (
                  <td key={isoDay} role="gridcell" aria-selected={isSelected || undefined} className="p-0">
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) cells.current.set(isoDay, el);
                        else cells.current.delete(isoDay);
                      }}
                      tabIndex={focused === isoDay ? 0 : -1}
                      aria-label={`${formatFull(p)}${isToday ? ", today" : ""}`}
                      aria-disabled={!enabled || undefined}
                      aria-current={isToday ? "date" : undefined}
                      onFocus={() => setFocused(isoDay)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && enabled) {
                          e.preventDefault();
                          onSelect(isoDay);
                          return;
                        }
                        onKeyDown(e, p);
                      }}
                      onClick={() => enabled && onSelect(isoDay)}
                      className={cn(
                        "focus-ring relative inline-flex size-9 items-center justify-center rounded-control text-body tabular transition-colors duration-120 ease-standard",
                        isSelected
                          ? "bg-accent font-medium text-accent-fg hover:bg-accent-hover"
                          : outside
                            ? "text-subtle hover:bg-hover hover:text-fg"
                            : "text-fg hover:bg-hover",
                        isToday && !isSelected && "font-semibold text-accent-text",
                        !enabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
                      )}
                    >
                      {p.d}
                      {isToday && !isSelected ? (
                        <span aria-hidden className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />
                      ) : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between border-t border-border pt-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!inRange(today)}
          onClick={() => {
            onSelect(toIso(today));
          }}
        >
          Today
        </Button>
        {onClear ? (
          <Button variant="ghost" size="sm" disabled={!selected} onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* Date arithmetic on {y, m (1-12), d} parts. Local Date objects are used for arithmetic only, never for output. */

type Parts = { y: number; m: number; d: number };

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function toIso(p: Parts): string {
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function parseIso(s: string): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const p = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  if (p.m < 1 || p.m > 12 || p.d < 1 || p.d > daysInMonth(p.y, p.m)) return null;
  return p;
}

function todayParts(): Parts {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
}

function fromDate(dt: Date): Parts {
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function compare(a: Parts, b: Parts) {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

function addDays(p: Parts, n: number): Parts {
  return fromDate(new Date(p.y, p.m - 1, p.d + n));
}

function addMonths(p: Parts, n: number): Parts {
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m, d: Math.min(p.d, daysInMonth(y, m)) };
}

function prevMonth(v: { y: number; m: number }) {
  return v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 };
}

function nextMonth(v: { y: number; m: number }) {
  return v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 };
}

/** 0 = Monday ... 6 = Sunday. */
function weekdayIndex(p: Parts) {
  return (new Date(p.y, p.m - 1, p.d).getDay() + 6) % 7;
}

/** Six rows of seven days, Monday first, padded with the neighbouring months. */
function monthGrid(y: number, m: number): Parts[][] {
  const first = { y, m, d: 1 };
  const start = addDays(first, -weekdayIndex(first));
  const rows: Parts[][] = [];
  let cursor = start;
  for (let r = 0; r < 6; r++) {
    const row: Parts[] = [];
    for (let c = 0; c < 7; c++) {
      row.push(cursor);
      cursor = addDays(cursor, 1);
    }
    rows.push(row);
  }
  return rows;
}

/** "15 Oct 2026" */
export function formatLong(p: Parts) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(p.y, p.m - 1, p.d));
}

/** "Thursday 15 October 2026" */
function formatFull(p: Parts) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(p.y, p.m - 1, p.d),
  );
}
