"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutGroup, SlidingPill } from "@/components/ui/motion";
import { cn } from "@/lib/cn";

export interface ViewTab {
  key: string;
  label: string;
  href: string;
  count?: number;
  /** Tint the count when it carries a warning (breaching soon). */
  tone?: "neutral" | "warning";
}

/**
 * Link tabs in the v2 pill style: a sunken track, the active view on a raised white pill that
 * slides between views. Server pages render the views as links (the URL is the state), so
 * this is the kit's Tabs shape for navigation rather than for in-page panels.
 * On a phone the track scrolls sideways and the right edge fades, so a clipped tab reads as "more".
 */
export function ViewTabs({
  tabs,
  active,
  label,
  className,
}: {
  tabs: ViewTab[];
  active: string;
  label: string;
  className?: string;
}) {
  const id = React.useId();
  return (
    <LayoutGroup id={id}>
      <nav
        aria-label={label}
        className={cn(
          "-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0",
          "max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent)]",
          className,
        )}
      >
        <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-sunken p-1 max-sm:pr-8">
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <Link
                key={t.key}
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "focus-ring touch-target relative isolate inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-body font-medium",
                  "transition-colors duration-160 ease-standard md:h-8 md:px-3",
                  on ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {on ? <SlidingPill layoutId={`${id}-pill`} className="cell rounded-full" /> : null}
                {t.label}
                {typeof t.count === "number" ? (
                  <span
                    className={cn(
                      "tabular rounded-full px-1.5 text-caption",
                      t.tone === "warning" && t.count > 0
                        ? "bg-warning-soft text-warning-text"
                        : on
                          ? "bg-sunken text-fg"
                          : "bg-hover text-muted",
                    )}
                  >
                    {t.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </LayoutGroup>
  );
}

/** A filter chip rendered as a link (the URL is the state). Selected: accent tint. Otherwise: a raised cell. */
export function FilterChipLink({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "focus-ring touch-target press inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-small font-medium",
        selected
          ? "bg-accent-soft text-accent-text shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--lb-accent)_30%,transparent)]"
          : "cell text-muted hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}
