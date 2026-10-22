"use client";

import * as React from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/cn";
import { LayoutGroup, SlidingPill } from "./motion";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

/** A sunken track with one raised pill that slides to the chosen segment. */
export function SegmentedControl({
  options,
  value,
  onValueChange,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  options: SegmentedOption[];
  value: string;
  onValueChange: (v: string) => void;
  size?: "sm" | "md";
  className?: string;
  "aria-label": string;
}) {
  const id = React.useId();
  return (
    <LayoutGroup id={id}>
      <ToggleGroup.Root
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onValueChange(v);
        }}
        aria-label={ariaLabel}
        className={cn("inline-flex items-center gap-0.5 rounded-full bg-sunken p-1", className)}
      >
        {options.map((o) => (
          <ToggleGroup.Item
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            className={cn(
              "focus-ring touch-target relative isolate inline-flex items-center justify-center gap-1.5 rounded-full px-3 font-medium text-muted",
              "transition-colors duration-160 ease-standard hover:text-fg data-[state=on]:text-fg",
              "disabled:opacity-50 [&_svg]:size-4 [&_svg]:stroke-[1.75]",
              size === "md" ? "h-8 text-body md:h-7" : "h-7 text-small md:h-6 md:px-2.5",
            )}
          >
            {o.value === value ? <SlidingPill layoutId={`${id}-pill`} className="cell rounded-full" /> : null}
            {o.icon}
            {o.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </LayoutGroup>
  );
}
