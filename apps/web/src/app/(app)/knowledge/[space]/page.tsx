import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePlus2, Lock, Plus } from "lucide-react";
import { getSpace, listSpacePages } from "@lobby/core/knowledge";
import { todayIso } from "@lobby/core/knowledge/freshness";
import { Page } from "@/components/page";
import { Breadcrumb, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { CellList } from "@/components/ui/cells";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { SpaceOrbit, type OrbitPage } from "@/components/knowledge/space-orbit";
import { PageCell } from "@/components/knowledge/page-row";
import { PageTree } from "@/components/knowledge/page-tree";
import { SpaceIcon } from "@/components/knowledge/space-icon";
import { requireUser } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ space: string }> }) {
  const ctx = await requireUser();
  const space = await getSpace(ctx, (await params).space);
  return { title: space ? `${space.name} · Knowledge` : "Not found" };
}

export default async function SpacePage({ params }: { params: Promise<{ space: string }> }) {
  const ctx = await requireUser();
  const space = await getSpace(ctx, (await params).space);
  if (!space) notFound();
  const pages = await listSpacePages(ctx, space);
  const published = pages.filter((p) => p.status === "published");
  const others = pages.filter((p) => p.status !== "published");
  const todayStr = todayIso();
  const orbit: OrbitPage[] = published.map((p) => ({
    id: p.id,
    title: p.title,
    href: `/knowledge/${p.spaceSlug}/${p.slug}`,
    state: p.freshness,
    reviewBy: p.reviewBy,
    ownerId: p.ownerId,
    ownerName: p.ownerName,
  }));

  return (
    <Page width="full">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-[80px] max-h-[calc(100dvh-104px)] overflow-y-auto">
            <PageTree space={space} pages={pages} canEdit={space.canEdit} />
          </div>
        </aside>

        <div className="min-w-0 max-w-(--container-page-wide)">
          <PageHeader
            breadcrumb={<Breadcrumb items={[{ label: "Knowledge", href: "/knowledge" }, { label: space.name }]} />}
            title={
              <span className="inline-flex items-center gap-3.5">
                <span className="cell flex size-11 shrink-0 items-center justify-center rounded-full">
                  <SpaceIcon name={space.icon} size="lg" className="text-fg" />
                </span>
                {space.name}
              </span>
            }
            description={
              <>
                {space.description}
                {space.visibilityGroupIds.length ? (
                  <span className="mt-1 flex items-center gap-1 text-small">
                    <Lock className="size-3.5 stroke-[1.75]" aria-hidden />
                    Visible to selected groups only
                  </span>
                ) : null}
              </>
            }
            inlineActions
            actions={
              space.canEdit ? (
                <Button asChild size="icon" aria-label="New page" className="sm:w-auto sm:px-3.5 md:w-auto md:px-3.5">
                  <Link href={`/knowledge/new?space=${space.slug}`}>
                    <Plus aria-hidden />
                    <span className="hidden sm:inline">New page</span>
                  </Link>
                </Button>
              ) : null
            }
          />

          <div className="section-stack">
            {published.length ? (
              <SpaceOrbit name={space.name} icon={space.icon} pages={orbit} today={todayStr} />
            ) : (
              <EmptyState
                icon={<FilePlus2 />}
                title="No published pages yet"
                description={
                  space.canEdit
                    ? "Start with the page people ask about most. You can save it as a draft and publish when it is ready."
                    : "Pages appear here once the space's editors publish them."
                }
                action={
                  space.canEdit ? (
                    <Button asChild>
                      <Link href={`/knowledge/new?space=${space.slug}`}>Write the first page</Link>
                    </Button>
                  ) : null
                }
              />
            )}

            {others.length ? (
              <Section title="Drafts and archived" count={others.length}>
                <CellList layout="grid" min="360px">
                  {others.map((p) => (
                    <PageCell key={p.id} page={p} showSpace={false} spaceIcon={space.icon} />
                  ))}
                </CellList>
              </Section>
            ) : null}
          </div>
        </div>
      </div>
    </Page>
  );
}
