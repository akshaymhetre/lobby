import * as React from "react";
import { cn } from "@/lib/cn";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[6px] bg-raised px-1.5 shadow-cell",
        "font-sans text-caption font-medium leading-none text-muted",
        className,
      )}
      {...props}
    />
  );
}

/** Renders a key combo like ["⌘", "K"] as adjacent keys. */
export function KbdCombo({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  );
}
