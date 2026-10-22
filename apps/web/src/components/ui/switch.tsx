"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";

export function Switch({
  className,
  size = "md",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & { size?: "sm" | "md" }) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "focus-ring touch-target peer inline-flex shrink-0 items-center rounded-full p-0.5",
        "bg-control-border transition-colors duration-120 ease-standard",
        "hover:bg-[color-mix(in_srgb,var(--lb-control-border),var(--lb-fg)_15%)]",
        "data-[state=checked]:bg-accent data-[state=checked]:hover:bg-accent-hover",
        "disabled:opacity-50",
        size === "md" ? "h-5 w-9" : "h-4 w-7",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]",
          "transition-transform duration-120 ease-standard data-[state=unchecked]:translate-x-0",
          size === "md" ? "size-4 data-[state=checked]:translate-x-4" : "size-3 data-[state=checked]:translate-x-3",
          "dark:data-[state=unchecked]:bg-[#d8d5ce]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
