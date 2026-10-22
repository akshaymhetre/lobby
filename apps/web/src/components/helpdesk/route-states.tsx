"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroLight } from "@/components/ui/hero-light";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading and error states for the helpdesk routes. The loading state draws the page's own shape
 * (a title, the hero slab, then cells), so nothing jumps when the data lands.
 */
export function HelpdeskLoading({ label, hero = "wide" }: { label: string; hero?: "wide" | "split" }) {
  return (
    <div className="mx-auto flex w-full max-w-(--container-page-wide) flex-col gap-8 px-4 pb-10 pt-3 sm:px-6 md:pt-4 lg:px-8" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-3" aria-hidden>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-11 w-64 rounded-cell" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      {hero === "split" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]" aria-hidden>
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[52px] rounded-card" />
            ))}
          </div>
          <Skeleton className="h-[420px] rounded-panel" />
        </div>
      ) : (
        <Skeleton className="h-[360px] rounded-panel" aria-hidden />
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 rounded-card" />
        ))}
      </div>
    </div>
  );
}

export function HelpdeskError({ what, reset, back }: { what: string; reset: () => void; back?: { href: string; label: string } }) {
  return (
    <div className="mx-auto flex w-full max-w-(--container-page-wide) px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <section
        role="alert"
        className="relative isolate flex w-full flex-col items-center gap-5 overflow-hidden rounded-panel panel px-6 py-14 text-center dark:glass"
      >
        <HeroLight tone="red" position="top" intensity="strong" />
        <span className="cat-coral inline-flex size-16 items-center justify-center rounded-full shadow-cell-hover" aria-hidden>
          <TriangleAlert className="size-7 stroke-[1.75]" />
        </span>
        <div className="flex max-w-md flex-col gap-2">
          <h1 className="text-hero font-medium text-fg">{what} didn&apos;t load</h1>
          <p className="text-body text-muted">Nothing you sent was lost. Try again, and if it keeps happening, tell IT in the Help catalogue.</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw />
            Try again
          </Button>
          {back ? (
            <Button variant="secondary" asChild>
              <Link href={back.href}>{back.label}</Link>
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
