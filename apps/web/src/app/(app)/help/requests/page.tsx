import Link from "next/link";
import { CircleCheck, Inbox, Plus } from "lucide-react";
import { listMyTickets } from "@lobby/core/helpdesk";
import { Page } from "@/components/page";
import { Breadcrumb, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TrackList } from "@/components/helpdesk/in-flight";
import { approvalProgressFor } from "@/components/helpdesk/approval-progress.server";
import { ViewTabs } from "@/components/helpdesk/view-tabs";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Your requests" };

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const ctx = await requireUser();
  const { view: rawView } = await searchParams;
  const view = rawView === "closed" ? "closed" : "open";
  const [open, closed] = await Promise.all([
    listMyTickets(ctx, { open: true, limit: 200 }),
    listMyTickets(ctx, { open: false, limit: 200 }),
  ]);
  const progress = await approvalProgressFor(open.filter((t) => t.status === "pending_approval").map((t) => t.id));
  const rows = (view === "open" ? open : closed).map((t) => ({ ...t, approvalProgress: progress.get(t.id) ?? null }));
  const waiting = open.filter((t) => t.status === "waiting_on_requester").length;

  return (
    <Page width="wide">
      <PageHeader
        inlineActions
        breadcrumb={
          <Breadcrumb items={[{ label: "Help", href: "/help" }, { label: "Your requests" }]} />
        }
        title="Your requests"
        description={
          open.length
            ? `${open.length} open${waiting ? `, ${waiting} waiting on your reply` : ""}. ${closed.length ? `${closed.length} closed.` : ""}`
            : "Everything you've asked for, and where it's up to."
        }
        actions={
          <Button
            asChild
            aria-label="New request"
            className="w-10 px-0 sm:w-auto sm:px-4 md:px-3.5"
          >
            <Link href="/help">
              <Plus aria-hidden />
              <span className="hidden sm:inline">New request</span>
            </Link>
          </Button>
        }
      />
      <ViewTabs
        label="Filter requests"
        active={view}
        className="mb-6"
        tabs={[
          { key: "open", label: "Open", href: "/help/requests", count: open.length },
          {
            key: "closed",
            label: "Closed",
            href: "/help/requests?view=closed",
            count: closed.length,
          },
        ]}
      />
      {rows.length ? (
        <div className="rounded-panel panel p-2 sm:p-3">
          <TrackList rows={rows} />
        </div>
      ) : null}
      {view === "open" && closed.length ? (
        <section aria-labelledby="recently-closed" className="mt-12 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <h2 id="recently-closed" className="text-h2 font-medium tracking-tight text-fg">
              Recently closed
            </h2>
            <Link href="/help/requests?view=closed" className="focus-ring rounded-[4px] text-body text-accent-text hover:underline">
              All {closed.length} closed
            </Link>
          </div>
          <TrackList rows={closed.slice(0, 3)} />
        </section>
      ) : null}
      {rows.length ? null : view === "open" ? (
        <EmptyState
          icon={<Inbox />}
          title="No open requests"
          description="Need something from IT, People, Workplace or Finance? Raise it and follow it here."
          action={
            <Button asChild>
              <Link href="/help">Browse the catalogue</Link>
            </Button>
          }
        />
      ) : (
        <EmptyState
          variant="filtered"
          icon={<CircleCheck />}
          title="Nothing closed yet"
          description="Requests move here once they're resolved, closed or not approved."
        />
      )}
    </Page>
  );
}
