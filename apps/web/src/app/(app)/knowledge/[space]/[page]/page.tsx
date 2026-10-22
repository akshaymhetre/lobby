import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, FilePen, Lock } from "lucide-react";
import { acknowledgementInfo, getPageBySlug, listSpacePages } from "@lobby/core/knowledge";
import { asDoc, docOutline, wordCount } from "@lobby/core/knowledge/doc";
import { todayIso } from "@lobby/core/knowledge/freshness";
import { Page } from "@/components/page";
import { Avatar } from "@/components/ui/avatar";
import { Disclosure } from "@/components/ui/disclosure";
import { Breadcrumb } from "@/components/ui/page-header";
import { DocRenderer } from "@/components/knowledge/doc-renderer";
import { PageActions } from "@/components/knowledge/page-actions";
import { PageDateline } from "@/components/knowledge/page-dateline";
import { PageTree } from "@/components/knowledge/page-tree";
import { Acknowledge } from "@/components/knowledge/acknowledge";
import { TableOfContents } from "@/components/knowledge/toc";
import { formatDate, timeAgo } from "@/lib/time";
import { requireUser } from "@/server/auth";

type Params = { params: Promise<{ space: string; page: string }> };

export async function generateMetadata({ params }: Params) {
  const ctx = await requireUser();
  const { space, page } = await params;
  const d = await getPageBySlug(ctx, space, page);
  return { title: d ? d.page.title : "Not found" };
}

/**
 * The reading surface, v2. The article is a raised sheet on the slab: a 68ch measure at 16/26,
 * a 36px title at weight 500, and the page's own dateline (verified by, next review) as a quiet
 * caption with the freshness chip in its category colour. A stale page the reader can fix gets
 * the one authored moment: a subtle coral beam around the dateline strip. The chrome (tree,
 * table of contents) stays at the edges.
 */
export default async function KnowledgePage({ params }: Params) {
  const ctx = await requireUser();
  const { space: spaceSlug, page: pageSlug } = await params;
  const d = await getPageBySlug(ctx, spaceSlug, pageSlug);
  // Absent and not-allowed look identical, so a restricted page's existence never leaks.
  if (!d) notFound();
  const { page, space } = d;
  const doc = asDoc(page.content);
  const outline = docOutline(doc);
  const [siblings, ack] = await Promise.all([
    listSpacePages(ctx, space),
    page.template === "policy" && page.status === "published" ? acknowledgementInfo(ctx.user.id, page.id) : null,
  ]);
  const minutes = Math.max(1, Math.round(wordCount(page.contentText) / 220));
  const restricted = space.visibilityGroupIds.length > 0 || page.visibilityGroupIds.length > 0;

  return (
    <Page width="full" className="pb-20">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[248px_minmax(0,1fr)_208px]">
        <aside className="hidden lg:block">
          <div className="sticky top-[80px] max-h-[calc(100dvh-104px)] overflow-y-auto">
            <PageTree space={space} pages={siblings} currentId={page.id} canEdit={d.canEdit} />
          </div>
        </aside>

        {/* The reading column: the one inner width a `full` page may set. */}
        <div className="mx-auto w-full min-w-0 max-w-[800px]">
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
            <div className="min-w-0 text-small">
              <Breadcrumb
                items={[
                  { label: "Knowledge", href: "/knowledge" },
                  { label: space.name, href: `/knowledge/${space.slug}` },
                  ...(d.parent ? [{ label: d.parent.title, href: `/knowledge/${space.slug}/${d.parent.slug}` }] : []),
                  { label: page.title },
                ]}
              />
            </div>
            <PageActions
              pageId={page.id}
              editHref={`/knowledge/${space.slug}/${page.slug}/edit`}
              status={page.status}
              canEdit={d.canEdit}
              canReview={d.canReview}
              showHistory={d.canEdit || page.ownerId === ctx.user.id}
            />
          </div>

          <article className="panel mt-4 rounded-panel px-5 py-7 sm:px-10 sm:py-10" aria-labelledby="page-title">
            {page.status !== "published" ? (
              <div className="mb-6 flex items-start gap-3 rounded-cell bg-sunken px-4 py-3" role="status">
                {page.status === "draft" ? (
                  <FilePen className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-info-text" aria-hidden />
                ) : (
                  <Archive className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-muted" aria-hidden />
                )}
                <p className="text-small text-fg">
                  {page.status === "draft"
                    ? "This is a draft. Only editors of this space and the owner can see it, and it does not appear in search."
                    : `Archived ${page.archivedAt ? formatDate(page.archivedAt) : ""}. It no longer appears in search or listings. Restore it from the menu if it is still needed.`}
                </p>
              </div>
            ) : null}

            <header className="flex flex-col gap-4">
              <h1 id="page-title" className="text-title-sm font-medium text-fg text-balance sm:text-title">
                {page.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-small text-muted">
                {d.owner ? (
                  <Link href={`/people/${d.owner.id}`} className="focus-ring inline-flex items-center gap-2 rounded-[4px] transition-colors hover:text-fg">
                    <Avatar name={d.owner.name} src={d.owner.avatarUrl} seed={d.owner.id} size="sm" />
                    <span>
                      Owned by <span className="font-medium text-fg">{d.owner.name}</span>
                    </span>
                  </Link>
                ) : (
                  <span>No owner</span>
                )}
                <span className="whitespace-nowrap">
                  Updated {timeAgo(page.updatedAt)} <span aria-hidden className="text-subtle">·</span> <span className="tabular">{minutes} min read</span>
                </span>
                {restricted ? (
                  <span className="inline-flex items-center gap-1">
                    <Lock className="size-3.5 stroke-[1.75]" aria-hidden />
                    Restricted
                  </span>
                ) : null}
              </div>
              {page.status === "published" ? (
                <PageDateline
                  state={d.freshness}
                  verifiedAt={page.verifiedAt}
                  verifiedBy={d.verifiedBy?.name ?? null}
                  reviewBy={page.reviewBy}
                  today={todayIso()}
                  attention={d.canReview}
                  className="mt-1"
                />
              ) : null}
            </header>

            {outline.length >= 2 ? (
              <Disclosure
                variant="card"
                title="On this page"
                aside={`${outline.length} sections`}
                className="mt-6 xl:hidden"
                contentClassName="px-2 py-2"
              >
                <ul>
                  {outline.map((o) => (
                    <li key={o.id}>
                      <a
                        href={`#${o.id}`}
                        aria-label={o.text}
                        className={`focus-ring block rounded-control px-2 py-2 text-small text-muted transition-colors duration-120 hover:bg-hover hover:text-fg ${o.level >= 3 ? "pl-6" : ""}`}
                      >
                        {o.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            ) : null}

            <DocRenderer doc={doc} className="mt-8 max-w-[68ch]" />

            {ack ? (
              <div className="mt-12">
                <Acknowledge pageId={page.id} acknowledgedAt={ack.acknowledgedAt?.toISOString() ?? null} total={ack.total} />
              </div>
            ) : null}

            <footer className="mt-12 flex flex-col gap-1 border-t border-border pt-5 text-small text-muted sm:flex-row sm:items-center sm:justify-between">
              <p>
                Something wrong or out of date?{" "}
                {d.owner ? (
                  <>
                    Tell{" "}
                    <Link href={`/people/${d.owner.id}`} className="focus-ring rounded-[2px] text-accent-text underline-offset-4 hover:underline">
                      {d.owner.name}
                    </Link>
                    , or{" "}
                  </>
                ) : null}
                <Link href="/help/new" className="focus-ring rounded-[2px] text-accent-text underline-offset-4 hover:underline">
                  raise a ticket
                </Link>
                .
              </p>
            </footer>
          </article>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-[80px]">
            <TableOfContents items={outline} />
          </div>
        </aside>
      </div>
    </Page>
  );
}
