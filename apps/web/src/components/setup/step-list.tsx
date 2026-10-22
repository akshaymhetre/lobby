"use client";

import { usePathname } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { PillNav, PillNavLink } from "@/components/ui/pill-nav";
import { cn } from "@/lib/cn";
import { STEPS } from "./steps";

type Status = Record<string, { status: "done" | "skipped" } | undefined>;

/**
 * The six setup steps on the same pill track as the app's top bar (wave 3: one navigation model).
 * The current step is the raised pill; each step carries a numbered disc that turns into an accent
 * check when done. Every step is revisitable once the admin exists; before that they are shown,
 * dimmed and not focusable as links.
 */
export function StepList({ status, locked }: { status: Status; locked: boolean }) {
  const pathname = usePathname();
  const current = pathname.split("/")[2] ?? "admin";
  return (
    <PillNav label="Setup steps" id="setup-steps" size="md">
      {STEPS.map((s, i) => {
        const st = status[s.key]?.status;
        const isCurrent = current === s.key;
        const disabled = locked && s.key !== "admin";
        const disc = (
          <span
            className={cn(
              "tabular inline-flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold",
              st === "done"
                ? "bg-accent text-accent-fg"
                : isCurrent
                  ? "bg-accent-soft text-accent-text"
                  : "bg-raised text-muted shadow-highlight dark:bg-surface",
            )}
          >
            {st === "done" ? <Check className="size-3.5 stroke-[2.5]" /> : st === "skipped" ? <Minus className="size-3.5 stroke-[2]" /> : i + 1}
          </span>
        );
        const sr = st === "done" ? " (done)" : st === "skipped" ? " (skipped)" : "";
        if (disabled) {
          return (
            <span key={s.key} aria-disabled className="inline-flex h-10 shrink-0 cursor-not-allowed items-center gap-2 rounded-full px-3.5 text-body font-medium text-muted opacity-60">
              <span aria-hidden>{disc}</span>
              {s.label}
            </span>
          );
        }
        return (
          <PillNavLink key={s.key} href={`/setup/${s.key}`} active={isCurrent} current="step" icon={disc} className="pl-2">
            {s.label}
            {sr ? <span className="sr-only">{sr}</span> : null}
          </PillNavLink>
        );
      })}
    </PillNav>
  );
}
