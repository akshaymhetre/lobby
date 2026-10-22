import { ListChecks } from "lucide-react";
import { CountUp } from "@/components/ui/motion";
import { cn } from "@/lib/cn";

/**
 * The "5/10 tasks done" pill from the Home onboarding card, so a person's count reads the same
 * everywhere: the navigator, the team view, a run. `count` tweens the number up on first view.
 */
export function TasksPill({
  done,
  total,
  count = false,
  size = "md",
  label = "tasks done",
  className,
}: {
  done: number;
  total: number;
  count?: boolean;
  size?: "sm" | "md";
  /** The word after the count: "tasks done" (default) or a shorter "done" where space is tight. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-sunken font-medium text-fg",
        size === "md" ? "h-7 px-2.5 text-caption" : "h-6 px-2 text-caption",
        className,
      )}
    >
      <ListChecks className="size-3.5 shrink-0 stroke-[1.75] text-muted" aria-hidden />
      <span className="tabular truncate">
        {count ? <CountUp value={done} duration={0.8} /> : done}
        {`/${total} ${label}`}
      </span>
    </span>
  );
}
