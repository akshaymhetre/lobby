"use client";

import { Check, X } from "lucide-react";
import { CategoryBlock } from "@/components/ui/category-block";
import { HeroLight } from "@/components/ui/hero-light";
import { timeAgo } from "@/lib/time";

export interface DecidedItem {
  id: string;
  number: number;
  subject: string;
  requester: { id: string; name: string; avatarUrl: string | null };
  status: "approved" | "rejected";
  decidedAt: string | null;
  comment: string | null;
}

const DAY = 24 * 3600_000;

function bucket(at: string | null, now: number) {
  if (!at) return "Earlier";
  const age = now - new Date(at).getTime();
  // Rolling windows, not calendar days: "Today" for something decided 19 hours ago would be wrong.
  if (age < DAY) return "In the last day";
  if (age < 7 * DAY) return "This week";
  return "Earlier";
}

/**
 * The approvals you have decided, as a dated run of filled blocks: green for approved, coral for
 * rejected, the note you left quoted under the subject. Grouped by when you decided.
 */
export function DecidedList({ items, now0 }: { items: DecidedItem[]; now0: number }) {
  const groups: { label: string; items: DecidedItem[] }[] = [];
  for (const it of items) {
    const label = bucket(it.decidedAt, now0);
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(it);
    else groups.push({ label, items: [it] });
  }
  const approved = items.filter((i) => i.status === "approved").length;
  const rejected = items.length - approved;
  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* The tally: first on phones (a quick answer), beside the list from lg. */}
      <aside aria-label="Your decisions" className="relative isolate flex flex-col gap-4 overflow-hidden rounded-panel panel p-5 lg:sticky lg:top-24 lg:order-2 dark:glass">
        <HeroLight tone="green" position="top-right" />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-small text-muted">Approved</span>
            <span className="tabular text-title-sm font-medium text-success-text">{approved}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-small text-muted">Rejected</span>
            <span className="tabular text-title-sm font-medium text-danger-text">{rejected}</span>
          </div>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
          <span className="cat-green h-full" style={{ width: `${(approved / Math.max(1, items.length)) * 100}%` }} />
          <span className="cat-coral h-full" style={{ width: `${(rejected / Math.max(1, items.length)) * 100}%` }} />
        </div>
        <p className="text-body text-muted">
          Each requester heard back the moment you decided. Open one to see where it went next.
        </p>
      </aside>
      <div className="flex min-w-0 flex-col gap-8 lg:order-1">
      {groups.map((g) => (
        <section key={g.label} aria-labelledby={`decided-${g.label}`} className="flex flex-col gap-3">
          <h2 id={`decided-${g.label}`} className="text-h4 font-medium text-fg">
            {g.label} <span className="tabular text-body font-normal text-muted">{g.items.length}</span>
          </h2>
          <ul className="flex flex-col gap-3">
            {g.items.map((a) => (
              <li key={a.id} className="min-w-0">
                <CategoryBlock
                  href={`/help/${a.number}`}
                  tone={a.status === "approved" ? "green" : "coral"}
                  icon={a.status === "approved" ? <Check /> : <X />}
                  title={a.subject}
                  subtitle={
                    <span suppressHydrationWarning>
                      {a.comment ? <>&ldquo;{a.comment}&rdquo; </> : null}
                      {a.requester.name}, #{a.number}
                      {a.decidedAt ? `, ${timeAgo(a.decidedAt)}` : ""}
                    </span>
                  }
                  aria-label={`${a.status === "approved" ? "Approved" : "Rejected"}: ${a.subject}, from ${a.requester.name}`}
                  className="h-full min-w-0"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
      </div>
    </div>
  );
}
