"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A like. Unpressed: a muted outline heart. Pressed: the heart fills in the reaction tone
 * (`--lb-reaction`, a muted clay) and the count turns medium weight. Never danger red, never the accent:
 * accent means "something for you" and red means something is wrong.
 *
 *   <ReactionButton pressed={liked} count={12} onClick={toggle} />
 *
 * The count is tabular so a column of posts lines up. `label` is the accessible name ("Like");
 * the pressed state is announced through aria-pressed.
 */
export interface ReactionButtonProps extends Omit<React.ComponentProps<"button">, "children"> {
  pressed: boolean;
  count?: number;
  /** Accessible name. The count is appended for screen readers. */
  label?: string;
  icon?: React.ReactNode;
  size?: "sm" | "md";
}

export function ReactionButton({ pressed, count, label = "Like", icon, size = "md", className, ...props }: ReactionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={typeof count === "number" ? `${label}, ${count}` : label}
      data-press
      className={cn(
        "focus-ring touch-target group inline-flex shrink-0 select-none items-center gap-1.5 rounded-control font-medium",
        "transition-[color,background-color,transform] duration-120 ease-standard active:scale-[0.96]",
        size === "md" ? "h-8 px-2 text-small" : "h-7 px-1.5 text-caption",
        pressed ? "text-reaction hover:bg-reaction-soft" : "text-muted hover:bg-hover hover:text-fg",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex [&_svg]:stroke-[1.75] transition-transform duration-120 ease-standard group-active:scale-90",
          size === "md" ? "[&_svg]:size-4" : "[&_svg]:size-3.5",
          pressed && "[&_svg]:fill-current",
        )}
      >
        {icon ?? <Heart />}
      </span>
      {typeof count === "number" ? <span className="tabular">{count}</span> : null}
    </button>
  );
}
