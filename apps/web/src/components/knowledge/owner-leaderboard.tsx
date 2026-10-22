"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BellRing, UserX } from "lucide-react";
import type { FreshnessState } from "@lobby/core/knowledge/freshness";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HeroLight } from "@/components/ui/hero-light";
import { CountUp, useMotionReduced } from "@/components/ui/motion";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { remindOwnersAction } from "@/app/(app)/admin/knowledge/_actions";
import type { HealthItem } from "./content-health-table";
import { constellationLight } from "./knowledge-constellation";
import { dueWords, isoDaysBetween } from "./freshness-tone";

/** Weight of each state in the ranking: a stale page costs most, an undated one least. */
const WEIGHT: Record<FreshnessState, number> = { stale: 3, "due-soon": 2, unset: 1, verified: 0 };
const BLOCK: Record<FreshnessState, string> = {
  stale: "cat-coral",
  "due-soon": "cat-amber",
  unset: "hatch",
  verified: "bg-cat-green-soft ring-1 ring-inset ring-cat-green/35 dark:bg-cat-green-text/20",
};
const SHOWN = 6;

interface Owner {
  id: string | null;
  name: string;
  pages: HealthItem[];
  toReview: HealthItem[];
  verifiedCount: number;
  score: number;
}

/**
 * Content health's hero (wave 3): who has pages to review, ranked. Each owner is a raised row with
 * their rank set big, their face, and one block per page they own, coloured by freshness (coral
 * stale, amber due soon, hatched undated, a quiet green well when verified), so the size of each
 * person's job reads at a glance. Pages with no owner rank as their own row, because nobody will
 * be reminded about them. The rows and their blocks cascade in on load (the screen's moment).
 * Beside the board: the canonical page count and the verified share.
 */
export function OwnerLeaderboard({
  items,
  today,
  published,
  restricted,
}: {
  items: HealthItem[];
  today: string;
  /** pageCounts().published and .restricted, the canonical counts. */
  published: number;
  restricted: number;
}) {
  const reduced = useMotionReduced();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [busy, setBusy] = React.useState<string | null>(null);

  const byOwner = new Map<string, Owner>();
  for (const it of items) {
    const key = it.ownerId ?? "__none";
    const o = byOwner.get(key) ?? { id: it.ownerId, name: it.ownerName ?? "No owner", pages: [], toReview: [], verifiedCount: 0, score: 0 };
    o.pages.push(it);
    if (it.freshness !== "verified") o.toReview.push(it);
    else o.verifiedCount += 1;
    o.score += WEIGHT[it.freshness];
    byOwner.set(key, o);
  }
  const owners = [...byOwner.values()];
  // Stale pages outrank everything, then pages due soon, then undated ones.
  const n = (o: Owner, s: FreshnessState) => o.toReview.filter((p) => p.freshness === s).length;
  const ranked = owners
    .filter((o) => o.score > 0)
    .sort((a, b) => n(b, "stale") - n(a, "stale") || n(b, "due-soon") - n(a, "due-soon") || n(b, "unset") - n(a, "unset") || a.name.localeCompare(b.name));
  const current = owners.filter((o) => o.score === 0 && o.id);
  const shown = ranked.slice(0, SHOWN);
  const verified = items.filter((i) => i.freshness === "verified").length;
  const pct = items.length ? Math.round((verified / items.length) * 100) : 0;
  const count = (s: FreshnessState) => items.filter((i) => i.freshness === s).length;

  const remind = (o: Owner) =>
    start(async () => {
      setBusy(o.id);
      const r = await remindOwnersAction(o.toReview.map((p) => p.id));
      setBusy(null);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Reminder sent to ${o.name}`, { description: "They get a notification in Lobby linking to each page." });
      router.refresh();
    });

  return (
    <section aria-labelledby="owners-heading" className="panel relative isolate overflow-hidden rounded-panel p-4 sm:p-5 md:p-6" data-freshness-lead>
      <HeroLight tone={constellationLight(items)} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col gap-5">
          <div>
            <h2 id="owners-heading" className="text-h2 font-medium text-fg md:text-hero">
              Who has pages to review
            </h2>
            <p className="mt-1.5 text-body text-muted">
              {published === 1 ? "1 published page" : `${published} published pages`}
              {restricted ? `, including ${restricted} in restricted spaces` : ""}.
            </p>
          </div>
          <div>
            <CountUp value={pct} suffix="%" duration={1} className="block text-[52px] font-medium leading-[56px] tracking-[-0.03em] text-fg" />
            <p className="text-small text-muted">verified by their owner</p>
          </div>
          <ul className="flex flex-col gap-2" aria-label="Pages by freshness">
            {(["stale", "due-soon", "unset", "verified"] as FreshnessState[])
              .filter((s) => count(s) > 0)
              .map((s) => (
                <li key={s} className="flex items-center gap-3 text-body text-muted">
                  <span className={cn("size-4 shrink-0 rounded-[5px]", BLOCK[s])} aria-hidden />
                  <span className={cn("tabular w-7 text-row font-medium", s === "stale" ? "text-cat-coral-text" : "text-fg")}>{count(s)}</span>
                  {s === "stale" ? "stale" : s === "due-soon" ? "due for review soon" : s === "unset" ? "with no review date" : "verified"}
                </li>
              ))}
          </ul>
        </div>

        <div className="min-w-0">
          {shown.length ? (
            <ol className="flex flex-col gap-3" aria-label="Owners ranked by pages to review">
              {shown.map((o, i) => {
                const pages = [...o.toReview].sort((a, b) => WEIGHT[b.freshness] - WEIGHT[a.freshness] || a.title.localeCompare(b.title));
                const stale = o.toReview.filter((p) => p.freshness === "stale").length;
                const due = o.toReview.filter((p) => p.freshness === "due-soon").length;
                const words = [stale ? `${stale} stale` : null, due ? `${due} due soon` : null, o.toReview.length - stale - due ? `${o.toReview.length - stale - due} undated` : null]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <motion.li
                    key={o.id ?? "none"}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduced ? 0.2 : 0.45, delay: reduced ? 0 : 0.08 * i, ease: [0.16, 1, 0.3, 1] }}
                    className="cell relative isolate flex flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-card px-4 py-3 sm:flex-nowrap"
                  >
                    <span className="tabular w-8 shrink-0 text-hero font-medium text-fg" aria-label={`Rank ${i + 1}`}>
                      {i + 1}
                    </span>
                    {o.id ? (
                      <Avatar name={o.name} seed={o.id} size="lg" />
                    ) : (
                      <span className="cat-coral flex size-10 shrink-0 items-center justify-center rounded-full">
                        <UserX className="size-5 stroke-[1.75]" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0 flex-1 basis-[160px]">
                      {o.id ? (
                        <Link href={`/people/${o.id}`} className="focus-ring block truncate rounded-[4px] text-row font-medium text-fg hover:underline hover:underline-offset-4">
                          {o.name}
                        </Link>
                      ) : (
                        <span className="block truncate text-row font-medium text-fg">No owner</span>
                      )}
                      <span className="block text-caption text-muted">
                        {words}
                        {o.id ? "" : ". Nobody is reminded about these."}
                      </span>
                    </div>
                    {/* What they need to review, as filled blocks, worst first; then one quiet well per verified page. */}
                    <ul className="order-last flex min-w-0 basis-full flex-wrap items-center gap-2 sm:order-none sm:basis-auto sm:justify-end" aria-label={`${o.name}'s pages`}>
                      {pages.map((p, j) => {
                        const when = p.freshness === "verified" ? "verified" : p.reviewBy ? dueWords(isoDaysBetween(today, p.reviewBy)) : "no review date";
                        const toReview = p.freshness !== "verified";
                        const cls = toReview
                          ? cn("inline-flex h-9 max-w-[340px] items-center gap-2 rounded-[10px] pl-3 pr-2.5 text-small font-medium shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]", BLOCK[p.freshness], p.freshness === "unset" && "text-fg")
                          : cn("block size-5 rounded-[6px]", BLOCK[p.freshness]);
                        const body = toReview ? (
                          <>
                            <span className="truncate">{p.title}</span>
                            <span className="shrink-0 whitespace-nowrap text-caption opacity-90">{when}</span>
                          </>
                        ) : null;
                        return (
                          <motion.li
                            key={p.id}
                            className="min-w-0"
                            initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", bounce: 0.4, duration: 0.5, delay: reduced ? 0 : 0.25 + 0.08 * i + 0.04 * j }}
                          >
                            {p.href ? (
                              toReview ? (
                                <Link href={p.href} aria-label={`${p.title}, ${when}`} className={cn("focus-ring press", cls)}>
                                  {body}
                                </Link>
                              ) : (
                                <Tooltip delayDuration={60} label={`${p.title}: verified`}>
                                  <Link href={p.href} aria-label={`${p.title}, verified`} className={cn("focus-ring press", cls)} />
                                </Tooltip>
                              )
                            ) : (
                              <span role="img" tabIndex={0} aria-label={`${p.title} (restricted), ${when}`} className={cn("focus-ring", cls)}>
                                {body}
                              </span>
                            )}
                          </motion.li>
                        );
                      })}
                      {o.verifiedCount ? (
                        <li className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-cat-green-soft px-3 text-small font-medium text-cat-green-text dark:bg-cat-green-text/15">
                          +{o.verifiedCount} verified
                        </li>
                      ) : null}
                    </ul>
                    {o.id ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="shrink-0 max-sm:h-11"
                        loading={pending && busy === o.id}
                        disabled={pending}
                        onClick={() => remind(o)}
                        aria-label={`Remind ${o.name}`}
                      >
                        <BellRing aria-hidden />
                        <span>Remind</span>
                      </Button>
                    ) : null}
                  </motion.li>
                );
              })}
            </ol>
          ) : (
            <div className="cell flex min-h-40 flex-col items-center justify-center gap-1 rounded-card p-6 text-center">
              <p className="text-row font-medium text-fg">Every owner is up to date</p>
              <p className="text-small text-muted">No page is due for review in the next 14 days.</p>
            </div>
          )}
          {ranked.length > SHOWN || current.length ? (
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-small text-muted">
              {ranked.length > SHOWN ? <span>{ranked.length - SHOWN} more owners have pages to review in the table below.</span> : null}
              {current.length ? (
                <span className="inline-flex items-center gap-2">
                  <span className="flex -space-x-2" aria-hidden>
                    {current.slice(0, 5).map((o) => (
                      <Avatar key={o.id} name={o.name} seed={o.id!} size="sm" className="ring-2 ring-surface" />
                    ))}
                  </span>
                  {current.length === 1 ? "1 other owner has" : `${current.length} other owners have`} every page verified.
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
