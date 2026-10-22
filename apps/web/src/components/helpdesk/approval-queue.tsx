"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, LifeBuoy, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Disclosure } from "@/components/ui/disclosure";
import { Kbd } from "@/components/ui/kbd";
import { CategoryBlock } from "@/components/ui/category-block";
import { CellList, RowCell } from "@/components/ui/cells";
import { HeroLight } from "@/components/ui/hero-light";
import { EASE_OUT_EXPO, useMotionReduced } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { formatDateTime, timeAgo } from "@/lib/time";
import { ApprovalDecision, type ApprovalDecisionHandle } from "./approval-decision";
import { HELPDESK_ICONS } from "./icons";
import { teamTone } from "./team-tone";
import { buildStages, formatFieldValue } from "./track-data";
import { RequestTrack } from "./request-track";

export interface ApprovalCardField {
  key: string;
  label: string;
  value: string;
  type: string;
}

export interface ApprovalCardData {
  id: string;
  ticketNumber: number;
  subject: string;
  description: string;
  createdAt: string;
  step: number;
  steps: number;
  viaGroup: string | null;
  teamName?: string | null;
  requester: {
    id: string;
    name: string;
    avatarUrl: string | null;
    title: string | null;
    department: string | null;
  };
  requestType: { name: string; icon: string | null } | null;
  fields: ApprovalCardField[];
}

const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const DAY = 24 * 3600_000;

/**
 * The review deck (wave 3). The requests waiting on you are a deck: the one in focus is dealt to
 * the front, big and lit, with the one fact that decides it set large; the next two sit behind it
 * as card edges, so the pile reads as a pile. The rail beside it lists the whole deck and deals
 * any request to the front. A approves the front card and R opens its reject dialog; J and K deal
 * the next and the previous. Deciding stamps the card, which then leaves the way it was sent (right
 * for approved, left for rejected) and the next one is dealt: the screen's one authored moment.
 * The front card is lit amber once a request has waited more than a day, blue before that.
 */
export function ApprovalQueue({
  items,
  now0,
  decidedThisWeek,
}: {
  items: ApprovalCardData[];
  now0?: number;
  /** { approved, rejected } you decided in the last seven days, for the rail's summary. */
  decidedThisWeek?: { approved: number; rejected: number };
}) {
  const router = useRouter();
  const reduced = useMotionReduced();
  const [active, setActive] = React.useState(0);
  const [decided, setDecided] = React.useState<Record<string, "approved" | "rejected">>({});
  const [dir, setDir] = React.useState<1 | -1>(1);
  const handle = React.useRef<ApprovalDecisionHandle | null>(null);
  const idx = Math.min(active, items.length - 1);
  const a = items[idx];

  const go = React.useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(items.length - 1, to));
      setDir(next >= idx ? 1 : -1);
      setActive(next);
    },
    [items.length, idx],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (TYPING.has(t.tagName) || t.isContentEditable || t.closest("[role=dialog]"))) return;
      if (document.querySelector("[role=dialog][data-state=open]")) return;
      const key = e.key.toLowerCase();
      if (key === "j" || key === "k") {
        if (t?.closest("[role=menu],[role=listbox]")) return;
        e.preventDefault();
        go(idx + (key === "j" ? 1 : -1));
        return;
      }
      if (key !== "a" && key !== "r") return;
      const h = handle.current;
      if (!h) return;
      e.preventDefault();
      if (key === "a") h.approve();
      else h.reject();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, idx]);

  if (!a) return null;
  const behind = items.slice(idx + 1, idx + 3);

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-8">
      {/* The whole deck. First in the DOM so a reader meets the list before the card. */}
      <nav aria-label="Requests waiting on you" className="min-w-0 lg:sticky lg:top-24">
        <CellList
          density="compact"
          className="-mx-4 flex-row overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {items.map((it, i) => (
            <RowCell
              key={it.id}
              wrapperClassName="w-[260px] shrink-0 lg:w-auto"
              onClick={() => go(i)}
              selected={i === idx}
              leading={<Avatar name={it.requester.name} src={it.requester.avatarUrl} seed={it.requester.id} size="lg" />}
              title={it.subject}
              meta={
                <span className="truncate" suppressHydrationWarning>
                  {it.requester.name.split(" ")[0]}, {timeAgo(it.createdAt)}
                </span>
              }
              trailing={
                decided[it.id] ? (
                  <span
                    aria-label={decided[it.id] === "approved" ? "Approved" : "Rejected"}
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full [&_svg]:size-3.5 [&_svg]:stroke-[2.5]",
                      decided[it.id] === "approved" ? "cat-green" : "bg-danger text-danger-fg",
                    )}
                  >
                    {decided[it.id] === "approved" ? <Check /> : <X />}
                  </span>
                ) : undefined
              }
            />
          ))}
        </CellList>
        <RailSummary items={items} now0={now0} decided={decidedThisWeek} />
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
        {/* The deck: the front card, and the next two as edges behind it. */}
        <div className="relative isolate" style={{ paddingBottom: behind.length * 16 }}>
          {behind.map((b, n) => (
            <div
              key={b.id}
              aria-hidden
              className="absolute inset-x-0 top-0 rounded-panel panel transition-[transform,opacity] duration-300 ease-standard dark:glass"
              style={{
                bottom: behind.length * 16,
                zIndex: -1 - n,
                transform: `translateY(${(n + 1) * 16}px) scaleX(${1 - (n + 1) * 0.04})`,
                opacity: 1 - (n + 1) * 0.28,
              }}
            />
          ))}
          <AnimatePresence mode="popLayout" initial={false} custom={{ dir, verdict: decided[a.id] }}>
            <FrontCard
              key={a.id}
              a={a}
              index={idx}
              total={items.length}
              now0={now0}
              dir={dir}
              verdict={decided[a.id]}
              reduced={reduced}
              handleRef={handle}
              onDone={(outcome) => {
                setDecided((d) => ({ ...d, [a.id]: outcome }));
                window.setTimeout(() => router.refresh(), reduced ? 150 : 700);
              }}
            />
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

/**
 * Under the rail: how old the pile is and what you have decided this week, then the keys. Fills
 * the column with something a reviewer uses, instead of leaving it empty under three rows.
 */
function RailSummary({
  items,
  now0,
  decided,
}: {
  items: ApprovalCardData[];
  now0?: number;
  decided?: { approved: number; rejected: number };
}) {
  const oldest = items.reduce((m, it) => Math.min(m, new Date(it.createdAt).getTime()), Infinity);
  const overDay = now0 ? items.filter((it) => now0 - new Date(it.createdAt).getTime() > DAY).length : 0;
  const total = decided ? decided.approved + decided.rejected : 0;
  return (
    <div className="mt-4 hidden flex-col gap-4 rounded-panel panel p-5 lg:flex dark:glass">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-small text-muted">Waiting</span>
          <span className="tabular text-h2 font-medium text-fg">{items.length}</span>
          <span className="text-small text-muted" suppressHydrationWarning>
            oldest {Number.isFinite(oldest) ? timeAgo(new Date(oldest).toISOString()) : "none"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-small text-muted">Over a day</span>
          <span className={cn("tabular text-h2 font-medium", overDay ? "text-warning-text" : "text-fg")}>{overDay}</span>
          <span className="text-small text-muted">of {items.length} waiting</span>
        </div>
      </div>
      {decided ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <span className="text-small text-muted">You decided this week</span>
          {total ? (
            <>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
                <span className="cat-green h-full" style={{ width: `${(decided.approved / total) * 100}%` }} />
                <span className="cat-coral h-full" style={{ width: `${(decided.rejected / total) * 100}%` }} />
              </div>
              <span className="text-body text-fg">
                {decided.approved} approved, {decided.rejected} rejected
              </span>
            </>
          ) : (
            <span className="text-body text-fg">Nothing yet</span>
          )}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 border-t border-border pt-4 text-small text-muted">
        <span className="flex items-center gap-2">
          <Kbd>A</Kbd> approves the card in front
        </span>
        <span className="flex items-center gap-2">
          <Kbd>R</Kbd> rejects it, with a reason
        </span>
        <span className="flex items-center gap-2">
          <Kbd>J</Kbd>
          <Kbd>K</Kbd> deal the next and the previous
        </span>
      </div>
    </div>
  );
}

function TypeIcon({ name }: { name: string | null | undefined }) {
  const Icon = (name && HELPDESK_ICONS[name]) || LifeBuoy;
  return <Icon />;
}

function FrontCard({
  a,
  index,
  total,
  now0,
  dir,
  verdict,
  reduced,
  handleRef,
  onDone,
  ref,
}: {
  a: ApprovalCardData;
  index: number;
  total: number;
  now0?: number;
  dir: 1 | -1;
  verdict: "approved" | "rejected" | undefined;
  reduced: boolean;
  handleRef: React.RefObject<ApprovalDecisionHandle | null>;
  onDone: (outcome: "approved" | "rejected") => void;
  ref?: React.Ref<HTMLElement>;
}) {
  // Everything the requester told you that decides it, above the fold: the first short answer set
  // large, up to two more beside it, and their reason quoted. Anything else waits behind "Show details".
  const short = a.fields.filter((f) => f.type !== "textarea" && f.type !== "checkbox" && f.value.trim());
  const key = short[0] ?? a.fields[0] ?? null;
  const facts = short.slice(1, 3);
  const reason = a.fields.find((f) => f.type === "textarea" && f.value.trim()) ?? null;
  const rest = a.fields.filter((f) => f !== key && !facts.includes(f) && f !== reason);
  const description = a.fields.some((f) => f.value.trim() === a.description.trim()) ? "" : a.description;
  const hasMore = rest.length > 0 || description.length > 0;
  const waitedLong = (now0 ?? 0) - new Date(a.createdAt).getTime() > DAY && !!now0;

  return (
    <motion.article
      ref={ref}
      aria-labelledby={`approval-${a.id}-title`}
      className="relative isolate flex flex-col gap-6 overflow-hidden rounded-panel panel p-5 shadow-[var(--lb-shadow-cell-hover)] sm:p-8 dark:glass"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18 * dir, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
      exit={
        reduced
          ? { opacity: 0, transition: { duration: 0.15 } }
          : verdict
            ? { opacity: 0, x: verdict === "rejected" ? -160 : 160, rotate: verdict === "rejected" ? -4 : 4, scale: 0.95, transition: { duration: 0.5, ease: EASE_OUT_EXPO } }
            : { opacity: 0, y: -14 * dir, scale: 0.98, transition: { duration: 0.2 } }
      }
      transition={{ duration: reduced ? 0.2 : 0.45, ease: EASE_OUT_EXPO }}
    >
      <HeroLight tone={waitedLong ? "amber" : "blue"} position="top-right" />

      <AnimatePresence>
        {verdict ? (
          <motion.div
            key="stamp"
            className="absolute inset-0 z-10 flex items-center justify-center bg-surface/75 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
          >
            <motion.span
              className={cn(
                "inline-flex items-center gap-3 rounded-full py-2.5 pl-2.5 pr-6 text-h3 font-medium shadow-cell-hover",
                verdict === "approved" ? "cat-green" : "bg-danger text-danger-fg",
              )}
              initial={reduced ? { opacity: 0 } : { scale: 0.5, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: -3, opacity: 1 }}
              transition={reduced ? { duration: 0.15 } : { type: "spring", duration: 0.45, bounce: 0.4 }}
            >
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-white/25 shadow-[inset_0_1px_0_rgb(255_255_255/0.45)] [&_svg]:size-5 [&_svg]:stroke-[2.25]">
                {verdict === "approved" ? <Check /> : <X />}
              </span>
              {verdict === "approved" ? "Approved" : "Rejected"}
            </motion.span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CategoryBlock
          size="sm"
          tone={teamTone(a.teamName)}
          icon={<TypeIcon name={a.requestType?.icon} />}
          title={a.requestType?.name ?? "Request"}
          className="w-auto max-w-full pr-4"
        />
        <span className="flex items-center gap-3">
          {waitedLong ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-small font-medium text-warning-text">
              <span aria-hidden className="size-1.5 rounded-full bg-warning" />
              Waiting over a day
            </span>
          ) : null}
          <span className="tabular text-small text-muted">
            {index + 1} of {total}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={a.requester.name} src={a.requester.avatarUrl} seed={a.requester.id} size="xl" />
          <div className="flex min-w-0 flex-col">
            <span className="text-row font-medium text-fg">{a.requester.name}</span>
            <span className="text-small text-muted">
              {a.requester.title ?? a.requester.department ?? "Northwind Labs"}
            </span>
            <span className="text-small text-muted" suppressHydrationWarning title={formatDateTime(a.createdAt)}>
              Asked {timeAgo(a.createdAt)}, <span className="tabular">#{a.ticketNumber}</span>
            </span>
          </div>
        </div>
        <h2 id={`approval-${a.id}-title`} className="text-balance text-hero font-medium text-fg">
          {a.subject}
        </h2>
        {key ? (
          <div className="grid grid-cols-1 gap-4 rounded-card cell px-4 py-4 sm:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))] sm:px-5">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-small text-muted">{key.label}</span>
              <span className="break-words text-h2 font-medium text-fg">{formatFieldValue(key)}</span>
            </div>
            {facts.map((f) => (
              <div key={f.key} className="flex min-w-0 flex-col gap-1 sm:border-l sm:border-border sm:pl-4">
                <span className="text-small text-muted">{f.label}</span>
                <span className="break-words text-row font-medium text-fg">{formatFieldValue(f)}</span>
              </div>
            ))}
            {reason ? (
              <blockquote className="flex flex-col gap-1 border-t border-border pt-3 sm:col-span-3">
                <span className="text-small text-muted">{reason.label}</span>
                <span className="whitespace-pre-wrap break-words text-row text-fg">&ldquo;{formatFieldValue(reason)}&rdquo;</span>
              </blockquote>
            ) : null}
          </div>
        ) : null}
        {/* What your decision sets moving: the request's road, with you as the stage it is waiting on. */}
        <div className="flex flex-col gap-2 rounded-card cell px-3 pb-2 pt-3 sm:px-4">
          <span className="px-1 text-small text-muted">
            {a.steps > 1 && a.step < a.steps
              ? `Approving sends it to the next approver, then to ${a.teamName ?? "the team"}`
              : `Approving sends it straight to ${a.teamName ?? "the team"}`}
          </span>
          <RequestTrack
            size="md"
            spark={false}
            tone={teamTone(a.teamName)}
            stages={buildStages({
              status: "pending_approval",
              createdAt: a.createdAt,
              teamName: a.teamName ?? "the team",
              approval: { state: "pending", who: "You" },
            }).map((st) => (st.key === "approval" ? { ...st, label: "You decide" } : st))}
            label={`#${a.ticketNumber} progress`}
          />
        </div>
        {hasMore ? (
          <Disclosure
            variant="inline"
            title={
              <>
                <span className="group-open:hidden">Show details</span>
                <span className="hidden group-open:inline">Hide details</span>
              </>
            }
            className="-mx-1"
            contentClassName="px-1 pb-1"
          >
            <div className="flex flex-col gap-3 pt-2">
              {rest.length ? (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {rest.map((f) => (
                    <div key={f.key} className={cn("min-w-0", f.type === "textarea" && "sm:col-span-2")}>
                      <dt className="text-small text-muted">{f.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-body text-fg">{formatFieldValue(f)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {description ? <p className="whitespace-pre-wrap text-body text-fg">{description}</p> : null}
            </div>
          </Disclosure>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-5 lg:flex-row lg:items-center lg:justify-between">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted">
          <span>{a.viaGroup ? `Anyone in ${a.viaGroup} can decide` : "Waiting on you as their manager"}</span>
          {a.steps > 1 ? (
            <span>
              Step {a.step} of {a.steps}
            </span>
          ) : null}
          <Link href={`/help/${a.ticketNumber}`} className="focus-ring rounded-[4px] text-accent-text hover:underline">
            Full request
          </Link>
        </p>
        <ApprovalDecision
          ref={handleRef}
          approvalId={a.id}
          subject={a.subject}
          requesterName={a.requester.name}
          emphasis
          shortcuts
          onDone={(r) => onDone(r.outcome === "rejected" ? "rejected" : "approved")}
        />
      </div>
    </motion.article>
  );
}
