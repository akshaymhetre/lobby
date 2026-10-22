"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { controlBase } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";

export interface ComboOption {
  value: string;
  label: string;
  /** Quiet second line (an email, a count). Also searched. */
  hint?: string;
}

/**
 * A select with a search box, for lists too long to scan (audit G2: "Who" was a plain select of 42 names).
 * The trigger looks like every other control; the list is a Command (cmdk) so arrow keys, type-ahead and
 * Enter work the way a fluent user expects. Picking "all" (the empty value) is the first item.
 */
export function ComboSelect({
  value,
  onValueChange,
  options,
  allLabel = "Any",
  placeholder = "Search",
  className,
  "aria-label": ariaLabel,
  id,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: ComboOption[];
  /** Label of the empty choice at the top of the list. */
  allLabel?: string;
  placeholder?: string;
  className?: string;
  "aria-label": string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);
  const pick = (v: string) => {
    onValueChange(v);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          className={cn(controlBase, "flex h-10 items-center justify-between gap-2 px-3 text-left md:h-9", !current && "text-fg", className)}
        >
          <span className="min-w-0 flex-1 truncate">{current?.label ?? allLabel}</span>
          <ChevronDown className="size-4 shrink-0 stroke-[1.5] text-subtle" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} className="text-body" />
          <CommandList>
            <CommandEmpty className="py-6">No match.</CommandEmpty>
            <CommandItem value="__all" onSelect={() => pick("")} keywords={[allLabel]}>
              <span className="flex-1 truncate">{allLabel}</span>
              {!value ? <Check className="stroke-[2] text-fg" aria-hidden /> : null}
            </CommandItem>
            {options.map((o) => (
              <CommandItem key={o.value} value={o.value} keywords={[o.label, o.hint ?? ""]} onSelect={() => pick(o.value)}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{o.label}</span>
                  {o.hint ? <span className="truncate text-caption text-subtle">{o.hint}</span> : null}
                </span>
                {o.value === value ? <Check className="stroke-[2] text-fg" aria-hidden /> : null}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
