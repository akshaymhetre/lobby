"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutGroup, SlidingPill } from "@/components/ui/motion";
import { cn } from "@/lib/cn";

/**
 * URL-driven pill tabs, in the v2 top-bar language: a sunken track, the active tab a raised white
 * pill that slides to the new tab. Each view keeps its own address, so the browser's back button
 * and a shared link both land on the right tab.
 * On a phone the track scrolls sideways; while anything is clipped on the right, the edge fades
 * (a 48px mask) so the cut-off tab reads as "more", and the fade goes once you reach the end.
 */
export function TabLinks({
  tabs,
  active,
  label,
  className,
}: {
  tabs: { key: string; label: string; href: string; count?: number }[];
  active: string;
  label: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLElement>(null);
  const id = React.useId();
  const [clipped, setClipped] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setClipped(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [tabs.length]);

  return (
    <nav
      ref={ref}
      aria-label={label}
      className={cn(
        "flex max-w-full items-center gap-1 self-start overflow-x-auto rounded-full bg-sunken p-1 [scrollbar-width:none]",
        clipped && "[mask-image:linear-gradient(to_right,black_calc(100%-48px),transparent)]",
        className,
      )}
    >
      <LayoutGroup id={id}>
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "group focus-ring relative isolate inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-body font-medium",
                "transition-colors duration-160 ease-standard md:h-8 md:px-3.5",
                on ? "text-fg" : "text-muted hover:text-fg",
              )}
            >
              {on ? <SlidingPill layoutId={`${id}-pill`} className="cell rounded-full" /> : null}
              {t.label}
              {t.count ? (
                <span className={cn("tabular rounded-full px-1.5 text-caption", on ? "bg-sunken text-fg" : "bg-hover text-muted")}>
                  {t.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </LayoutGroup>
    </nav>
  );
}
