import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleCheck, Clock, SearchX, Send, ShieldCheck, Users } from "lucide-react";
import { db, eq, s } from "@lobby/db";
import {
  formatMinutes,
  listPickableApps,
  type FormFieldDef,
  type SlaTargets,
} from "@lobby/core/helpdesk";
import { Page } from "@/components/page";
import { Breadcrumb, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { RequestForm } from "@/components/helpdesk/request-form";
import { requireUser } from "@/server/auth";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const rt = type
    ? await db.query.requestTypes.findFirst({
        where: eq(s.requestTypes.slug, type),
        columns: { name: true },
      })
    : null;
  return { title: rt ? `${rt.name} · Help` : "New request" };
}

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const ctx = await requireUser();
  const { type } = await searchParams;
  if (!type) redirect("/help");
  const rt = await db.query.requestTypes.findFirst({ where: eq(s.requestTypes.slug, type) });
  if (!rt || !rt.active) {
    return (
      <Page>
        <EmptyState
          variant="filtered"
          icon={<SearchX />}
          title="That request type isn't available"
          description="It may have been switched off or renamed. Pick another from the catalog."
          action={
            <Button asChild>
              <Link href="/help">Back to Help</Link>
            </Button>
          }
        />
      </Page>
    );
  }
  const [team, policy, apps, manager] = await Promise.all([
    db.query.teams.findFirst({ where: eq(s.teams.id, rt.teamId) }),
    rt.slaPolicyId
      ? db.query.slaPolicies.findFirst({ where: eq(s.slaPolicies.id, rt.slaPolicyId) })
      : null,
    (rt.fields as FormFieldDef[]).some((f) => f.type === "app")
      ? listPickableApps(ctx)
      : Promise.resolve([]),
    ctx.user.managerId
      ? db.query.users.findFirst({
          where: eq(s.users.id, ctx.user.managerId),
          columns: { displayName: true },
        })
      : null,
  ]);
  const groupName = rt.approval?.groupId
    ? (
        await db.query.groups.findFirst({
          where: eq(s.groups.id, rt.approval.groupId),
          columns: { displayName: true },
        })
      )?.displayName
    : null;

  const steps: { icon: React.ReactNode; title: string; body: string }[] = [];
  const mode = rt.approval?.mode ?? "none";
  if (mode === "manager" || mode === "manager_then_group") {
    steps.push({
      icon: <ShieldCheck />,
      title: manager ? `${manager.displayName} approves` : "Your manager approves",
      body: manager
        ? "Your manager gets an email and can approve in one click."
        : "No manager is on file, so the team approves instead.",
    });
  }
  if (mode === "group" || mode === "manager_then_group") {
    steps.push({
      icon: <Users />,
      title: `${groupName ?? `The ${team?.name ?? ""} team`} approves`,
      body: "Anyone in that group can approve it.",
    });
  }
  const targets = policy?.targets as SlaTargets | undefined;
  const t = targets?.[rt.defaultPriority];
  steps.push({
    icon: <Clock />,
    title: `${team?.name ?? "The"} team picks it up`,
    body: t
      ? `First reply within ${formatMinutes(t.firstResponse)} of working time, usually much sooner.`
      : "They'll reply here as soon as they can.",
  });
  steps.push({
    icon: <CircleCheck />,
    title: "You hear back here",
    body: "Replies and updates arrive in Lobby and by email.",
  });

  // The route this request will take, drawn as the same track the ticket will show once it exists:
  // you are the live stage now, everything after it is still to come.
  const whatNext = (
    <Section tone="quiet" title="What happens next">
      <ol className="flex flex-col">
        <li className="relative flex gap-3 pb-5">
          <span className="absolute bottom-0 left-[17px] top-10 w-0.5 rounded-full bg-gradient-to-b from-cat-blue to-transparent" aria-hidden />
          <span className="cat-blue relative inline-flex size-9 shrink-0 items-center justify-center rounded-full shadow-cell-hover" aria-hidden>
            <span className="inline-flex size-6.5 items-center justify-center rounded-full bg-white/25 shadow-[inset_0_1px_0_rgb(255_255_255/0.45)] [&_svg]:size-3.5 [&_svg]:stroke-[1.75]">
              <Send />
            </span>
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 pt-1">
            <span className="text-body font-medium text-fg">You send it</span>
            <span className="text-small text-muted">It gets a number and you can follow it from Help.</span>
          </span>
        </li>
        {steps.map((st, i) => (
          <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 ? (
              <span
                className="absolute bottom-1 left-[17px] top-10 w-0.5 bg-[repeating-linear-gradient(180deg,var(--lb-border-strong)_0_4px,transparent_4px_8px)]"
                aria-hidden
              />
            ) : null}
            <span
              className="cell relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted [&_svg]:size-4 [&_svg]:stroke-[1.5]"
              aria-hidden
            >
              {st.icon}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 pt-1">
              <span className="text-body font-medium text-fg">{st.title}</span>
              <span className="text-small text-muted">{st.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );

  return (
    <Page width="wide">
      <PageHeader
        breadcrumb={
          <Breadcrumb
            items={[{ label: "Help", href: "/help" }, { label: team?.name ?? "Request" }]}
          />
        }
        title={rt.name}
        description={rt.description ?? undefined}
      />
      <RequestForm
        typeSlug={rt.slug}
        fields={rt.fields as FormFieldDef[]}
        apps={apps}
        submitLabel={mode === "none" ? "Send request" : "Send for approval"}
        aside={whatNext}
      />
    </Page>
  );
}
