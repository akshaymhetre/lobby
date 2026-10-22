"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Phone-only folding for <Section collapsible>. The open state lives in a tiny per-section store
 * keyed by the section id, so the toggle (inside the heading) and the body (below it) agree, and so
 * <SectionSwitcher> can open a folded section before scrolling to it (`openSection(id)`).
 * From md up both render as if open: the toggle is hidden and the body is never hidden.
 */
type Listener = (open: boolean) => void;
const state = new Map<string, boolean>();
const listeners = new Map<string, Set<Listener>>();

function set(id: string, open: boolean) {
  state.set(id, open);
  listeners.get(id)?.forEach((l) => l(open));
}

/** Opens a collapsible section by id (no-op for a section that is not collapsible). */
export function openSection(id: string) {
  if (state.has(id)) set(id, true);
}

function useSectionOpen(id: string, defaultOpen: boolean): [boolean, (open: boolean) => void] {
  const [open, setOpen] = React.useState(() => state.get(id) ?? defaultOpen);
  React.useEffect(() => {
    if (!state.has(id)) state.set(id, defaultOpen);
    let ls = listeners.get(id);
    if (!ls) listeners.set(id, (ls = new Set()));
    ls.add(setOpen);
    setOpen(state.get(id)!);
    return () => {
      ls!.delete(setOpen);
    };
  }, [id, defaultOpen]);
  return [open, (v) => set(id, v)];
}

export function CollapsibleSectionToggle({
  sectionId,
  bodyId,
  defaultOpen,
  summary,
  label,
}: {
  sectionId: string;
  bodyId: string;
  defaultOpen: boolean;
  summary?: React.ReactNode;
  label: React.ReactNode;
}) {
  const [open, setOpen] = useSectionOpen(sectionId, defaultOpen);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
        // The whole heading row is the target on a phone: the button stretches over it.
        className="focus-ring absolute -inset-1 z-10 rounded-card md:hidden"
      >
        <span className="sr-only">
          {open ? "Hide" : "Show"} {typeof label === "string" ? label : "section"}
        </span>
        <span aria-hidden className="pointer-events-none absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-raised text-muted shadow-cell">
          <ChevronDown className={cn("size-[18px] stroke-[1.75] transition-transform duration-160 ease-standard", open && "rotate-180")} />
        </span>
      </button>
      {summary && !open ? <p className="text-small text-muted md:hidden">{summary}</p> : null}
    </>
  );
}

export function CollapsibleSectionBody({
  sectionId,
  bodyId,
  defaultOpen,
  children,
}: {
  sectionId: string;
  bodyId: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open] = useSectionOpen(sectionId, defaultOpen);
  return (
    <div id={bodyId} className={cn("min-w-0", open ? "max-md:pt-4" : "max-md:hidden")}>
      {children}
    </div>
  );
}
