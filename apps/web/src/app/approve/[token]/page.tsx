import Link from "next/link";
import { CircleAlert, CircleCheck, Clock3, UserX } from "lucide-react";
import { db, eq, s } from "@lobby/db";
import { getOrgSettings } from "@lobby/core";
import {
  canDecide,
  displayFieldValues,
  findApprovalByToken,
  type FormFieldDef,
} from "@lobby/core/helpdesk";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelpIcon } from "@/components/helpdesk/icons";
import { formatFieldValue } from "@/components/helpdesk/track-data";
import { ApprovalLinkCard } from "@/components/helpdesk/approval-link-decision";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Review request", robots: { index: false } };

function Shell({
  children,
  companyName,
  logoUrl,
}: {
  children: React.ReactNode;
  companyName: string;
  logoUrl: string | null;
}) {
  return (
    <TooltipProvider>
      <div className="flex min-h-dvh flex-col bg-page">
        <header className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <BrandMark name={companyName} logoUrl={logoUrl} size={28} />
          <span className="text-body font-medium text-fg">{companyName}</span>
        </header>
        <main id="main" className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
          <div className="w-full max-w-xl">{children}</div>
        </main>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}

function Message({
  icon,
  tone,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  tone: "neutral" | "danger" | "success";
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-panel panel p-6 sm:p-8">
      <span
        className={cn(
          "inline-flex [&_svg]:size-6 [&_svg]:stroke-[1.5]",
          tone === "danger"
            ? "text-danger-text"
            : tone === "success"
              ? "text-success-text"
              : "text-muted",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-h3 font-medium text-fg">{title}</h1>
        <div className="text-body text-muted">{body}</div>
      </div>
      {action}
    </div>
  );
}

/**
 * Landing page for one-time approval links from email. The link identifies the approval;
 * the person deciding must still be signed in as that approver (requireUser redirects to sign-in
 * and back here).
 */
export default async function ApproveByLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const ctx = await requireUser();
  const { token } = await params;
  const org = await getOrgSettings();
  const shell = (c: React.ReactNode) => (
    <Shell companyName={org.companyName} logoUrl={org.logoUrl}>
      {c}
    </Shell>
  );
  const toApprovals = (
    <Button asChild variant="secondary">
      <Link href="/approvals">Go to Approvals</Link>
    </Button>
  );

  const found = await findApprovalByToken(decodeURIComponent(token));
  if (!found) {
    return shell(
      <Message
        icon={<CircleCheck />}
        tone="neutral"
        title="This link has already been used"
        body="Approval links work once. If you've already decided, there's nothing more to do. Anything still waiting on you is in Approvals."
        action={toApprovals}
      />,
    );
  }
  const { approval, expired } = found;
  const ticket = await db.query.tickets.findFirst({ where: eq(s.tickets.id, approval.ticketId) });
  if (!ticket)
    return shell(
      <Message
        icon={<CircleAlert />}
        tone="danger"
        title="That request no longer exists"
        body="It may have been deleted."
        action={toApprovals}
      />,
    );

  if (!canDecide(ctx, approval, ticket)) {
    const approver = approval.approverId
      ? await db.query.users.findFirst({
          where: eq(s.users.id, approval.approverId),
          columns: { displayName: true },
        })
      : null;
    return shell(
      <Message
        icon={<UserX />}
        tone="danger"
        title="This approval isn't yours"
        body={
          <>
            It&apos;s waiting on{" "}
            {approver ? (
              <span className="font-medium text-fg">{approver.displayName}</span>
            ) : (
              "a different group"
            )}
            , and you&apos;re signed in as{" "}
            <span className="font-medium text-fg">{ctx.user.displayName}</span>. If that&apos;s not
            you, sign out and open the link again.
          </>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <form action="/auth/logout" method="post">
              <Button type="submit">Sign out</Button>
            </form>
            {toApprovals}
          </div>
        }
      />,
    );
  }
  if (approval.status !== "pending" || ticket.status !== "pending_approval") {
    return shell(
      <Message
        icon={<CircleCheck />}
        tone="neutral"
        title="This has already been decided"
        body="Nothing more is needed from you."
        action={toApprovals}
      />,
    );
  }
  if (expired) {
    return shell(
      <Message
        icon={<Clock3 />}
        tone="neutral"
        title="This link has expired"
        body="For safety, approval links only work for a while. You can still decide from Approvals."
        action={toApprovals}
      />,
    );
  }

  const [requester, rt, team] = await Promise.all([
    db.query.users.findFirst({ where: eq(s.users.id, ticket.requesterId) }),
    ticket.requestTypeId
      ? db.query.requestTypes.findFirst({ where: eq(s.requestTypes.id, ticket.requestTypeId) })
      : null,
    db.query.teams.findFirst({ where: eq(s.teams.id, ticket.teamId), columns: { name: true } }),
  ]);
  const fields = await displayFieldValues((rt?.fields ?? []) as FormFieldDef[], ticket.fields);
  const description = fields.some((f) => f.value.trim() === ticket.description.trim())
    ? ""
    : ticket.description;
  const requesterName = requester?.displayName ?? "Someone";

  // The page builds once (who, what, the decision), and the chain at the top carries the moment.
  return shell(
    <Reveal className="flex flex-col gap-4" stagger={0.08}>
      <RevealItem className="relative isolate rounded-panel panel p-6 sm:p-8 dark:glass">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 hidden h-56 w-[120%] -translate-x-1/2 rounded-full bg-now/15 blur-3xl dark:block"
        />
        <ApprovalLinkCard
          token={decodeURIComponent(token)}
          subject={ticket.subject}
          requester={{ name: requesterName, avatarUrl: requester?.avatarUrl ?? null, seed: ticket.requesterId }}
          approver={{ name: ctx.user.displayName, avatarUrl: ctx.user.avatarUrl ?? null, seed: ctx.user.id }}
          teamName={team?.name ?? "The team"}
        >
          <div className="flex flex-col gap-1.5">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
              <HelpIcon name={rt?.icon} />
              <span>{rt?.name ?? "Request"}</span>
              <span className="tabular">#{ticket.number}</span>
              <span className="hidden text-subtle sm:inline">
                from {requesterName}
                {requester?.title ? `, ${requester.title}` : ""}
              </span>
            </p>
            <h1 className="text-h3 font-medium tracking-tight text-fg text-balance">{ticket.subject}</h1>
          </div>
          {fields.length ? (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-card bg-sunken/60 p-4 sm:grid-cols-2 dark:bg-raised/40">
              {fields.map((f) => (
                <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
                  <dt className="text-caption text-muted">{f.label}</dt>
                  <dd className="break-words text-body text-fg">{formatFieldValue(f)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {description ? <p className="whitespace-pre-wrap text-body text-muted">{description}</p> : null}
        </ApprovalLinkCard>
      </RevealItem>
      <p className="px-1 text-small text-subtle">
        Signed in as {ctx.user.displayName}. This link works once.{" "}
        <Link
          href={`/help/${ticket.number}`}
          className="focus-ring rounded-[4px] text-accent-text hover:underline"
        >
          Open the full request
        </Link>
      </p>
    </Reveal>,
  );
}
