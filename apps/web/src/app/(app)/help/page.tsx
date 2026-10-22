import Link from "next/link";
import { Inbox, LifeBuoy } from "lucide-react";
import { and, asc, db, eq, s } from "@lobby/db";
import { listMyTickets } from "@lobby/core/helpdesk";
import { openRequestCount } from "@lobby/core/counts";
import { Page } from "@/components/page";
import { MastheadLink } from "@/components/ui/masthead";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CatalogBrowser, type CatalogTeam } from "@/components/helpdesk/catalog-browser";
import { InFlight } from "@/components/helpdesk/in-flight";
import { approvalProgressFor } from "@/components/helpdesk/approval-progress.server";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Help" };

function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export default async function HelpPage() {
  const ctx = await requireUser();
  const [rows, mine, openCount] = await Promise.all([
    db
      .select({ team: s.teams, rt: s.requestTypes })
      .from(s.requestTypes)
      .innerJoin(s.teams, eq(s.teams.id, s.requestTypes.teamId))
      .where(and(eq(s.requestTypes.active, true)))
      .orderBy(asc(s.teams.sortOrder), asc(s.teams.name), asc(s.requestTypes.sortOrder), asc(s.requestTypes.name)),
    listMyTickets(ctx, { open: true, limit: 200 }),
    // The canonical "open requests (mine)": the same number as the Home sentence and the Help badge.
    openRequestCount(ctx),
  ]);

  const teams: CatalogTeam[] = [];
  for (const { team, rt } of rows) {
    let t = teams.find((x) => x.slug === team.slug);
    if (!t) {
      t = { slug: team.slug, name: team.name, description: team.description, icon: team.icon, types: [] };
      teams.push(t);
    }
    t.types.push({ slug: rt.slug, name: rt.name, description: rt.description, icon: rt.icon, needsApproval: (rt.approval?.mode ?? "none") !== "none" });
  }
  const typeCount = teams.reduce((n, t) => n + t.types.length, 0);
  const waiting = mine.filter((t) => t.status === "waiting_on_requester").length;
  const progress = await approvalProgressFor(mine.filter((t) => t.status === "pending_approval").map((t) => t.id));
  const recent = mine.slice(0, 6).map((t) => ({ ...t, approvalProgress: progress.get(t.id) ?? null }));

  const today = (
    <>
      {typeCount ? `${typeCount} things to ask ${joinNames(teams.map((t) => t.name))} for.` : "Nothing in the catalogue yet."}{" "}
      {openCount ? (
        <>
          You have <MastheadLink href="/help/requests">{openCount === 1 ? "1 open request" : `${openCount} open requests`}</MastheadLink>
          {waiting ? (
            <>
              , {waiting === 1 ? "one" : waiting} waiting on <MastheadLink href="/help/requests">your reply</MastheadLink>
            </>
          ) : null}
          .
        </>
      ) : (
        "Nothing of yours is open."
      )}
    </>
  );

  return (
    <Page
      width="wide"
      title="Help"
      today={today}
      actions={
        <Button variant="secondary" asChild>
          <Link href="/help/requests">
            <Inbox />
            Your requests
          </Link>
        </Button>
      }
    >
      {/* The lead: what you already asked for, on its track. Then the catalogue as team tiles. */}
      {recent.length ? <InFlight rows={recent.slice(0, 4)} total={openCount} /> : null}
      <div className={recent.length ? "mt-12" : undefined}>
        {teams.length ? (
          <CatalogBrowser teams={teams} />
        ) : (
          <EmptyState
            icon={<LifeBuoy />}
            title="The help catalogue is empty"
            description={ctx.has("admin") ? "Add teams and request types, or install the starter catalog, and they'll appear here." : "Your admins haven't set up any request types yet."}
            action={
              ctx.has("admin") ? (
                <Button asChild>
                  <Link href="/admin/helpdesk">Set up the helpdesk</Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </Page>
  );
}
