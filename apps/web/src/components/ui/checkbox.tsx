"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "focus-ring touch-target peer inline-flex size-4 shrink-0 items-center justify-center rounded-[4px]",
        "border border-control-border bg-raised transition-colors duration-120 ease-standard dark:bg-sunken",
        "hover:border-fg/60",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg",
        "data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-accent-fg",
        "disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="group inline-flex items-center justify-center">
        <Check className="size-3 stroke-[3] group-data-[state=indeterminate]:hidden" aria-hidden />
        <Minus className="hidden size-3 stroke-[3] group-data-[state=indeterminate]:block" aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
