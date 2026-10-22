import * as React from "react";
import { cn } from "@/lib/cn";

export type EmptyStateVariant = "first-run" | "filtered" | "error";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The one action that makes content appear. */
  action?: React.ReactNode;
  /** Optional quieter second action (e.g. "Learn how"). */
  secondary?: React.ReactNode;
  variant?: EmptyStateVariant;
  /** Compact fits inside a card or table; default fills a page region. */
  compact?: boolean;
  /**
   * Draw the dashed frame. Only for a region that accepts a drop (a CSV import, an upload).
   * Everywhere else the empty state is frameless: it sits in the space the content will fill,
   * or inside the list's own Card.
   */
  dropzone?: boolean;
  className?: string;
}

/* A bare icon in a quiet tone. No tinted tile: icon tiles are the one element that reads "template". */
const iconTone: Record<EmptyStateVariant, string> = {
  "first-run": "text-muted",
  filtered: "text-subtle",
  error: "text-danger-text",
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondary,
  variant = "first-run",
  compact = false,
  dropzone = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      className={cn(
        "flex h-full flex-col items-center justify-center text-center",
        compact ? "gap-3 px-6 py-8" : "gap-4 px-6 py-14",
        dropzone && "rounded-card border border-dashed border-border-strong",
        className,
      )}
    >
      {icon ? (
        <div
          className={cn("inline-flex [&_svg]:stroke-[1.5]", compact ? "[&_svg]:size-5" : "[&_svg]:size-6", iconTone[variant])}
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      <div className="flex max-w-[380px] flex-col gap-1">
        <h3 className={cn("font-medium text-fg", compact ? "text-body" : "text-body-lg")}>{title}</h3>
        {description ? <p className="text-body text-muted text-pretty">{description}</p> : null}
      </div>
      {action || secondary ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      ) : null}
    </div>
  );
}
