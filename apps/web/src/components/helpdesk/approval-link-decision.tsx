"use client";

import * as React from "react";
import Link from "next/link";
import { CircleCheck, CircleX, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AnimatedBeam } from "@/components/ui/effects/animated-beam";
import { cn } from "@/lib/cn";
import { ApprovalDecision } from "./approval-decision";

/** The decision buttons on the email-link page, replaced by a confirmation once decided. */
export function ApprovalLinkDecision({
  token,
  subject,
  requesterName,
  done: doneProp,
  onDone,
}: {
  token: string;
  subject: string;
  requesterName: string;
  done?: { outcome: string; ticketNumber: number } | null;
  onDone?: (d: { outcome: string; ticketNumber: number }) => void;
}) {
  const [own, setOwn] = React.useState<{ outcome: string; ticketNumber: number } | null>(null);
  const done = doneProp ?? own;
  const setDone = (d: { outcome: string; ticketNumber: number }) => {
    setOwn(d);
    onDone?.(d);
  };
  if (done) {
    const rejected = done.outcome === "rejected";
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <p
          className={
            rejected
              ? "flex items-center gap-2 text-body font-medium text-danger-text"
              : "flex items-center gap-2 text-body font-medium text-success-text"
          }
        >
          {rejected ? (
            <CircleX className="size-4 stroke-[1.75]" aria-hidden />
          ) : (
            <CircleCheck className="size-4 stroke-[1.75]" aria-hidden />
          )}
          {rejected
            ? "Rejected."
            : done.outcome === "approved_final"
              ? "Approved. The team has it now."
              : "Approved. It's gone to the next approver."}
        </p>
        <p className="text-small text-muted">
          {requesterName.split(" ")[0]} has been told. You can close this tab.
        </p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/approvals">See other approvals</Link>
        </Button>
      </div>
    );
  }
  return (
    <ApprovalDecision
      token={token}
      subject={subject}
      requesterName={requesterName}
      onDone={(r) => setDone(r)}
    />
  );
}

/**
 * The email-link approval as one card: who is asking, you, and the team that does the work,
 * joined by a line a spark runs along (the request travelling to you). When you approve, the
 * line on to the team lights green and a spark carries it there; a rejection stops it with red.
 * That is the page's one authored moment.
 */
export function ApprovalLinkCard({
  token,
  subject,
  requester,
  approver,
  teamName,
  children,
}: {
  token: string;
  subject: string;
  requester: { name: string; avatarUrl: string | null; seed: string };
  approver: { name: string; avatarUrl: string | null; seed: string };
  teamName: string;
  children: React.ReactNode;
}) {
  const [done, setDone] = React.useState<{ outcome: string; ticketNumber: number } | null>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const a = React.useRef<HTMLSpanElement>(null);
  const b = React.useRef<HTMLSpanElement>(null);
  const c = React.useRef<HTMLSpanElement>(null);
  const rejected = done?.outcome === "rejected";
  const first = requester.name.split(" ")[0];
  return (
    <div className="flex flex-col gap-6">
      <div ref={box} className="relative flex items-start justify-between gap-2 px-1 sm:px-4" aria-hidden>
        <Node refEl={a} label={first ?? requester.name} caption="Asked">
          <Avatar name={requester.name} src={requester.avatarUrl} seed={requester.seed} className="size-12" />
        </Node>
        <Node refEl={b} label="You" caption={done ? (rejected ? "Rejected" : "Approved") : "Decide now"} live={!done}>
          <Avatar name={approver.name} src={approver.avatarUrl} seed={approver.seed} className="size-14" />
        </Node>
        <Node refEl={c} label={teamName} caption={done ? (rejected ? "Not needed" : "Has it now") : "Does the work"} muted={!done || rejected}>
          <span
            className={cn(
              "inline-flex size-12 items-center justify-center rounded-full transition-[background,color,box-shadow] duration-300",
              done && !rejected ? "cat-blue shadow-cell-hover" : "cell text-subtle",
            )}
          >
            <Users className="size-5 stroke-[1.75]" />
          </span>
        </Node>
        <AnimatedBeam containerRef={box} fromRef={a} toRef={b} fromAnchor="right" toAnchor="left" startXOffset={8} endXOffset={-12} tone="now" repeat={3} delay={0.5} width={2} />
        <AnimatedBeam
          containerRef={box}
          fromRef={b}
          toRef={c}
          fromAnchor="right"
          toAnchor="left"
          startXOffset={12}
          endXOffset={-8}
          active={!!done && !rejected}
          tone="green"
          repeat={2}
          width={2}
          measureKey={done ? "done" : "waiting"}
        />
      </div>
      {children}
      <div className="border-t border-border pt-5">
        <ApprovalLinkDecision token={token} subject={subject} requesterName={requester.name} done={done} onDone={setDone} />
      </div>
    </div>
  );
}

function Node({
  refEl,
  label,
  caption,
  live = false,
  muted = false,
  children,
}: {
  refEl: React.RefObject<HTMLSpanElement | null>;
  label: string;
  caption: string;
  live?: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="relative z-10 flex w-24 flex-col items-center gap-2 text-center">
      <span ref={refEl} className="relative inline-flex size-14 items-center justify-center">
        {live ? <span className="absolute -inset-1 rounded-full ring-2 ring-now/60 ring-offset-2 ring-offset-surface" /> : null}
        {children}
      </span>
      <span className="flex flex-col">
        <span className={cn("truncate text-small font-medium", muted ? "text-muted" : "text-fg")}>{label}</span>
        <span className="text-caption text-muted">{caption}</span>
      </span>
    </span>
  );
}
