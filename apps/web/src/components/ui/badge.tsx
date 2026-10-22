import * as React from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "violet" | "green" | "blue" | "amber" | "coral" | "teal";

/*
 * The status pill: a small raised white pill with a coloured dot and a word ("• Approved").
 * `neutral` is the raised pill itself (it sits on category gradients and on panels alike);
 * the semantic and category tones tint the pill softly and colour the dot and the text.
 */
const tones: Record<BadgeTone, { chip: string; dot: string }> = {
  neutral: { chip: "bg-raised text-fg shadow-cell", dot: "bg-subtle" },
  accent: { chip: "bg-accent-soft text-accent-text", dot: "bg-accent" },
  success: { chip: "bg-success-soft text-success-text", dot: "bg-success" },
  warning: { chip: "bg-warning-soft text-warning-text", dot: "bg-warning" },
  danger: { chip: "bg-danger-soft text-danger-text", dot: "bg-danger" },
  info: { chip: "bg-info-soft text-info-text", dot: "bg-info" },
  violet: { chip: "bg-cat-violet-soft text-cat-violet-text", dot: "bg-cat-violet" },
  green: { chip: "bg-cat-green-soft text-cat-green-text", dot: "bg-cat-green" },
  blue: { chip: "bg-cat-blue-soft text-cat-blue-text", dot: "bg-cat-blue" },
  amber: { chip: "bg-cat-amber-soft text-cat-amber-text", dot: "bg-cat-amber" },
  coral: { chip: "bg-cat-coral-soft text-cat-coral-text", dot: "bg-cat-coral" },
  teal: { chip: "bg-cat-teal-soft text-cat-teal-text", dot: "bg-cat-teal" },
};

export interface BadgeProps extends React.ComponentProps<"span"> {
  tone?: BadgeTone;
  /** Leading status dot, so colour is never the only signal (pair it with a word). */
  dot?: boolean;
  /**
   * "md" (24px) is the badge. "sm" (22px) keeps the same 12px type and only trims the height,
   * for a chip inside a 44px row. Type never drops below the 12px caption floor.
   */
  size?: "sm" | "md";
}

export function Badge({ tone = "neutral", dot = false, size = "md", className, children, ...props }: BadgeProps) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium",
        size === "md" ? "h-6 px-2.5 text-caption" : "h-[22px] px-2 text-caption",
        "[&_svg]:size-3 [&_svg]:stroke-[2]",
        t.chip,
        className,
      )}
      {...props}
    >
      {dot ? <span className={cn("size-1.5 shrink-0 rounded-full", t.dot)} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** A removable / selectable chip for filters and tags. */
export function Chip({
  selected = false,
  onRemove,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean; onRemove?: () => void }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-full text-small font-medium transition-[background-color,color,box-shadow,transform] duration-160 ease-standard",
        selected ? "bg-accent-soft text-accent-text shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--lb-accent)_30%,transparent)]" : "cell press text-fg",
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        className={cn("focus-ring touch-target h-full rounded-full", onRemove ? "pl-3 pr-1" : "px-3")}
        {...props}
      >
        {children}
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${typeof children === "string" ? children : "filter"}`}
          className="focus-ring touch-target mr-0.5 inline-flex size-6 items-center justify-center rounded-full opacity-70 hover:bg-hover hover:opacity-100"
        >
          <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}
