"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AsideSlot } from "./aside-slot";
import { StepAside } from "./step-aside";
import { useRouter } from "next/navigation";
import { AppWindow, Check, CircleAlert, CircleCheck } from "lucide-react";
import { AppIcon, type AppIconData } from "@/components/apps/app-icon";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { installAppsAction, type InstallOutcome } from "@/app/setup/_actions";

export interface PickerPreset {
  key: string;
  name: string;
  description: string;
  category: string;
  needsTenant: boolean;
  needsDomain: boolean;
  icon: AppIconData | null;
}

export function AppsPicker({
  presets,
  available,
  installed,
  tenantGuess,
  domain,
}: {
  presets: PickerPreset[];
  available: boolean;
  installed: string[];
  tenantGuess: string;
  domain: string | null;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [tenant, setTenant] = useState(tenantGuess);
  const [results, setResults] = useState<InstallOutcome[] | null>(null);
  const [pending, start] = useTransition();
  const have = useMemo(() => new Set(installed), [installed]);
  const groups = useMemo(() => {
    const m = new Map<string, PickerPreset[]>();
    for (const p of presets) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return [...m];
  }, [presets]);
  const needsTenant = presets.some((p) => picked.has(p.key) && p.needsTenant);

  if (!available) {
    return (
      <EmptyState
        icon={<AppWindow />}
        title="The app launcher is not installed yet"
        description="Skip this step. Once the launcher is available, add apps from Admin, Apps."
      />
    );
  }

  const toggle = (key: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-6">
      {groups.map(([category, list]) => (
        <section key={category} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-row font-medium text-fg">
            {category}
            <span className="tabular inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-raised px-2 text-caption text-muted shadow-cell">{list.length}</span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((p) => {
              const added = have.has(p.key);
              const on = picked.has(p.key);
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    disabled={added}
                    aria-pressed={on}
                    onClick={() => toggle(p.key)}
                    className={cn(
                      // A key: raised when idle, pressed in (selected tone, inset shadow) when picked.
                      "focus-ring press flex min-h-[68px] w-full items-center gap-3 rounded-card px-3.5 py-3 text-left",
                      // Installed apps are "on": raised, ringed in the brand colour, with a check. Picked ones are the same, pending.
                      added
                        ? "cell cursor-default ring-1 ring-accent/45"
                        : on
                          ? "cell ring-2 ring-accent"
                          : "cell hover:shadow-cell-hover",
                    )}
                  >
                    {p.icon ? <AppIcon icon={p.icon} size="md" /> : <span className="size-10 shrink-0 rounded-card bg-sunken" aria-hidden />}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-row font-medium text-fg">{p.name}</span>
                      <span className="line-clamp-1 text-small text-muted">{p.description}</span>
                    </span>
                    {added ? (
                      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg shadow-cell" title="In the launcher">
                        <Check className="size-3.5 stroke-[3]" aria-hidden />
                        <span className="sr-only">In the launcher</span>
                      </span>
                    ) : (
                      <span
                        aria-hidden
                        className={cn(
                          "inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-120",
                          on ? "bg-accent text-accent-fg shadow-cell" : "bg-sunken shadow-inset",
                        )}
                      >
                        {on ? <Check className="size-3.5 stroke-[3]" /> : null}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {/* The preview pane: the launcher, filling as you tick. Apps already in it sit quiet; ticked ones pop in ringed. */}
      <AsideSlot>
        <StepAside
          tone={picked.size ? "teal" : "blue"}
          title="Your launcher"
          caption={picked.size ? `${picked.size} ${picked.size === 1 ? "app joins" : "apps join"} when you add ${picked.size === 1 ? "it" : "them"}.` : "Tick an app and it joins the launcher here."}
        >
          <ul className="grid grid-cols-4 gap-x-2 gap-y-4">
            <AnimatePresence initial={false}>
              {presets
                .filter((p) => have.has(p.key) || picked.has(p.key))
                .map((p) => (
                  <motion.li
                    key={p.key}
                    layout
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ type: "spring", stiffness: 420, damping: 26 }}
                    className="flex min-w-0 flex-col items-center gap-1.5"
                  >
                    <span className={cn("rounded-card", picked.has(p.key) && "ring-2 ring-accent ring-offset-2 ring-offset-surface")}>
                      {p.icon ? <AppIcon icon={p.icon} size="md" /> : <span className="block size-10 rounded-card bg-sunken" aria-hidden />}
                    </span>
                    <span className="w-full truncate text-center text-caption text-muted">{p.name}</span>
                  </motion.li>
                ))}
            </AnimatePresence>
          </ul>
          {!have.size && !picked.size ? <p className="text-small text-muted">Empty for now.</p> : null}
        </StepAside>
      </AsideSlot>

      {/* The add bar rides along the bottom of the list while apps are picked. */}
      <div className={cn("flex flex-col gap-3 rounded-card p-4", picked.size ? "sticky bottom-24 z-10 cell shadow-popover lg:bottom-6" : "panel")}>
        {needsTenant ? (
          <Field label="Your workspace name" help="Used in links such as northwind.slack.com. Change any app's link later.">
            <Input value={tenant} onChange={(e) => setTenant(e.target.value)} spellCheck={false} className="sm:max-w-[240px]" />
          </Field>
        ) : null}
        {!domain && presets.some((p) => picked.has(p.key) && p.needsDomain) ? (
          <p className="text-small text-warning-text">Some of these need your email domain. Add it in the Company step first.</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="tabular text-small text-muted">{picked.size ? `${picked.size} selected` : "Pick the apps your company uses"}</span>
          <Button
            type="button"
            variant={picked.size ? "primary" : "secondary"}
            disabled={!picked.size}
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await installAppsAction([...picked], tenant);
                setResults(r.results);
                setPicked(new Set());
                router.refresh();
              })
            }
          >
            Add {picked.size || ""} {picked.size === 1 ? "app" : "apps"}
          </Button>
        </div>
        {results ? (
          <ul className="flex flex-col gap-1 text-small" role="status">
            {results.map((r) => (
              <li key={r.key} className={cn("flex items-start gap-2", r.ok ? "text-fg" : "text-danger-text")}>
                {r.ok ? (
                  <CircleCheck className="mt-px size-4 shrink-0 stroke-[1.5] text-success-text" aria-hidden />
                ) : (
                  <CircleAlert className="mt-px size-4 shrink-0 stroke-[1.5]" aria-hidden />
                )}
                <span>
                  <span className="font-medium">{r.label}</span> <span className={r.ok ? "text-muted" : ""}>{r.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
