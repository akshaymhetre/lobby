"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { PillNav, PillNavLink } from "./pill-nav";
import { openSection } from "./section-collapse";

export interface SectionSwitcherItem {
  /** The id of a <Section id=...> on the page. */
  id: string;
  label: string;
  count?: number;
}

/**
 * A sticky in-page section switcher for long pages on phones (wave 3, problem 8): the PillNav
 * material as a row of the page's sections. It sticks under the top of the viewport, highlights
 * the section you are reading, and a tap opens a folded <Section collapsible> before scrolling to it.
 *
 *   <SectionSwitcher label="On this page" items={[{ id: "team", label: "Your team", count: 8 }, ...]} />
 *   <Section id="team" title="Your team" collapsible defaultOpen>...</Section>
 *
 * `showOn="mobile"` (default) renders it below md only; `"always"` keeps it on every width.
 */
export function SectionSwitcher({
  items,
  label = "Sections on this page",
  showOn = "mobile",
  className,
}: {
  items: SectionSwitcherItem[];
  label?: string;
  showOn?: "mobile" | "always";
  className?: string;
}) {
  const [active, setActive] = React.useState(items[0]?.id ?? "");

  // Scroll spy: the active section is the last one whose top has passed the switcher.
  React.useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const onScroll = () => {
      let current = els[0]!.id;
      for (const el of els) if (el.getBoundingClientRect().top < 140) current = el.id;
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);

  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    openSection(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Wait a frame so a section that just unfolded has its height.
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", `#${id}`);
    });
    setActive(id);
  };

  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-4 bg-page/85 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6",
        showOn === "mobile" && "md:hidden",
        className,
      )}
    >
      <PillNav label={label} id="section-switcher" size="sm">
        {items.map((i) => (
          <PillNavLink
            key={i.id}
            href={`#${i.id}`}
            active={active === i.id}
            current="location"
            count={i.count}
            countTone="quiet"
            onClick={(e) => go(e, i.id)}
            scroll={false}
          >
            {i.label}
          </PillNavLink>
        ))}
      </PillNav>
    </div>
  );
}
