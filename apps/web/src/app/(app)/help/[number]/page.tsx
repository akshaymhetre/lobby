import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleCheck, Lock, MessageCircleReply } from "lucide-react";
import { getTicketDetail } from "@lobby/core/helpdesk";
import { Page } from "@/components/page";
import { Breadcrumb, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Section } from "@/components/ui/section";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { StatusBadge, type TicketStatus } from "@/components/helpdesk/badges";
import { Timeline } from "@/components/helpdesk/timeline";
import {
  ApprovalSteps,
  DetailRow,
  FieldList,
  SectionTitle,
} from "@/components/helpdesk/ticket-parts";
import { TicketHero } from "@/components/helpdesk/ticket-hero";
import { approvalForTrack, buildStages, headlineFor } from "@/components/helpdesk/track-data";
import { CloseRequestButton, RequesterReplyBox } from "@/components/helpdesk/requester-actions";
import { formatDate } from "@/lib/time";
import { requireUser } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return { title: `#${number} · Help` };
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const ctx = await requireUser();
  const { number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const d = await getTicketDetail(ctx, n);
  if (!d) notFound();
  // Agents working someone else's ticket get the full workspace.
  if (d.access === "agent" && d.ticket.requesterId !== ctx.user.id) redirect(`/queue/${n}`);

  const t = d.ticket;
  const isRequester = t.requesterId === ctx.user.id;
  const status = t.status as TicketStatus;
  const open = ["new", "open", "waiting_on_requester", "pending_approval"].includes(status);
  const canReply = isRequester && !["closed", "rejected"].includes(status);
  const requesterName = d.requester?.name ?? "the requester";
  const track = {
    status,
    createdAt: t.createdAt,
    teamName: d.team.name,
    assigneeName: d.assignee?.name,
    pickedUpAt: t.firstRespondedAt,
    resolvedAt: t.resolvedAt,
    approval: approvalForTrack(d.approvals),
  };

  return (
    <Page width="wide">
      <PageHeader
        size="h2"
        inlineActions
        breadcrumb={
          <Breadcrumb
            items={
              isRequester
                ? [
                    { label: "Help", href: "/help" },
                    { label: "Your requests", href: "/help/requests" },
                    { label: `#${t.number}` },
                  ]
                : [{ label: "Approvals", href: "/approvals" }, { label: `#${t.number}` }]
            }
          />
        }
        title={t.subject}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-small">
            <StatusBadge status={status} />
            <span className="tabular">#{t.number}</span>
            <span>{d.requestType?.name ?? d.team.name}</span>
            <span>Raised {formatDate(t.createdAt)}</span>
          </span>
        }
        actions={
          isRequester && (open || status === "resolved") ? (
            <CloseRequestButton ticketId={t.id} mode={status === "resolved" ? "close" : "cancel"} />
          ) : undefined
        }
      />

      <TicketHero
        className="mb-10"
        stages={buildStages(track)}
        headline={headlineFor(track)}
        subline={
          open && status !== "pending_approval" && t.resolutionDueAt
            ? `Target: sorted by ${formatDate(t.resolutionDueAt, { weekday: "short", day: "numeric", month: "short" })}. You'll get an email the moment it moves.`
            : status === "pending_approval"
              ? "Approvers get an email and can decide in one click. You'll hear the moment they do."
              : undefined
        }
        ticket={t}
        notice={
          status === "waiting_on_requester" && isRequester
            ? { tone: "warning", icon: <MessageCircleReply />, text: "The team needs something from you. Reply below and it goes straight back to them." }
            : status === "resolved" && isRequester
              ? { tone: "success", icon: <CircleCheck />, text: "The team marked this as resolved. If it isn't, reply and it reopens." }
              : null
        }
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        {/* The page builds top to bottom on first load (request, approvals, activity) under the track. */}
        <Reveal className="section-stack min-w-0" stagger={0.08}>
          <RevealItem>
            <Card className="p-5">
              <SectionTitle>Request</SectionTitle>
              <FieldList fields={d.fields} description={t.description} />
            </Card>
          </RevealItem>

          {d.approvals.length ? (
            <RevealItem>
              <Card className="p-5">
                <SectionTitle>Approvals</SectionTitle>
                <ApprovalSteps
                  approvals={d.approvals}
                  subject={t.subject}
                  requesterName={requesterName}
                />
              </Card>
            </RevealItem>
          ) : null}

          <RevealItem>
            <Section title="Activity" spaced>
              <Timeline
                events={d.events}
                requesterId={t.requesterId}
                requesterName={requesterName}
                perspective="requester"
              />
              {canReply ? (
                <RequesterReplyBox
                  ticketId={t.id}
                  hint={status === "resolved" ? "Replying reopens the request." : undefined}
                />
              ) : isRequester ? (
                <p className="flex items-center gap-2 text-small text-muted">
                  <Lock className="size-4 stroke-[1.5]" aria-hidden />
                  This request is{" "}
                  {status === "rejected" ? "closed because it wasn't approved" : "closed"}. Need
                  more help?{" "}
                  <Link
                    href="/help"
                    className="focus-ring rounded-[4px] font-medium text-accent-text hover:underline"
                  >
                    Raise a new request
                  </Link>
                </p>
              ) : null}
            </Section>
          </RevealItem>
        </Reveal>

        <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Request details">
          <Section tone="quiet" title="Details">
            <dl className="flex flex-col">
              <DetailRow label="Team">{d.team.name}</DetailRow>
              <DetailRow label="Handled by">
                {d.assignee ? (
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={d.assignee.name} src={d.assignee.avatarUrl} seed={d.assignee.id} size="xs" />
                    <span className="truncate">{d.assignee.name}</span>
                  </span>
                ) : (
                  <span className="text-muted">
                    {status === "pending_approval" ? "Assigned once approved" : "Not picked up yet"}
                  </span>
                )}
              </DetailRow>
              {!isRequester && d.requester ? (
                <DetailRow label="Requester">{d.requester.name}</DetailRow>
              ) : null}
              <DetailRow label="Raised">{formatDate(t.createdAt)}</DetailRow>
            </dl>
          </Section>
        </aside>
      </div>
    </Page>
  );
}
