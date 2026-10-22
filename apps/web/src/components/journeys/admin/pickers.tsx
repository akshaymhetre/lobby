"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { describeOffset, offsetToParts, partsToOffset, type JourneyKind, type OffsetParts } from "@lobby/core/journeys/dates";
import { Avatar } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { controlBase, Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/cn";

/** Pick several values from a searchable list; selected values show as removable chips. */
export function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  emptyLabel = "Nothing found.",
}: {
  id?: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className={cn(controlBase, "flex h-10 items-center justify-between gap-2 px-3 text-left md:h-9")}
            aria-haspopup="listbox"
          >
            <span className={cn("truncate", value.length ? "text-fg" : "text-subtle")}>
              {value.length ? `${value.length} selected` : placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 stroke-[1.5] text-subtle" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0">
          <Command loop>
            <CommandInput placeholder="Search" />
            <CommandList className="max-h-[260px]">
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const on = value.includes(o.value);
                  return (
                    <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)} aria-selected={on}>
                      <span
                        className={cn(
                          "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                          on ? "border-accent bg-accent text-accent-fg" : "border-control-border",
                        )}
                        aria-hidden
                      >
                        {on ? <Check className="!size-3 !text-accent-fg stroke-[3]" /> : null}
                      </span>
                      <span className="truncate">{o.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected">
          {value.map((v) => (
            <li key={v}>
              <span className="cell inline-flex h-7 items-center gap-1 rounded-full pl-2.5 pr-1 text-small font-medium text-fg">
                {labelOf(v)}
                <button
                  type="button"
                  onClick={() => toggle(v)}
                  className="focus-ring touch-target inline-flex size-5 items-center justify-center rounded-full hover:bg-hover"
                  aria-label={`Remove ${labelOf(v)}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface PersonOption {
  id: string;
  name: string;
  title: string | null;
  department?: string | null;
  avatarUrl: string | null;
}

/** Pick one person from a searchable list. */
export function PersonSelect({
  id,
  people,
  value,
  onChange,
  placeholder = "Choose a person",
  allowClear = false,
  clearLabel = "Nobody",
  invalid,
}: {
  id?: string;
  people: PersonOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  clearLabel?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const current = people.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-invalid={invalid || undefined}
          className={cn(controlBase, "flex h-10 items-center justify-between gap-2 px-3 text-left md:h-9")}
        >
          {current ? (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={current.name} seed={current.id} src={current.avatarUrl} size="xs" />
              <span className="truncate text-fg">{current.name}</span>
            </span>
          ) : (
            <span className="truncate text-subtle">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 stroke-[1.5] text-subtle" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0">
        <Command loop>
          <CommandInput placeholder="Search people" />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>Nobody by that name.</CommandEmpty>
            <CommandGroup>
              {allowClear ? (
                <CommandItem
                  value={`__clear ${clearLabel}`}
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <span className="text-muted">{clearLabel}</span>
                </CommandItem>
              ) : null}
              {people.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.title ?? ""} ${p.department ?? ""}`}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Avatar name={p.name} seed={p.id} src={p.avatarUrl} size="xs" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{p.name}</span>
                    {p.title ? <span className="truncate text-caption text-muted">{p.title}</span> : null}
                  </span>
                  {p.id === value ? <Check className="!text-accent-text" aria-hidden /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * When a step is due, as a person would say it: "[3] [days] [before start]", "On day 1",
 * "[2] [weeks] [after start]". Shows the plain-language result underneath.
 */
export function OffsetInput({ id, value, onChange, kind }: { id?: string; value: number; onChange: (v: number) => void; kind: JourneyKind }) {
  const [parts, setParts] = React.useState<OffsetParts>(() => offsetToParts(value));
  React.useEffect(() => {
    if (partsToOffset(parts) !== value) setParts(offsetToParts(value));
  }, [value, parts]);
  const update = (patch: Partial<OffsetParts>) => {
    const next = { ...parts, ...patch };
    if (patch.direction && patch.direction !== "on" && next.amount === 0) next.amount = 1;
    setParts(next);
    onChange(partsToOffset(next));
  };
  const anchor = kind === "offboarding" ? "the last day" : "start";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {parts.direction !== "on" ? (
          <>
            <Input
              type="number"
              min={1}
              max={parts.unit === "weeks" ? 52 : 365}
              value={parts.amount}
              onChange={(e) => update({ amount: Math.max(0, Number(e.target.value) || 0) })}
              aria-label="How many"
              className="w-20"
            />
            <Select value={parts.unit} onValueChange={(v) => update({ unit: v as OffsetParts["unit"] })}>
              <SelectTrigger aria-label="Days or weeks" className="w-[104px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days">{parts.amount === 1 ? "day" : "days"}</SelectItem>
                <SelectItem value="weeks">{parts.amount === 1 ? "week" : "weeks"}</SelectItem>
              </SelectContent>
            </Select>
          </>
        ) : null}
        <Select value={parts.direction} onValueChange={(v) => update({ direction: v as OffsetParts["direction"] })}>
          <SelectTrigger id={id} aria-label="Before or after" className="min-w-[160px] flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="before">before {anchor}</SelectItem>
            <SelectItem value="on">{kind === "offboarding" ? "on the last day" : "on day 1"}</SelectItem>
            <SelectItem value="after">{kind === "offboarding" ? "after leaving" : "after start"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-small text-muted">Shown as: {describeOffset(value, kind)}</p>
    </div>
  );
}
