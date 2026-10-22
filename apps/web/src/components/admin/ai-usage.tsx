"use client";

import { motion } from "motion/react";
import { CountUp, EASE_OUT_EXPO, useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";

/**
 * Inside the AI page's hero: what Ask has actually done, from its own conversation tables. Questions
 * per day for two weeks (bars grow in on load), how many people asked, and how many answers cited
 * a company page. It shows the consequence of the settings beside them.
 */
export function AiUsage({
  days,
  questions,
  people,
  cited,
  enabled,
  hasKey,
}: {
  days: { label: string; n: number; today: boolean }[];
  questions: number;
  people: number;
  cited: number;
  enabled: boolean;
  hasKey: boolean;
}) {
  const reduced = useMotionReduced();
  const max = Math.max(1, ...days.map((d) => d.n));
  const state = !enabled ? "Off for everyone" : hasKey ? "Answering questions" : "On, but cannot answer";
  return (
    <section aria-labelledby="ai-usage" className="flex min-w-0 flex-col gap-4 rounded-card bg-raised/70 p-4 shadow-cell dark:bg-white/[0.04]">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="ai-usage" className="text-row font-medium text-fg">
          The last 14 days
        </h3>
        {enabled && hasKey ? <span className="text-caption text-success-text">{state}</span> : null}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {[
          { n: questions, label: questions === 1 ? "question" : "questions" },
          { n: people, label: people === 1 ? "person asked" : "people asked" },
          { n: cited, label: cited === 1 ? "cited a page" : "cited a page" },
        ].map((x, i) => (
          <div key={x.label} className="flex min-w-0 flex-col gap-1">
            <dd className="order-1 text-h2 font-medium leading-none text-fg">
              <CountUp value={x.n} duration={1} delay={0.15 + i * 0.08} />
            </dd>
            <dt className="order-2 text-caption text-muted">{x.label}</dt>
          </div>
        ))}
      </dl>
      <div>
        <div className="flex h-16 items-end gap-1" role="img" aria-label={`Questions per day over the last 14 days, ${questions} in all.`}>
          {days.map((d, i) => (
            <motion.span
              key={d.label}
              title={`${d.label}: ${d.n}`}
              className={cn("min-w-0 flex-1 origin-bottom rounded-[3px]", d.n ? (d.today ? "bg-now" : "bg-cat-violet") : "bg-sunken")}
              style={{ height: d.n ? `${Math.max(8, (d.n / max) * 100)}%` : "4px" }}
              initial={{ scaleY: reduced ? 1 : 0 }}
              animate={{ scaleY: 1 }}
              transition={reduced ? { duration: 0 } : { delay: 0.3 + i * 0.03, duration: 0.5, ease: EASE_OUT_EXPO }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-caption text-subtle" aria-hidden>
          <span>{days[0]?.label}</span>
          <span>Today</span>
        </div>
      </div>
    </section>
  );
}
