import * as React from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-shimmer rounded-control bg-sunken", className)}
      {...props}
    />
  );
}

/** A list-row placeholder at the kernel's 52px list rhythm. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-[52px] items-center gap-3", className)} aria-hidden>
      <Skeleton className="size-8 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
    </div>
  );
}
