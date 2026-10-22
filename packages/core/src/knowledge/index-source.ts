/**
 * Search indexing for knowledge pages. Published pages are chunked by section (level-2 heading)
 * so a hit links straight to the right anchor; drafts, archived and unreadable pages are removed.
 */
import { db, eq, s } from "@lobby/db";
import { aclForGroups, chunkText, removeSource, upsertSource, type ChunkInput } from "../search/index";
import { effectiveAudience } from "./access";
import { asDoc, docSections } from "./doc";
import { freshnessFactor } from "./freshness";

/** Separator between a page title and a section heading in search titles. */
export const SECTION_SEPARATOR = " › ";

export function pageUrl(spaceSlug: string, pageSlug: string, anchor?: string | null) {
  return `/knowledge/${spaceSlug}/${pageSlug}${anchor ? `#${anchor}` : ""}`;
}

type PageRow = typeof s.pages.$inferSelect;
type SpaceRow = typeof s.spaces.$inferSelect;

/** Builds the search chunks for one page. Exported for tests. */
export function pageChunks(page: Pick<PageRow, "title" | "slug" | "content">, space: Pick<SpaceRow, "slug" | "name">): ChunkInput[] {
  const sections = docSections(asDoc(page.content));
  const out: ChunkInput[] = [];
  for (const section of sections) {
    const title = section.heading ? `${page.title}${SECTION_SEPARATOR}${section.heading}` : page.title;
    const url = pageUrl(space.slug, page.slug, section.id);
    const body = section.text.trim() || section.heading || "";
    for (const piece of chunkText(body)) out.push({ title, text: piece, url });
  }
  if (!out.length) out.push({ title: page.title, text: `${page.title} (${space.name})`, url: pageUrl(space.slug, page.slug) });
  return out;
}

export async function indexPage(id: string): Promise<void> {
  const page = await db.query.pages.findFirst({ where: eq(s.pages.id, id) });
  if (!page) return removeSource("page", id);
  const space = await db.query.spaces.findFirst({ where: eq(s.spaces.id, page.spaceId) });
  if (!space || page.status !== "published") return removeSource("page", id);
  const audience = effectiveAudience(space, page);
  // A restricted page whose groups do not overlap its space's: nobody may read it, never index.
  if (audience !== null && audience.length === 0) return removeSource("page", id);
  await upsertSource("page", page.id, pageChunks(page, space), aclForGroups(audience ?? []), freshnessFactor(page.reviewBy));
}

/** Rebuilds the index for every page. Returns how many pages were indexed. */
export async function reindexPages(): Promise<number> {
  const rows = await db.select({ id: s.pages.id, status: s.pages.status }).from(s.pages);
  let n = 0;
  for (const r of rows) {
    await indexPage(r.id);
    if (r.status === "published") n++;
  }
  // Drop chunks for pages that no longer exist.
  const existing = new Set(rows.map((r) => r.id));
  const indexed = await db.selectDistinct({ id: s.searchChunks.sourceId }).from(s.searchChunks).where(eq(s.searchChunks.sourceType, "page"));
  for (const { id } of indexed) if (!existing.has(id)) await removeSource("page", id);
  return n;
}
