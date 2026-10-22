import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Mail, MapPin, TriangleAlert } from "lucide-react";
import { assignableAgents, cannedRepliesFor, getTicketDetail } from "@lobby/core/helpdesk";
import { Page } from "@/components/page";
import { Breadcrumb, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Section } from "@/components/ui/section";
import {
  PriorityLabel,
  StatusBadge,
  type Priority,
  type TicketStatus,
} from "@/components/helpdesk/badges";
import { Timeline } from "@/components/helpdesk/timeline";
import {
  ApprovalSteps,
  DetailRow,
  FieldList,
  SectionTitle,
} from "@/components/helpdesk/ticket-parts";
import { AgentComposer, FocusComposerButton } from "@/components/helpdesk/agent-composer";
import { TicketHero } from "@/components/helpdesk/ticket-hero";
import { agentHeadline, approvalForTrack, buildStages, overdueBy } from "@/components/helpdesk/track-data";
import { TicketControls } from "@/components/helpdesk/ticket-controls";
import { formatDate, formatDateTime, timeAgo } from "@/lib/time";
import { requireRole } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return { title: `#${number} · Help queue` };
}

const SOURCE: Record<string, string> = {
  portal: "Help portal",
  ai: "Assistant",
  journey: "Onboarding journey",
  email: "Email",
  access_request: "App launcher",
};

export default async function QueueTicketPage({ params }: { params: Promise<{ number: string }> }) {
  const ctx = await requireRole("agent");
  const { number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const d = await getTicketDetail(ctx, n);
  // Agents only see tickets for teams they work; anything else is a 404, not a hint that it exists.
  if (!d || d.access !== "agent") notFound();

  const t = d.ticket;
  const [agents, canned] = await Promise.all([
    assignableAgents(ctx, [d.team.id]),
    cannedRepliesFor(ctx, d.team.id),
  ]);
  const requesterName = d.requester?.name ?? "the requester";
  const firstName = requesterName.split(" ")[0] ?? requesterName;
  const closed = t.status === "closed" || t.status === "rejected";
  const who = agentHeadline({
    status: t.status,
    assigneeName: d.assignee?.name ?? null,
    assigneeIsMe: t.assigneeId === ctx.user.id,
    requesterFirstName: firstName,
    teamName: d.team.name,
  });
  const breached = !!(t.firstResponseBreachedAt || t.resolutionBreachedAt) && !["resolved", "closed", "rejected"].includes(t.status);

  return (
    <Page width="wide">
      <PageHeader
        size="h2"
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "Help queue", href: "/queue" },
              { label: d.team.name, href: `/queue?team=${d.team.slug}` },
              { label: `#${t.number}` },
            ]}
          />
        }
        title={t.subject}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-small">
            <StatusBadge status={t.status as TicketStatus} perspective="agent" />
            <PriorityLabel priority={t.priority as Priority} />
            <span className="tabular">#{t.number}</span>
            <span>{d.requestType?.name ?? d.team.name}</span>
            <span title={formatDateTime(t.createdAt)}>Raised {formatDate(t.createdAt)}</span>
          </span>
        }
      />

      <TicketHero
        className="mb-10"
        rings="both"
        ticket={t}
        attention={breached}
        stages={buildStages({
          status: t.status as TicketStatus,
          createdAt: t.createdAt,
          teamName: d.team.name,
          assigneeName: d.assignee ? (t.assigneeId === ctx.user.id ? "You" : d.assignee.name) : null,
          pickedUpAt: t.firstRespondedAt,
          resolvedAt: t.resolvedAt,
          approval: approvalForTrack(d.approvals),
          perspective: "agent",
        })}
        headline={
          breached
            ? t.resolutionBreachedAt && t.resolutionDueAt
              ? `${overdueBy(t.resolutionDueAt)} past its resolution target`
              : "Missed its first-reply target"
            : who
        }
        subline={breached ? `${who}.` : `${d.requestType?.name ?? d.team.name}, raised by ${requesterName} ${timeAgo(t.createdAt)}.`}
        notice={
          breached
            ? {
                tone: "danger",
                icon: <TriangleAlert />,
                text: (
                  <>
                    {t.resolutionBreachedAt
                      ? "This request is past its resolution target."
                      : "This request missed its first-response target."}{" "}
                    Reply or update the status so {firstName} knows where it stands.
                  </>
                ),
                action: closed ? undefined : <FocusComposerButton />,
              }
            : null
        }
      />

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-12">
        <div className="section-stack min-w-0 max-xl:contents">
          <Card className="p-4 xl:hidden dark:glass">
            <TicketControls
              ticketId={t.id}
              status={t.status as TicketStatus}
              priority={t.priority as Priority}
              assigneeId={t.assigneeId}
              agents={agents}
              meId={ctx.user.id}
            />
          </Card>
          <Card className="p-5">
            <SectionTitle>Request</SectionTitle>
            <FieldList fields={d.fields} description={t.description} />
          </Card>

          {d.approvals.length ? (
            <Card className="p-5">
              <SectionTitle>Approvals</SectionTitle>
              <ApprovalSteps
                approvals={d.approvals}
                subject={t.subject}
                requesterName={requesterName}
              />
            </Card>
          ) : null}

          <Section title="Activity" spaced>
            <Timeline
              events={d.events}
              requesterId={t.requesterId}
              requesterName={requesterName}
              perspective="agent"
            />
            <AgentComposer
              ticketId={t.id}
              requesterFirstName={firstName}
              canned={canned}
              closed={closed}
            />
          </Section>
        </div>

        {/* On a phone the controls come first and the reference sections last, so the request itself is one scroll away. */}
        <aside
          className="section-stack xl:sticky xl:top-6 xl:self-start"
          aria-label="Ticket details"
        >
          <Card className="hidden p-4 xl:block dark:glass">
            <TicketControls
              ticketId={t.id}
              status={t.status as TicketStatus}
              priority={t.priority as Priority}
              assigneeId={t.assigneeId}
              agents={agents}
              meId={ctx.user.id}
            />
          </Card>

          {d.requester ? (
            <Section tone="quiet" title="Requester">
              <div className="flex items-center gap-3">
                <Avatar name={d.requester.name} src={d.requester.avatarUrl} seed={d.requester.id} size="lg" />
                <div className="min-w-0">
                  <Link
                    href={`/people/${d.requester.id}`}
                    className="focus-ring block truncate rounded-[4px] text-body font-medium text-fg hover:underline"
                  >
                    {d.requester.name}
                  </Link>
                  <p className="truncate text-small text-muted">
                    {d.requester.title ?? "No title"}
                  </p>
                </div>
              </div>
              <dl className="mt-3 flex flex-col border-t border-border pt-2">
                <DetailRow label="Department">
                  {d.requester.department ?? <span className="text-muted">Not set</span>}
                </DetailRow>
                <DetailRow label="Manager">
                  {d.requester.manager ? (
                    <Link
                      href={`/people/${d.requester.manager.id}`}
                      className="focus-ring rounded-[4px] hover:underline"
                    >
                      {d.requester.manager.name}
                    </Link>
                  ) : (
                    <span className="text-muted">None on file</span>
                  )}
                </DetailRow>
                {d.requester.location ? (
                  <DetailRow label="Location">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5 stroke-[1.5] text-subtle" aria-hidden />
                      {d.requester.location}
                    </span>
                  </DetailRow>
                ) : null}
                <DetailRow label="Email" stacked>
                  <a
                    href={`mailto:${d.requester.email}`}
                    className="focus-ring flex min-w-0 max-w-full items-center gap-1.5 rounded-[4px] hover:underline"
                  >
                    <Mail className="size-3.5 shrink-0 stroke-[1.5] text-subtle" aria-hidden />
                    <span className="truncate">{d.requester.email}</span>
                  </a>
                </DetailRow>
              </dl>
            </Section>
          ) : null}

          <Section tone="quiet" title="Details">
            <dl>
              <DetailRow label="Team">{d.team.name}</DetailRow>
              <DetailRow label="Type">{d.requestType?.name ?? "None"}</DetailRow>
              <DetailRow label="Raised via">{SOURCE[t.source] ?? t.source}</DetailRow>
              <DetailRow label="Created">{formatDateTime(t.createdAt)}</DetailRow>
              {d.connectorLinks.map((l) => (
                <DetailRow key={l.connectorName} label={l.connectorName}>
                  {l.externalKey ? (
                    l.externalUrl ? (
                      <a
                        href={l.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="focus-ring inline-flex items-center gap-1 rounded-[4px] text-accent-text hover:underline"
                      >
                        {l.externalKey}
                        <ExternalLink className="size-3 stroke-[1.75]" aria-hidden />
                      </a>
                    ) : (
                      l.externalKey
                    )
                  ) : (
                    <span className="text-muted">Sent</span>
                  )}
                  {l.lastStatus ? (
                    <span className="text-small text-muted"> · {l.lastStatus}</span>
                  ) : null}
                  {l.lastError ? (
                    <span className="mt-0.5 block text-small text-danger-text">{l.lastError}</span>
                  ) : null}
                </DetailRow>
              ))}
            </dl>
          </Section>
        </aside>
      </div>
    </Page>
  );
}
