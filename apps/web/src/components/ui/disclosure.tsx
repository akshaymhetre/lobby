import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A collapsible section with the kit's chevron instead of the browser's marker.
 *
 * Built on native <details>/<summary>, so it needs no client JavaScript, works in server components,
 * and is keyboard accessible for free: the summary is focusable, Enter and Space toggle it, and
 * assistive technology announces the expanded state. Several Disclosures sharing a `name` behave as
 * an accordion (only one open at a time).
 *
 *   <Disclosure title="Development: sign in as a demo user">...</Disclosure>
 *   <Disclosure variant="card" title="Advanced settings" defaultOpen>...</Disclosure>
 */
export interface DisclosureProps extends Omit<React.ComponentProps<"details">, "title"> {
  /** The summary line. A string, or any inline content. */
  title: React.ReactNode;
  /** Right-aligned element on the summary row (a count, a Badge). */
  aside?: React.ReactNode;
  /** "plain": a bare row with a hairline above and below. "card": a bordered surface. "inline": no lines, for short asides. */
  variant?: "plain" | "card" | "inline";
  defaultOpen?: boolean;
  /** Extra classes for the content area. */
  contentClassName?: string;
  /** Extra classes for the summary row. */
  summaryClassName?: string;
}

export function Disclosure({
  title,
  aside,
  variant = "plain",
  defaultOpen,
  className,
  contentClassName,
  summaryClassName,
  children,
  open,
  ...props
}: DisclosureProps) {
  return (
    <details
      className={cn(
        "group min-w-0",
        variant === "plain" && "border-y border-border",
        variant === "card" && "rounded-card border border-border bg-surface dark:bg-raised",
        className,
      )}
      open={open ?? defaultOpen ?? undefined}
      {...props}
    >
      <summary
        className={cn(
          "focus-ring flex min-h-11 cursor-pointer select-none list-none items-center gap-2 text-body font-medium text-fg",
          "transition-colors duration-120 ease-standard [&::-webkit-details-marker]:hidden",
          variant === "card" ? "rounded-card px-4 hover:bg-hover group-open:rounded-b-none" : "rounded-control",
          variant === "plain" && "px-1 hover:bg-hover",
          variant === "inline" && "min-h-9 px-1 text-small text-muted hover:text-fg",
          summaryClassName,
        )}
      >
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 stroke-[1.75] text-subtle transition-transform duration-120 ease-standard group-open:rotate-90 motion-reduce:transition-none"
        />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {aside ? <span className="ml-auto shrink-0 text-small font-normal text-muted">{aside}</span> : null}
      </summary>
      <div
        className={cn(
          variant === "card" ? "border-t border-border px-4 py-4" : variant === "plain" ? "px-1 pb-4 pt-1" : "pb-3 pt-1 pl-7",
          contentClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}
