"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Info,
  Megaphone,
  ShieldAlert,
  X,
} from "lucide-react";
import { linkParts } from "@lobby/core/home/logic";
import {
  acknowledgeAnnouncementAction,
  dismissAnnouncementAction,
} from "@/app/(app)/(home)/_actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { CategoryChip } from "@/components/ui/category-block";
import { HeroLight } from "@/components/ui/hero-light";
import { cn } from "@/lib/cn";

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  severity: "info" | "important" | "critical";
  mustAcknowledge: boolean;
  authorName: string | null;
  /** When it stops showing (and, for must-acknowledge ones, the deadline). ISO string or null. */
  endsAt?: string | null;
}

const ICON = { info: Megaphone, important: Info, critical: ShieldAlert } as const;
const ICON_TONE = {
  info: "text-muted",
  important: "text-warning-text",
  critical: "text-danger-text",
} as const;

function Body({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {linkParts(text).map((p, i) =>
        "href" in p ? (
          p.href.startsWith("/") ? (
            <Link
              key={i}
              href={p.href}
              className="focus-ring rounded-[2px] font-medium underline underline-offset-2"
            >
              {p.text}
            </Link>
          ) : (
            <a
              key={i}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring rounded-[2px] font-medium underline underline-offset-2"
            >
              {p.text}
            </a>
          )
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        ),
      )}
    </span>
  );
}

const plainText = (text: string) =>
  linkParts(text)
    .map((p) => p.text)
    .join("");
const fmtDeadline = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(iso),
  );

function useAct(a: AnnouncementItem, onGone: (id: string) => void) {
  const [pending, start] = React.useTransition();
  const act = (kind: "ack" | "dismiss") =>
    start(async () => {
      const res =
        kind === "ack"
          ? await acknowledgeAnnouncementAction(a.id)
          : await dismissAnnouncementAction(a.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onGone(a.id);
      if (kind === "ack")
        toast.success("Thanks for confirming", { description: "We have noted that you read it." });
    });
  return { pending, act };
}

/** Whole days from today to an ISO deadline (local calendar days), for the countdown pill. */
function daysLeft(iso: string): number {
  const end = new Date(iso);
  const now = new Date();
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b - a) / 86_400_000);
}
const countdown = (n: number) => (n < 0 ? "Overdue" : n === 0 ? "Due today" : n === 1 ? "Due tomorrow" : `In ${n} days`);

/**
 * The lead: a must-acknowledge announcement as a filled amber block, the planner's "acknowledge
 * by" category, so the one thing on Home that needs an answer carries the same colour as its
 * deadline in the planner. The countdown is a white pill, the deadline and author ride as frosted
 * chips, and "Read and confirm" is the action. The amber beam traces its edge twice on first view.
 */
function Lead({ a, onGone }: { a: AnnouncementItem; onGone: (id: string) => void }) {
  const { pending, act } = useAct(a, onGone);
  const Icon = ICON[a.severity];
  const [open, setOpen] = React.useState(false);
  const left = a.endsAt ? daysLeft(a.endsAt) : null;
  return (
    <li className="cat-amber relative isolate overflow-hidden rounded-card p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_14px_28px_-16px_var(--lb-cat-amber-to)]" aria-labelledby={`ann-${a.id}`}>
      <BorderBeam tone="amber" loops={2} duration={2.4} delay={0.9} />
      {/* A soft sheen from the top-left: the reference's glossy block. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_0%_0%,rgb(255_255_255/0.3),transparent_55%)]" />
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/45 ring-1 ring-white/60" aria-hidden>
          <Icon className="size-[18px] stroke-[1.75]" />
        </span>
        <div className="min-w-0 flex-1">
          <p id={`ann-${a.id}`} className="text-row font-medium text-balance">
            {a.title}
          </p>
          <p className={cn("mt-1 text-body text-pretty opacity-90", !open && "line-clamp-2")}>
            <Body text={a.body} />
          </p>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="focus-ring mt-1 rounded-[3px] text-small font-medium underline underline-offset-2"
          >
            {open ? "Show less" : "Read in full"}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {left !== null ? (
          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-3 text-small font-medium text-[var(--lb-cat-amber-on)] shadow-[0_1px_2px_rgb(0_0_0/0.12)]">
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {countdown(left)}
          </span>
        ) : null}
        {a.endsAt ? (
          <CategoryChip tone="amber" className="gap-1.5">
            <CalendarClock className="size-3.5 stroke-[1.75]" aria-hidden />
            By {fmtDeadline(a.endsAt)}
          </CategoryChip>
        ) : null}
        {a.authorName ? <CategoryChip tone="amber">{a.authorName}</CategoryChip> : null}
        <Button size="sm" loading={pending} onClick={() => act("ack")} className="ml-auto">
          Read and confirm
        </Button>
      </div>
    </li>
  );
}

/** Everything else is a compact row: title, the start of the body, a dismiss. Click to read it in full. */
function Notice({ a, onGone }: { a: AnnouncementItem; onGone: (id: string) => void }) {
  const { pending, act } = useAct(a, onGone);
  const [open, setOpen] = React.useState(false);
  const Icon = ICON[a.severity];
  const bodyId = `ann-body-${a.id}`;
  return (
    <li className="group flex flex-wrap items-start gap-x-1 rounded-card bg-raised px-2 py-1 shadow-cell">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        aria-label={a.title}
        className="focus-ring flex min-h-11 min-w-0 flex-1 items-start gap-2.5 rounded-control px-2 py-2.5 text-left transition-colors duration-120 hover:bg-hover md:min-h-10"
      >
        <Icon
          className={cn("mt-[3px] size-4 shrink-0 stroke-[1.75]", ICON_TONE[a.severity])}
          aria-hidden
        />
        <span className={cn("min-w-0 flex-1 text-body", !open && "line-clamp-1")}>
          <span className="font-medium text-fg">{a.title}</span>
          {!open ? <span className="text-muted"> · {plainText(a.body)}</span> : null}
        </span>
        <ChevronRight
          className={cn(
            "mt-[3px] size-4 shrink-0 stroke-[1.75] text-subtle transition-transform duration-120 ease-standard",
            open && "rotate-90",
          )}
          aria-hidden
        />
      </button>
      <button
        type="button"
        onClick={() => act("dismiss")}
        disabled={pending}
        aria-label={`Dismiss "${a.title}"`}
        className="focus-ring touch-target mt-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-subtle transition-colors duration-120 hover:bg-hover hover:text-fg"
      >
        <X className="size-4 stroke-[1.75]" aria-hidden />
      </button>
      {open ? (
        <p
          id={bodyId}
          className="basis-full px-2 pb-3 pl-[34px] pr-11 text-body text-muted text-pretty"
        >
          <Body text={a.body} />
          {a.endsAt ? (
            <span className="mt-1 block text-caption text-subtle">
              Until {fmtDeadline(a.endsAt)}
            </span>
          ) : null}
        </p>
      ) : (
        <span id={bodyId} hidden />
      )}
    </li>
  );
}

/**
 * The Announcements card on Home: the must-acknowledge one leads as an amber block, the rest are
 * compact rows with a dismiss. Hides itself when nothing is left to show.
 */
export function Announcements({
  items,
  className,
}: {
  items: AnnouncementItem[];
  className?: string;
}) {
  const [gone, setGone] = React.useState<string[]>([]);
  const shown = items.filter((a) => !gone.includes(a.id));
  const onGone = (id: string) => setGone((g) => [...g, id]);
  const leads = shown.filter((a) => a.mustAcknowledge);
  const notices = shown.filter((a) => !a.mustAcknowledge);
  return (
    <section
      id="announcements"
      aria-labelledby="announcements-heading"
      className={cn("@container relative isolate flex scroll-mt-24 flex-col overflow-hidden rounded-panel panel p-5", className)}
    >
      {/* The card's light is the amber of its deadline (lit in dark, a tint in light). */}
      {leads.length ? <HeroLight tone="amber" position="top-left" /> : null}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="announcements-heading" className="min-w-0 truncate text-h3 font-medium text-fg @[380px]:text-h2">
          Announcements
        </h2>
        <Link
          href="/search?q=announcement"
          className="focus-ring touch-target press inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-raised px-3 text-small font-medium text-fg shadow-cell"
        >
          <ArrowUpRight className="size-3.5 stroke-[1.75]" aria-hidden />
          <span className="@max-[340px]:sr-only">View all</span>
        </Link>
      </div>
      {shown.length ? (
        <ul className="flex flex-col gap-2">
          {leads.map((a) => (
            <Lead key={a.id} a={a} onGone={onGone} />
          ))}
          {notices.map((a) => (
            <Notice key={a.id} a={a} onGone={onGone} />
          ))}
        </ul>
      ) : (
        <p className="rounded-card bg-raised/60 px-4 py-8 text-center text-body text-muted">
          You are up to date. New announcements will show here.
        </p>
      )}
    </section>
  );
}
