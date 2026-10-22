"use client";

import * as React from "react";
import type { OutlineItem } from "@lobby/core/knowledge/doc";
import { cn } from "@/lib/cn";

/** "On this page": follows the reader down the page and highlights the section in view. */
export function TableOfContents({ items }: { items: OutlineItem[] }) {
  const [active, setActive] = React.useState<string | null>(items[0]?.id ?? null);

  React.useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-72px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;
  return (
    <nav aria-label="On this page">
      <p className="mb-2 text-small font-medium text-fg">On this page</p>
      <ul className="flex flex-col border-l border-border">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={cn(
                "focus-ring -ml-px block border-l py-1 text-small leading-[18px] transition-colors duration-120",
                item.level >= 3 ? "pl-6" : "pl-3",
                active === item.id ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
