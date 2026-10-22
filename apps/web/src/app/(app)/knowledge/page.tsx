import Link from "next/link";
import { BookOpen, CalendarOff, ClipboardCheck, Clock, Plus, TriangleAlert } from "lucide-react";
import { pageCounts } from "@lobby/core/counts";
import { editableSpaces, listSpacePages, listSpaces, myDrafts, needsMyReview, recentlyUpdated } from "@lobby/core/knowledge";
import { todayIso } from "@lobby/core/knowledge/freshness";
import { Page } from "@/components/page";
import { Masthead, MastheadLink } from "@/components/ui/masthead";
import { Button } from "@/components/ui/button";
import { CategoryBlock } from "@/components/ui/category-block";
import { CellList } from "@/components/ui/cells";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { countFreshness, totalOf } from "@/components/knowledge/freshness-summary";
import { KnowledgeConstellation, type ConstellationSpace } from "@/components/knowledge/knowledge-constellation";
import { dueWords, isoDaysBetween } from "@/components/knowledge/freshness-tone";
import { KnowledgeSearch } from "@/components/knowledge/knowledge-search";
import { PageCell } from "@/components/knowledge/page-row";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Knowledge" };

/*
 * The Knowledge home, wave 3. The lead is the knowledge map: the base as a constellation, every
 * space a planet sized by its pages, every page a star lit by its freshness; picking a planet
 * focuses its pages. Under it, raised cells: the pages the reader owns that need review (as
 * filled amber and coral blocks), what changed recently, and drafts.
 */
export default async function KnowledgeHome() {
  const ctx = await requireUser();
  const [spaces, recent, review, drafts, editable, pc] = await Promise.all([
    listSpaces(ctx),
    recentlyUpdated(ctx, 8),
    needsMyReview(ctx),
    myDrafts(ctx),
    editableSpaces(ctx),
    pageCounts(ctx),
  ]);
  // Every published page the reader may see, so the freshness summary is their view, not the admin's.
  const allPages = (await Promise.all(spaces.map((sp) => listSpacePages(ctx, sp)))).flat();
  const counts = countFreshness(allPages);
  // The canonical count (@lobby/core/counts): published pages this reader can see.
  const total = pc.visible || totalOf(counts);
  const isAdmin = ctx.has("admin");
  const canWrite = editable.length > 0;
  const todayStr = todayIso();
  // The published pages the reader owns: the ones to review lead as filled blocks, the rest follow as cells.
  const mine = allPages.filter((p) => p.ownerId === ctx.user.id && p.status === "published");
  const iconOf = new Map(spaces.map((sp) => [sp.slug, sp.icon]));
  // The hero: every space the reader can see, with its published pages.
  const map: ConstellationSpace[] = spaces
    .map((sp) => ({
      id: sp.id,
      slug: sp.slug,
      name: sp.name,
      icon: sp.icon,
      href: `/knowledge/${sp.slug}`,
      pages: allPages
        .filter((p) => p.spaceId === sp.id && p.status === "published")
        .map((p) => ({ id: p.id, title: p.title, href: `/knowledge/${p.spaceSlug}/${p.slug}`, freshness: p.freshness, reviewBy: p.reviewBy })),
    }))
    .filter((sp) => sp.pages.length > 0);

  const today = total ? (
    <>
      {total === 1 ? "1 page" : `${total} pages`} across {spaces.length === 1 ? "1 space" : `${spaces.length} spaces`}, {counts.verified} of them verified.
      {review.length ? (
        <>
          {" "}
          <MastheadLink href="#needs-review">{review.length === 1 ? "1 page you own" : `${review.length} pages you own`}</MastheadLink>{" "}
          {review.length === 1 ? "is" : "are"} due for review.
        </>
      ) : drafts.length ? (
        <>
          {" "}
          You have <MastheadLink href="#your-drafts">{drafts.length === 1 ? "1 draft" : `${drafts.length} drafts`}</MastheadLink> waiting.
        </>
      ) : counts.stale ? (
        ` ${counts.stale === 1 ? "1 page is" : `${counts.stale} pages are`} past review.`
      ) : (
        " Every page has an owner who keeps it current."
      )}
    </>
  ) : undefined;

  return (
    <Page width="wide">
      <Masthead
        title="Knowledge"
        today={today}
        description={total ? undefined : "Policies, guides and how things work here. Every page has an owner who keeps it current."}
        inlineActions
        actions={
          canWrite ? (
            <Button asChild size="icon" aria-label="New page" className="sm:w-auto sm:px-3.5 md:w-auto md:px-3.5">
              <Link href="/knowledge/new">
                <Plus aria-hidden />
                <span className="hidden sm:inline">New page</span>
              </Link>
            </Button>
          ) : null
        }
      >
        <KnowledgeSearch className="mt-5 w-full lg:max-w-[640px]" />
      </Masthead>

      <div className="section-stack">
        {total ? (
          <KnowledgeConstellation spaces={map} today={todayStr} total={total} healthHref={isAdmin ? "/admin/knowledge" : undefined} />
        ) : null}

        {mine.length || drafts.length || canWrite ? (
          <Section
            id="needs-review"
            title="Your pages"
            count={mine.length || undefined}
            description={
              review.length
                ? `${review.length === 1 ? "1 needs" : `${review.length} need`} your review. Check each is still right, then mark it as reviewed.`
                : mine.length
                  ? "Every page you own is current. You get a reminder 14 days before each review date."
                  : "Pages you own and drafts you have started."
            }
            className="scroll-mt-20"
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
              {mine.length ? (
                <CellList aria-label="Pages you own">
                  {review.map((p) => (
                    <li key={p.id} className="list-none">
                      <CategoryBlock
                        tone={p.freshness === "stale" ? "coral" : p.freshness === "due-soon" ? "amber" : "blue"}
                        href={`/knowledge/${p.spaceSlug}/${p.slug}`}
                        icon={p.freshness === "stale" ? <TriangleAlert /> : p.freshness === "due-soon" ? <Clock /> : <CalendarOff />}
                        status={p.reviewBy ? dueWords(isoDaysBetween(todayStr, p.reviewBy)) : "No review date"}
                        title={p.title}
                        subtitle={p.spaceName}
                      />
                    </li>
                  ))}
                  {mine
                    .filter((p) => !review.some((r) => r.id === p.id))
                    .map((p) => (
                      <PageCell key={p.id} page={p} spaceIcon={iconOf.get(p.spaceSlug)} meta="review" />
                    ))}
                </CellList>
              ) : null}
              <div id="your-drafts" className="flex scroll-mt-20 flex-col gap-3">
                {drafts.length ? (
                  <CellList aria-label="Your drafts">
                    {drafts.map((p) => (
                      <PageCell key={p.id} page={p} spaceIcon={iconOf.get(p.spaceSlug)} />
                    ))}
                  </CellList>
                ) : canWrite ? (
                  <Link
                    href="/knowledge/new"
                    className="focus-ring press group flex min-h-16 items-center gap-3.5 rounded-card border border-dashed border-border-strong px-4 py-3 hover:bg-hover"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-sunken text-muted shadow-inset">
                      <ClipboardCheck className="size-5 stroke-[1.5]" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-row font-medium text-fg">No drafts</span>
                      <span className="text-caption text-muted">Pages you start but do not publish wait here. Start a page</span>
                    </span>
                    <Plus className="size-5 shrink-0 stroke-[1.75] text-accent-text" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </div>
          </Section>
        ) : null}

        {!total ? (
          <Section title="Spaces" count={spaces.length || undefined}>
            <EmptyState
              icon={<BookOpen />}
              title={spaces.length ? "No published pages yet" : "No spaces yet"}
              description={
                spaces.length
                  ? "Spaces are ready for pages. Start with the one people ask about most."
                  : "Spaces group pages by team or topic, like People, IT or Engineering. An admin can add starter content from setup."
              }
            />
          </Section>
        ) : null}

        <Section title="Recently updated" count={recent.length || undefined}>
          {recent.length ? (
            <CellList layout="grid" min="420px">
              {recent.map((p, i) => (
                <PageCell key={p.id} page={p} spaceIcon={iconOf.get(p.spaceSlug)} phoneHidden={i >= 4} />
              ))}
            </CellList>
          ) : (
            <EmptyState compact icon={<BookOpen />} title="Nothing published yet" description="Pages appear here as soon as someone publishes them." />
          )}
        </Section>

        {!canWrite ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
            <ClipboardCheck className="size-4 stroke-[1.5] text-subtle" aria-hidden />
            Spotted something out of date? Tell the page owner, or{" "}
            <Link href="/help/new" className="focus-ring rounded-[2px] font-medium text-accent-text underline-offset-4 hover:underline">
              raise a ticket
            </Link>
            .
          </p>
        ) : null}
      </div>
    </Page>
  );
}
