"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";

export function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn("grid gap-2.5", className)} {...props} />;
}

export function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        "focus-ring touch-target peer inline-flex size-4 shrink-0 items-center justify-center rounded-full",
        "border border-control-border bg-surface shadow-lift transition-colors duration-120 ease-standard dark:bg-sunken",
        "hover:border-fg/60",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="block size-1.5 rounded-full bg-accent-fg" />
    </RadioGroupPrimitive.Item>
  );
}
