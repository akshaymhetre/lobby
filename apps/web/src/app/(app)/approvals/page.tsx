import Link from "next/link";
import { CheckCheck, History } from "lucide-react";
import { displayFieldValues, listMyApprovals, type FormFieldDef } from "@lobby/core/helpdesk";
import { Page } from "@/components/page";
import { MastheadLink } from "@/components/ui/masthead";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DecidedList } from "@/components/helpdesk/decided-list";
import { HeroLight } from "@/components/ui/hero-light";
import { EmptyState } from "@/components/ui/empty-state";
import { ApprovalQueue, type ApprovalCardData } from "@/components/helpdesk/approval-queue";
import { ViewTabs } from "@/components/helpdesk/view-tabs";
import { timeAgo } from "@/lib/time";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const ctx = await requireUser();
  const { view: raw } = await searchParams;
  const view = raw === "decided" ? "decided" : "pending";
  const [pending, decided] = await Promise.all([
    listMyApprovals(ctx, "pending"),
    listMyApprovals(ctx, "decided", 50),
  ]);
  const items: ApprovalCardData[] = await Promise.all(
    pending.map(async (a) => ({
      id: a.id,
      ticketNumber: a.ticket.number,
      subject: a.ticket.subject,
      description: a.ticket.description,
      createdAt: a.ticket.createdAt.toISOString(),
      step: a.step,
      steps: a.steps,
      viaGroup: a.viaGroup,
      teamName: a.team?.name ?? null,
      requester: {
        id: a.requester.id,
        name: a.requester.name,
        avatarUrl: a.requester.avatarUrl,
        title: a.requester.title,
        department: a.requester.department,
      },
      requestType: a.requestType ? { name: a.requestType.name, icon: a.requestType.icon } : null,
      fields: await displayFieldValues(
        (a.requestType?.fields ?? []) as FormFieldDef[],
        a.ticket.fields,
      ),
    })),
  );
  const oldest = pending[0];
  const now = Date.now();
  const recent = decided.filter((d) => d.decidedAt && now - d.decidedAt.getTime() < 7 * 24 * 3600_000);
  const week = {
    approved: recent.filter((d) => d.status === "approved").length,
    rejected: recent.filter((d) => d.status === "rejected").length,
  };

  const today = pending.length ? (
    <>
      <MastheadLink href="/approvals">
        {pending.length === 1 ? "1 request is waiting" : `${pending.length} requests are waiting`}
      </MastheadLink>{" "}
      on you
      {oldest ? (
        <>
          , the oldest from {oldest.requester.name.split(" ")[0]} {timeAgo(oldest.ticket.createdAt)}
        </>
      ) : null}
      . The requester hears back the moment you decide.
    </>
  ) : (
    <>
      Nothing is waiting on you.{" "}
      {decided.length
        ? `You have decided ${decided.length} ${decided.length === 1 ? "request" : "requests"} so far.`
        : "Requests that need your approval land here and in your email."}
    </>
  );

  return (
    <Page width="wide" title="Approvals" today={today}>
      <ViewTabs
        label="Approval views"
        active={view}
        className="mb-6"
        tabs={[
          { key: "pending", label: "Waiting on you", href: "/approvals", count: pending.length },
          {
            key: "decided",
            label: "Decided by you",
            href: "/approvals?view=decided",
            count: decided.length,
          },
        ]}
      />

      {view === "pending" ? (
        items.length ? (
          <ApprovalQueue items={items} now0={now} decidedThisWeek={week} />
        ) : (
          <section className="relative isolate flex flex-col items-center gap-5 overflow-hidden rounded-panel panel px-6 py-12 text-center sm:py-16 dark:glass">
            <HeroLight tone="green" position="top" intensity="strong" />
            <span className="relative inline-flex">
              <span aria-hidden className="absolute -inset-4 rounded-full bg-success/15 blur-xl" />
              <span className="cat-green relative inline-flex size-16 items-center justify-center rounded-full shadow-cell-hover">
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-white/25 shadow-[inset_0_1px_0_rgb(255_255_255/0.45)]">
                  <CheckCheck className="size-6 stroke-[1.75]" aria-hidden />
                </span>
              </span>
            </span>
            <div className="flex max-w-md flex-col gap-1.5">
              <h2 className="text-hero font-medium text-fg">You&apos;re all caught up</h2>
              <p className="text-body text-muted">
                When someone needs your approval, for a laptop, an app or new software, it lands here and in your email.
              </p>
            </div>
            {decided.length ? (
              <div className="flex w-full max-w-md flex-col gap-2 pt-2 text-left">
                <p className="px-1 text-small text-muted">Your last decisions</p>
                <ul className="flex flex-col gap-2">
                  {decided.slice(0, 3).map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/help/${a.ticket.number}`}
                        className="focus-ring press flex min-h-12 items-center gap-3 rounded-card px-3 py-2 cell hover:shadow-cell-hover"
                      >
                        <Avatar name={a.requester.name} src={a.requester.avatarUrl} seed={a.requester.id} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-body text-fg">{a.ticket.subject}</span>
                        <Badge tone={a.status === "approved" ? "success" : "danger"} dot size="sm">
                          {a.status === "approved" ? "Approved" : "Rejected"}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        )
      ) : decided.length ? (
        <DecidedList
          now0={Date.now()}
          items={decided.map((a) => ({
            id: a.id,
            number: a.ticket.number,
            subject: a.ticket.subject,
            requester: { id: a.requester.id, name: a.requester.name, avatarUrl: a.requester.avatarUrl },
            status: a.status === "approved" ? "approved" : "rejected",
            decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
            comment: a.comment ?? null,
          }))}
        />
      ) : (
        <EmptyState
          variant="filtered"
          icon={<History />}
          title="No decisions yet"
          description="Approvals you make show up here, so you can find them again."
        />
      )}
    </Page>
  );
}
