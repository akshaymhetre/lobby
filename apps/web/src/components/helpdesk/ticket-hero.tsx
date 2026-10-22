import * as React from "react";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { Words } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { RequestTrack } from "./request-track";
import { SlaRing } from "./sla-ring";
import type { TrackStage } from "./track-data";

export interface HeroTicket {
  status: string;
  createdAt: Date;
  firstResponseDueAt: Date | null;
  firstRespondedAt: Date | null;
  firstResponseBreachedAt: Date | null;
  resolutionDueAt: Date | null;
  resolvedAt: Date | null;
  resolutionBreachedAt: Date | null;
}

/**
 * The top of a ticket: where the request is on its track, and its SLA clocks as rings. The
 * requester sees one ring (when they will hear back); an agent sees both targets. A breached
 * ticket carries the one attention beam of the helpdesk, a danger light that travels the panel
 * twice and settles: the thing an agent must not miss.
 */
export function TicketHero({
  stages,
  ticket,
  rings = "resolution",
  attention = false,
  notice,
  headline,
  subline,
  className,
}: {
  stages: TrackStage[];
  /** The one sentence a reader came for ("Jordan Blake is working on it"). Builds word by word. */
  headline?: string;
  subline?: React.ReactNode;
  ticket: HeroTicket;
  rings?: "resolution" | "both" | "none";
  attention?: boolean;
  notice?: { tone: "warning" | "success" | "danger" | "neutral"; icon?: React.ReactNode; text: React.ReactNode; action?: React.ReactNode } | null;
  className?: string;
}) {
  const paused = ticket.status === "pending_approval" || ticket.status === "rejected";
  const showRings = rings !== "none" && !paused && (ticket.resolutionDueAt || ticket.firstResponseDueAt);
  return (
    <section
      aria-label="Where this request is up to"
      className={cn(
        "relative isolate flex flex-col rounded-panel panel",
        attention && "shadow-[var(--lb-shadow-panel),0_0_0_1px_color-mix(in_srgb,var(--lb-danger)_28%,transparent)]",
        className,
      )}
    >
      {attention ? <BorderBeam tone="danger" loops={2} duration={3.2} delay={0.6} /> : null}
      <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:gap-10">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {headline ? (
            <div className="flex flex-col gap-1">
              <h2 className="text-h3 font-medium tracking-tight text-fg text-balance">
                <Words text={headline} />
              </h2>
              {subline ? <p className="text-body text-muted">{subline}</p> : null}
            </div>
          ) : null}
          <RequestTrack stages={stages} className="-mx-2 sm:mx-0" />
        </div>
        {showRings ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-border pt-5 lg:flex-col lg:items-start lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            {rings === "both" ? (
              <SlaRing
                label="First reply"
                start={ticket.createdAt}
                due={ticket.firstResponseDueAt}
                doneAt={ticket.firstRespondedAt}
                breachedAt={ticket.firstResponseBreachedAt}
                size={rings === "both" ? 72 : 104}
              />
            ) : null}
            <SlaRing
              label={rings === "both" ? "Resolution" : "Resolved by"}
              start={ticket.createdAt}
              due={ticket.resolutionDueAt}
              doneAt={ticket.resolvedAt}
              breachedAt={ticket.resolutionBreachedAt}
              size={rings === "both" ? 72 : 104}
            />
          </div>
        ) : paused && rings !== "none" && ticket.status === "pending_approval" ? (
          <p className="max-w-56 border-t border-border pt-4 text-small text-muted lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            The clock starts once it&apos;s approved, so the team&apos;s targets stay honest.
          </p>
        ) : null}
      </div>
      {notice ? (
        <div
          role="status"
          className={cn(
            "flex flex-col gap-3 border-t px-5 py-3.5 sm:flex-row sm:items-center sm:px-6",
            notice.tone === "warning" && "border-warning/25 text-warning-text",
            notice.tone === "success" && "border-success/25 text-success-text",
            notice.tone === "danger" && "border-danger/25 text-danger-text",
            notice.tone === "neutral" && "border-border text-muted",
          )}
        >
          <span className="flex min-w-0 flex-1 items-start gap-2.5 text-body">
            {notice.icon ? <span className="mt-0.5 inline-flex shrink-0 [&_svg]:size-4 [&_svg]:stroke-[1.75]" aria-hidden>{notice.icon}</span> : null}
            <span>{notice.text}</span>
          </span>
          {notice.action}
        </div>
      ) : null}
    </section>
  );
}
