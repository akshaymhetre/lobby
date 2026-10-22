import * as React from "react";
import {
  AlarmClockOff,
  ArrowUpDown,
  CircleCheck,
  CircleDot,
  CirclePlus,
  CircleX,
  ExternalLink,
  Lock,
  PlugZap,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { formatDateTime, timeAgo } from "@/lib/time";
import { statusLabel, type TicketStatus } from "./status";

export interface TimelineItem {
  id: string;
  kind: string;
  body: string | null;
  data: Record<string, unknown>;
  createdAt: Date;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
}

const PRIORITY_NAME: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

function When({ at }: { at: Date }) {
  return (
    <time
      dateTime={at.toISOString()}
      title={formatDateTime(at)}
      className="shrink-0 text-caption text-subtle"
      suppressHydrationWarning
    >
      {timeAgo(at)}
    </time>
  );
}

function Line({
  icon,
  tone = "neutral",
  children,
  at,
}: {
  icon: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning" | "accent";
  children: React.ReactNode;
  at: Date;
}) {
  return (
    <li className="relative flex items-start gap-3 py-2 pl-1">
      <span
        className={cn(
          "relative z-10 inline-flex size-6 shrink-0 items-center justify-center rounded-full ring-4 ring-page [&_svg]:size-3.5 [&_svg]:stroke-[1.75]",
          tone === "neutral" && "cell text-muted",
          tone === "success" && "bg-success-soft text-success-text",
          tone === "danger" && "bg-danger-soft text-danger-text",
          tone === "warning" && "bg-warning-soft text-warning-text",
          tone === "accent" && "bg-cat-blue-soft text-cat-blue-text",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pt-0.5">
        <div className="min-w-0 text-small text-muted">{children}</div>
        <When at={at} />
      </div>
    </li>
  );
}

const Strong = ({ children }: { children: React.ReactNode }) => (
  <span className="font-medium text-fg">{children}</span>
);

function Comment({
  e,
  internal,
  requesterId,
}: {
  e: TimelineItem;
  internal: boolean;
  requesterId: string;
}) {
  const name = e.actor?.name ?? "Someone";
  const fromRequester = e.actor?.id === requesterId;
  return (
    <li className="relative flex items-start gap-3 py-2">
      <Avatar
        name={name}
        src={e.actor?.avatarUrl}
        seed={e.actor?.id}
        size="md"
        className="relative z-10 ring-4 ring-page"
      />
      <div
        className={cn(
          "min-w-0 flex-1 rounded-card",
          internal
            ? "bg-warning-soft shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] dark:bg-warning-soft/60 dark:shadow-none"
            : "cell",
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-4 py-2",
            internal ? "border-warning/25" : "border-border",
          )}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-small font-medium text-fg">{name}</span>
            {internal ? (
              <span className="inline-flex items-center gap-1 text-caption font-medium text-warning-text">
                <Lock className="size-3 stroke-[2]" aria-hidden />
                Internal note
              </span>
            ) : fromRequester ? (
              <span className="text-caption text-subtle">Requester</span>
            ) : null}
          </div>
          <When at={e.createdAt} />
        </div>
        <div className="whitespace-pre-wrap break-words px-4 py-3 text-body text-fg">{e.body}</div>
        {internal ? <p className="sr-only">Only the team can see this note.</p> : null}
      </div>
    </li>
  );
}

export function Timeline({
  events,
  requesterId,
  requesterName,
  perspective,
}: {
  events: TimelineItem[];
  requesterId: string;
  requesterName: string;
  perspective: "requester" | "agent";
}) {
  return (
    <ol
      className="relative flex flex-col before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-border"
      aria-label="Activity"
    >
      {events.map((e) => {
        const who = e.actor?.name ?? null;
        const d = e.data;
        switch (e.kind) {
          case "reply":
            return <Comment key={e.id} e={e} internal={false} requesterId={requesterId} />;
          case "internal_note":
            return <Comment key={e.id} e={e} internal requesterId={requesterId} />;
          case "status": {
            const to = String(d.to) as TicketStatus;
            const label = statusLabel(to, perspective);
            const tone =
              to === "resolved"
                ? "success"
                : to === "rejected"
                  ? "danger"
                  : to === "closed"
                    ? "neutral"
                    : "accent";
            const icon =
              to === "resolved" ? <CircleCheck /> : to === "rejected" ? <CircleX /> : <CircleDot />;
            return (
              <Line key={e.id} icon={icon} tone={tone} at={e.createdAt}>
                {d.cancelled ? (
                  <>
                    <Strong>{who ?? "The requester"}</Strong> cancelled the request
                  </>
                ) : d.via ? (
                  <>
                    Status changed to <Strong>{label}</Strong> in {String(d.via)}
                    {d.externalStatus ? ` (${String(d.externalStatus)})` : ""}
                  </>
                ) : who && !d.auto ? (
                  <>
                    <Strong>{who}</Strong> changed the status to <Strong>{label}</Strong>
                  </>
                ) : (
                  <>
                    Status changed to <Strong>{label}</Strong>
                  </>
                )}
                {e.body ? <span className="mt-1 block text-fg">&ldquo;{e.body}&rdquo;</span> : null}
              </Line>
            );
          }
          case "assignment": {
            const toName = (d.toName as string | undefined) ?? null;
            return (
              <Line key={e.id} icon={<UserRound />} at={e.createdAt}>
                {!toName ? (
                  <>
                    <Strong>{who ?? "Someone"}</Strong> unassigned this
                  </>
                ) : d.auto || !who ? (
                  <>
                    Assigned to <Strong>{toName}</Strong>
                  </>
                ) : e.actor?.id === d.to ? (
                  <>
                    <Strong>{toName}</Strong> picked this up
                  </>
                ) : (
                  <>
                    <Strong>{who}</Strong> assigned this to <Strong>{toName}</Strong>
                  </>
                )}
              </Line>
            );
          }
          case "approval": {
            const approved = d.decision === "approved";
            const steps = Number(d.steps ?? 1);
            return (
              <Line
                key={e.id}
                icon={approved ? <ShieldCheck /> : <CircleX />}
                tone={approved ? "success" : "danger"}
                at={e.createdAt}
              >
                <Strong>{who ?? "An approver"}</Strong> {approved ? "approved" : "didn't approve"}{" "}
                this
                {steps > 1 ? ` (step ${String(d.step)} of ${steps})` : ""}
                {e.body ? <span className="mt-1 block text-fg">&ldquo;{e.body}&rdquo;</span> : null}
              </Line>
            );
          }
          case "sla":
            return (
              <Line key={e.id} icon={<AlarmClockOff />} tone="danger" at={e.createdAt}>
                <span className="text-danger-text">
                  {d.clock === "first_response"
                    ? "Missed the first-response target"
                    : "Missed the resolution target"}
                </span>
              </Line>
            );
          case "connector":
            return (
              <Line key={e.id} icon={<PlugZap />} at={e.createdAt}>
                {e.body}
                {typeof d.externalUrl === "string" ? (
                  <a
                    href={d.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring ml-1.5 inline-flex items-center gap-1 rounded-[4px] text-accent-text hover:underline"
                  >
                    Open <ExternalLink className="size-3 stroke-[1.75]" aria-hidden />
                  </a>
                ) : null}
              </Line>
            );
          case "system": {
            if (d.action === "created") {
              const onBehalf = typeof d.onBehalfOf === "string";
              return (
                <Line key={e.id} icon={<CirclePlus />} at={e.createdAt}>
                  <Strong>{who ?? requesterName}</Strong> raised this request
                  {onBehalf ? (
                    <>
                      {" "}
                      for <Strong>{requesterName}</Strong>
                    </>
                  ) : null}
                  {d.source === "ai"
                    ? " with the assistant"
                    : d.source === "access_request"
                      ? " from the app launcher"
                      : d.source === "journey"
                        ? " from an onboarding journey"
                        : ""}
                </Line>
              );
            }
            if (d.action === "priority") {
              return (
                <Line key={e.id} icon={<ArrowUpDown />} at={e.createdAt}>
                  <Strong>{who ?? "Someone"}</Strong> changed priority from{" "}
                  {PRIORITY_NAME[String(d.from)] ?? String(d.from)} to{" "}
                  <Strong>{PRIORITY_NAME[String(d.to)] ?? String(d.to)}</Strong>
                </Line>
              );
            }
            return (
              <Line key={e.id} icon={<CircleDot />} at={e.createdAt}>
                {e.body ?? "Updated"}
              </Line>
            );
          }
          default:
            return null;
        }
      })}
    </ol>
  );
}
