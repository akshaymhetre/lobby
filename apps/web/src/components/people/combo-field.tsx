"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { controlBase } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

/** A searchable single-select (popover + command list) for long option lists. */
export function ComboField({
  id,
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = "Search",
  emptyText = "Nothing matches.",
  allowClear = true,
  clearLabel = "None",
  invalid,
  describedBy,
}: {
  id?: string;
  options: ComboOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowClear?: boolean;
  clearLabel?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlBase, "flex h-10 items-center justify-between gap-2 px-3 text-left md:h-9")}
        >
          <span className={cn("truncate", !selected && "text-subtle")}>{selected ? selected.label : value || placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 stroke-[1.5] text-subtle" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const opt = options.find((o) => o.value === itemValue);
            const hay = `${opt?.label ?? itemValue} ${opt?.hint ?? ""}`.toLowerCase();
            return search
              .toLowerCase()
              .split(/\s+/)
              .every((t) => hay.includes(t))
              ? 1
              : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            {allowClear ? (
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <span className="text-muted">{clearLabel}</span>
                {!value ? <Check className="ml-auto !text-accent-text" aria-hidden /> : null}
              </CommandItem>
            ) : null}
            {options.map((o) => (
              <CommandItem
                key={o.value}
                value={o.value}
                className={o.hint ? "h-auto min-h-10 py-1.5 md:h-auto" : undefined}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{o.label}</span>
                  {o.hint ? <span className="truncate text-caption text-muted">{o.hint}</span> : null}
                </span>
                {o.value === value ? <Check className="ml-auto !text-accent-text" aria-hidden /> : null}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
