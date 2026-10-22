"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CircleAlert, CircleCheck, LifeBuoy, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { installContentAction, type ContentKey, type InstallOutcome } from "@/app/setup/_actions";

const OPTIONS: { key: ContentKey; fill: string; icon: React.ReactNode; title: string; body: string; existingLabel: (n: number) => string }[] = [
  {
    key: "knowledge",
    fill: "cat-teal",
    icon: <BookOpen />,
    title: "Starter knowledge spaces and pages",
    body: "Company, People, IT and Finance spaces with a handbook, security policy and laptop setup guide to edit.",
    existingLabel: (n) => `${n} ${n === 1 ? "space" : "spaces"} already`,
  },
  {
    key: "helpdesk",
    fill: "cat-blue",
    icon: <LifeBuoy />,
    title: "IT and HR request types",
    body: "New laptop, app access, password reset, leave questions and more, routed to IT, People, Workplace and Finance teams with SLAs.",
    existingLabel: (n) => `${n} request ${n === 1 ? "type" : "types"} already`,
  },
  {
    key: "journeys",
    fill: "cat-violet",
    icon: <Route />,
    title: "Onboarding journeys",
    body: "A first-week plan for every new joiner, with tasks for their manager, buddy and IT on the right days.",
    existingLabel: (n) => `${n} ${n === 1 ? "journey" : "journeys"} already`,
  },
];

export function ContentPicker({ existing }: { existing: Record<ContentKey, number> }) {
  const router = useRouter();
  const [on, setOn] = useState<Record<ContentKey, boolean>>({ knowledge: true, helpdesk: true, journeys: true });
  const [results, setResults] = useState<InstallOutcome[] | null>(null);
  const [pending, start] = useTransition();
  const chosen = (Object.keys(on) as ContentKey[]).filter((k) => on[k]);

  return (
    <div className="flex flex-col gap-4">
      {/* Each shelf is its own raised cell; its disc wears the module's category colour. */}
      <ul className="flex flex-col gap-3">
        {OPTIONS.map((o) => {
          const result = results?.find((r) => r.key === o.key);
          return (
            <li key={o.key} className={cn("cell flex items-start gap-4 rounded-card p-4 transition-shadow duration-160 sm:p-5", on[o.key] && "shadow-[var(--lb-shadow-cell),0_0_0_2px_var(--lb-accent-ring)]")}>
              <span className={cn(o.fill, "inline-flex size-11 shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] [&_svg]:size-5 [&_svg]:stroke-[1.75]")} aria-hidden>
                {o.icon}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor={`content-${o.key}`} className="flex flex-wrap items-center gap-2 text-row font-medium text-fg">
                  {o.title}
                  {existing[o.key] ? <Badge size="sm">{o.existingLabel(existing[o.key])}</Badge> : null}
                </label>
                <p className="text-pretty text-small text-muted">{o.body}</p>
                {result ? (
                  <p className={result.ok ? "flex items-center gap-1.5 text-small text-success-text" : "flex items-center gap-1.5 text-small text-danger-text"} role="status">
                    {result.ok ? <CircleCheck className="size-4 stroke-[1.5]" aria-hidden /> : <CircleAlert className="size-4 stroke-[1.5]" aria-hidden />}
                    {result.detail}
                  </p>
                ) : null}
              </div>
              <Switch id={`content-${o.key}`} checked={on[o.key]} onCheckedChange={(v) => setOn((c) => ({ ...c, [o.key]: v }))} className="mt-2" />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-muted">Adding twice is safe: anything that already exists is left as it is.</p>
        <Button
          type="button"
          variant="secondary"
          className="w-full shrink-0 sm:w-auto"
          disabled={!chosen.length}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await installContentAction(chosen);
              setResults(r.results);
              router.refresh();
            })
          }
        >
          Add {chosen.length === OPTIONS.length ? "all three" : chosen.length ? `${chosen.length} selected` : "selected content"}
        </Button>
      </div>
    </div>
  );
}
