import { pageCounts } from "@lobby/core/counts";
import { contentHealth } from "@lobby/core/knowledge";
import { todayIso } from "@lobby/core/knowledge/freshness";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/ui/page-header";
import { ContentHealthTable, type HealthItem } from "@/components/knowledge/content-health-table";
import { OwnerLeaderboard } from "@/components/knowledge/owner-leaderboard";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Content health · Admin" };

/*
 * Content health, wave 3. The lead is the owner board: who has pages to review, ranked, each
 * person's pages as freshness blocks, with the canonical page count beside it. Under it, the data
 * grid of pages to act on, oldest review date first.
 */
export default async function ContentHealthPage() {
  const ctx = await requireAdmin();
  const [rows, counts] = await Promise.all([contentHealth(ctx), pageCounts(ctx)]);
  const items: HealthItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    href: r.readable ? `/knowledge/${r.spaceSlug}/${r.slug}` : null,
    spaceName: r.spaceName,
    ownerId: r.ownerId,
    ownerName: r.ownerName,
    hasOwner: !!r.ownerId,
    reviewBy: r.reviewBy,
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    freshness: r.freshness,
    restricted: r.restricted,
  }));
  const published = counts.published ?? items.length;
  const restricted = counts.restricted ?? items.filter((i) => i.restricted).length;

  return (
    <Page width="full">
      <PageHeader
        title="Content health"
        description="Owners are reminded automatically 14 days before a page's review date and on the day. Pages more than 60 days past review are archived."
      />
      <div className="section-stack min-w-0">
        <OwnerLeaderboard items={items} today={todayIso()} published={published} restricted={restricted} />
        <ContentHealthTable items={items} />
      </div>
    </Page>
  );
}
