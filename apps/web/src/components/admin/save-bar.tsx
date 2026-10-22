"use client";

import * as React from "react";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { cn } from "@/lib/cn";

/**
 * The foot of a settings form. Clean: a quiet right-aligned row. Dirty: the same row becomes a
 * raised bar that sticks to the bottom of the viewport, so the save is never off screen on a long
 * form (audit G3). In v2 the dirty bar is a cell lifted off the page (tone and shadow, no border),
 * with the "Unsaved changes" status at its left and one amber light round it as it appears. Pass the submit button as `children`; `left` is
 * for a skip link or a secondary action.
 */
export function SaveBar({ dirty, left, children, className }: { dirty: boolean; left?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div
      data-dirty={dirty || undefined}
      className={cn(
        "flex flex-col-reverse gap-2 pt-5 transition-[box-shadow,background-color] duration-180 sm:flex-row sm:items-center sm:justify-end",
        dirty
          ? "sticky isolate bottom-20 z-10 -mx-2 rounded-card bg-raised px-4 py-3 shadow-popover md:bottom-4 sm:mx-0"
          : "border-t border-border",
        className,
      )}
    >
      {/* The moment the form turns dirty, one amber light runs round the bar: the save is the thing to look at now. */}
      {dirty ? <BorderBeam settle="none" tone="amber" loops={1} duration={1.6} intensity="subtle" /> : null}
      {dirty ? (
        <p role="status" className="flex items-center gap-2 text-small text-muted sm:mr-auto">
          <span className="size-1.5 rounded-full bg-warning" aria-hidden />
          Unsaved changes
        </p>
      ) : null}
      {left}
      {children}
    </div>
  );
}
