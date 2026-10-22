import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * A panel: one lightness step above the page, a soft large shadow and a 1px top highlight.
 * No border. `interactive` adds the hover lift (the shadow deepens, the card rises 1px) and a
 * small press on a `[data-press]` child. Keep cards for things that need a surface (a pinned
 * post, an app tile, a planner); lists of like things are rows, not cards.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card bg-surface text-fg shadow-panel",
        interactive &&
          "transition-[box-shadow,background-color,transform] duration-160 ease-standard hover:-translate-y-px hover:shadow-cell-hover " +
            "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent-ring " +
            "has-[[data-press]:active]:scale-[0.995]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 px-5 pt-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-h4 font-medium text-fg", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-small text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 border-t border-border px-5 py-3", className)}
      {...props}
    />
  );
}
