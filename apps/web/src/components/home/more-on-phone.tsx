"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Phones only: holds the rest of a list behind one "Show N more" button so Home stays a short,
 * sectioned page. From md up the children always show and the button is not rendered.
 */
export function MoreOnPhone({ count, noun, children, className }: { count: number; noun: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  if (count <= 0) return null;
  return (
    <>
      <div id={id} className={cn(open ? "contents" : "max-md:hidden md:contents", className)}>
        {children}
      </div>
      {open ? null : (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(true)}
          className="focus-ring press inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-raised text-body font-medium text-fg shadow-cell md:hidden"
        >
          Show {count} more {noun}
          <ChevronDown className="size-4 stroke-[1.75] text-muted" aria-hidden />
        </button>
      )}
    </>
  );
}
