/**
 * Knowledge base domain logic: spaces, pages, versions, acknowledgements and the freshness engine.
 * Every function that takes a UserContext re-checks access itself; callers never pre-filter.
 */
import { and, asc, count, db, desc, eq, inArray, isNotNull, ne, s, sql } from "@lobby/db";
import { audit } from "../audit";
import { notify } from "../notify";
import type { UserContext } from "../identity/context";
import { canEditSpace, canReviewPage, canViewPage, canViewSpace } from "./access";
import { asDoc, docToText, slugify, type DocNode } from "./doc";
import {
  ARCHIVE_AFTER_STALE_DAYS,
  REVIEW_INTERVAL_DAYS,
  addDays,
  freshnessState,
  reminderToSend,
  shouldArchive,
  todayIso,
  type FreshnessState,
} from "./freshness";
import { indexPage, pageUrl, reindexPages } from "./index-source";
import { markdownToDoc } from "./markdown";
import type { PageTemplate } from "./templates";

export * from "./access";
export * from "./freshness";
export { indexPage, reindexPages, pageUrl } from "./index-source";

export type SpaceRow = typeof s.spaces.$inferSelect;
export type PageRow = typeof s.pages.$inferSelect;
export type PageStatus = PageRow["status"];

export class KnowledgeError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "forbidden" | "invalid" = "invalid",
  ) {
    super(message);
  }
}

export interface PageSummary {
  id: string;
  spaceId: string;
  spaceSlug: string;
  spaceName: string;
  parentId: string | null;
  slug: string;
  title: string;
  template: PageTemplate;
  status: PageStatus;
  reviewBy: string | null;
  verifiedAt: Date | null;
  updatedAt: Date;
  ownerId: string | null;
  ownerName: string | null;
  freshness: FreshnessState;
  restricted: boolean;
}

const summaryCols = {
  id: s.pages.id,
  spaceId: s.pages.spaceId,
  spaceSlug: s.spaces.slug,
  spaceName: s.spaces.name,
  parentId: s.pages.parentId,
  slug: s.pages.slug,
  title: s.pages.title,
  template: s.pages.template,
  status: s.pages.status,
  reviewBy: s.pages.reviewBy,
  verifiedAt: s.pages.verifiedAt,
  updatedAt: s.pages.updatedAt,
  ownerId: s.pages.ownerId,
  ownerName: s.users.displayName,
  pageGroups: s.pages.visibilityGroupIds,
  spaceGroups: s.spaces.visibilityGroupIds,
  spaceEditors: s.spaces.editorGroupIds,
};


function summarise(r: SummaryRow, today = todayIso()): PageSummary {
  return {
    id: r.id,
    spaceId: r.spaceId,
    spaceSlug: r.spaceSlug,
    spaceName: r.spaceName,
    parentId: r.parentId,
    slug: r.slug,
    title: r.title,
    template: r.template,
    status: r.status,
    reviewBy: r.reviewBy,
    verifiedAt: r.verifiedAt,
    updatedAt: r.updatedAt,
    ownerId: r.ownerId,
    ownerName: r.ownerName,
    freshness: freshnessState(r.reviewBy, today),
    restricted: r.pageGroups.length > 0 || r.spaceGroups.length > 0,
  };
}

const visibleTo = (ctx: UserContext) => (r: SummaryRow) =>
  canViewPage(ctx, { visibilityGroupIds: r.spaceGroups, editorGroupIds: r.spaceEditors }, { visibilityGroupIds: r.pageGroups });

function selectSummaries() {
  return db
    .select(summaryCols)
    .from(s.pages)
    .innerJoin(s.spaces, eq(s.spaces.id, s.pages.spaceId))
    .leftJoin(s.users, eq(s.users.id, s.pages.ownerId));
}
type SummaryRow = Awaited<ReturnType<typeof selectSummaries>>[number];

// ---------------------------------------------------------------------------------------------
// Spaces

export interface SpaceSummary extends SpaceRow {
  pageCount: number;
  canEdit: boolean;
  restricted: boolean;
}

/** Spaces the user can see, with the number of published pages they can read in each. */
export async function listSpaces(ctx: UserContext): Promise<SpaceSummary[]> {
  const spaces = (await db.select().from(s.spaces).orderBy(asc(s.spaces.sortOrder), asc(s.spaces.name))).filter((sp) =>
    canViewSpace(ctx, sp),
  );
  if (!spaces.length) return [];
  const pages = (await selectSummaries().where(and(eq(s.pages.status, "published"), inArray(s.pages.spaceId, spaces.map((x) => x.id))))).filter(
    visibleTo(ctx),
  );
  return spaces.map((sp) => ({
    ...sp,
    pageCount: pages.filter((p) => p.spaceId === sp.id).length,
    canEdit: canEditSpace(ctx, sp),
    restricted: sp.visibilityGroupIds.length > 0,
  }));
}

export async function getSpace(ctx: UserContext, slug: string): Promise<(SpaceRow & { canEdit: boolean }) | null> {
  const space = await db.query.spaces.findFirst({ where: eq(s.spaces.slug, slug) });
  if (!space || !canViewSpace(ctx, space)) return null;
  return { ...space, canEdit: canEditSpace(ctx, space) };
}

/** Spaces the user may create pages in. */
export async function editableSpaces(ctx: UserContext): Promise<SpaceRow[]> {
  const spaces = await db.select().from(s.spaces).orderBy(asc(s.spaces.sortOrder), asc(s.spaces.name));
  return spaces.filter((sp) => canEditSpace(ctx, sp));
}

// ---------------------------------------------------------------------------------------------
// Page listings

/** Pages in one space the user can read. Editors also see drafts and archived pages. */
export async function listSpacePages(ctx: UserContext, space: SpaceRow): Promise<PageSummary[]> {
  const editor = canEditSpace(ctx, space);
  const rows = await selectSummaries()
    .where(and(eq(s.pages.spaceId, space.id), editor ? undefined : eq(s.pages.status, "published")))
    .orderBy(asc(s.pages.title));
  return rows
    .filter(visibleTo(ctx))
    .filter((r) => editor || r.status === "published" || r.ownerId === ctx.user.id)
    .map((r) => summarise(r));
}

export async function recentlyUpdated(ctx: UserContext, limit = 8): Promise<PageSummary[]> {
  const rows = await selectSummaries().where(eq(s.pages.status, "published")).orderBy(desc(s.pages.updatedAt)).limit(200);
  return rows.filter(visibleTo(ctx)).slice(0, limit).map((r) => summarise(r));
}

/** Published pages the user owns that are due for review soon or already stale. */
export async function needsMyReview(ctx: UserContext): Promise<PageSummary[]> {
  const rows = await selectSummaries()
    .where(and(eq(s.pages.status, "published"), eq(s.pages.ownerId, ctx.user.id)))
    .orderBy(asc(s.pages.reviewBy));
  return rows
    .filter(visibleTo(ctx))
    .map((r) => summarise(r))
    .filter((p) => p.freshness === "due-soon" || p.freshness === "stale" || p.freshness === "unset");
}

/** Drafts the user owns, across spaces. */
export async function myDrafts(ctx: UserContext): Promise<PageSummary[]> {
  const rows = await selectSummaries()
    .where(and(eq(s.pages.status, "draft"), eq(s.pages.ownerId, ctx.user.id)))
    .orderBy(desc(s.pages.updatedAt));
  return rows.filter(visibleTo(ctx)).map((r) => summarise(r));
}

// ---------------------------------------------------------------------------------------------
// One page

export interface PageDetail {
  space: SpaceRow;
  page: PageRow;
  owner: { id: string; name: string; title: string | null; avatarUrl: string | null } | null;
  verifiedBy: { id: string; name: string } | null;
  parent: { slug: string; title: string } | null;
  freshness: FreshnessState;
  canEdit: boolean;
  canReview: boolean;
}

async function loadDetail(ctx: UserContext, space: SpaceRow, page: PageRow): Promise<PageDetail | null> {
  if (!canViewPage(ctx, space, page)) return null;
  const canEdit = canEditSpace(ctx, space);
  // Drafts and archived pages are visible to editors and to their owner only.
  if (page.status !== "published" && !canEdit && page.ownerId !== ctx.user.id) return null;
  const ids = [page.ownerId, page.verifiedById].filter(Boolean) as string[];
  const people = ids.length
    ? await db
        .select({ id: s.users.id, name: s.users.displayName, title: s.users.title, avatarUrl: s.users.avatarUrl })
        .from(s.users)
        .where(inArray(s.users.id, ids))
    : [];
  const parent = page.parentId
    ? ((await db.query.pages.findFirst({ where: eq(s.pages.id, page.parentId), columns: { slug: true, title: true, visibilityGroupIds: true } })) ?? null)
    : null;
  return {
    space,
    page,
    owner: people.find((p) => p.id === page.ownerId) ?? null,
    verifiedBy: people.find((p) => p.id === page.verifiedById) ?? null,
    parent: parent && canViewPage(ctx, space, parent) ? { slug: parent.slug, title: parent.title } : null,
    freshness: freshnessState(page.reviewBy),
    canEdit,
    canReview: canReviewPage(ctx, space, page),
  };
}

/** A page the user may read, by its space and page slug. Null when absent OR not visible (never leak existence). */
export async function getPageBySlug(ctx: UserContext, spaceSlug: string, pageSlug: string): Promise<PageDetail | null> {
  const [row] = await db
    .select({ page: s.pages, space: s.spaces })
    .from(s.pages)
    .innerJoin(s.spaces, eq(s.spaces.id, s.pages.spaceId))
    .where(and(eq(s.spaces.slug, spaceSlug), eq(s.pages.slug, pageSlug)))
    .limit(1);
  if (!row) return null;
  return loadDetail(ctx, row.space, row.page);
}

export async function getPageById(ctx: UserContext, pageId: string): Promise<PageDetail | null> {
  if (!isUuid(pageId)) return null;
  const [row] = await db
    .select({ page: s.pages, space: s.spaces })
    .from(s.pages)
    .innerJoin(s.spaces, eq(s.spaces.id, s.pages.spaceId))
    .where(eq(s.pages.id, pageId))
    .limit(1);
  if (!row) return null;
  return loadDetail(ctx, row.space, row.page);
}

async function requirePage(ctx: UserContext, pageId: string): Promise<PageDetail> {
  const d = await getPageById(ctx, pageId);
  if (!d) throw new KnowledgeError("That page does not exist or you cannot see it.", "not_found");
  return d;
}

// ---------------------------------------------------------------------------------------------
// Writing

export interface SavePageInput {
  id?: string;
  spaceId: string;
  parentId?: string | null;
  title: string;
  content: DocNode;
  template: PageTemplate;
  ownerId: string | null;
  reviewBy: string | null;
  visibilityGroupIds: string[];
  /** "save" keeps the current status (a draft stays a draft); "publish" publishes. */
  action: "save" | "publish";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEMPLATE_KEYS: PageTemplate[] = ["blank", "policy", "how-to", "team", "onboarding-guide"];

async function uniqueSlug(spaceId: string, title: string, exceptId?: string): Promise<string> {
  const base = slugify(title);
  const taken = new Set(
    (
      await db
        .select({ slug: s.pages.slug })
        .from(s.pages)
        .where(and(eq(s.pages.spaceId, spaceId), sql`${s.pages.slug} like ${`${base}%`}`, exceptId ? ne(s.pages.id, exceptId) : undefined))
    ).map((r) => r.slug),
  );
  if (!taken.has(base) && base !== "new" && base !== "edit") return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Validates and saves a page. Returns the saved row. Re-checks every id it is given. */
export async function savePage(ctx: UserContext, input: SavePageInput): Promise<PageRow> {
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new KnowledgeError("Give the page a title.");
  if (!isUuid(input.spaceId)) throw new KnowledgeError("Choose a space.");
  if (!TEMPLATE_KEYS.includes(input.template)) throw new KnowledgeError("Unknown template.");
  const space = await db.query.spaces.findFirst({ where: eq(s.spaces.id, input.spaceId) });
  if (!space || !canEditSpace(ctx, space)) throw new KnowledgeError("You cannot edit pages in that space.", "forbidden");

  const existing = input.id ? await getPageById(ctx, input.id) : null;
  if (input.id && !existing) throw new KnowledgeError("That page does not exist or you cannot see it.", "not_found");
  if (existing && !existing.canEdit) throw new KnowledgeError("You cannot edit this page.", "forbidden");
  if (existing && existing.space.id !== space.id) {
    // Moving between spaces: the source space must be editable too.
    if (!canEditSpace(ctx, existing.space)) throw new KnowledgeError("You cannot move this page.", "forbidden");
  }

  let parentId: string | null = null;
  if (input.parentId) {
    if (!isUuid(input.parentId)) throw new KnowledgeError("Unknown parent page.");
    const parent = await db.query.pages.findFirst({ where: eq(s.pages.id, input.parentId) });
    if (!parent || parent.spaceId !== space.id || !canViewPage(ctx, space, parent)) throw new KnowledgeError("The parent page must be in the same space.");
    if (existing && (await isDescendant(parent.id, existing.page.id))) throw new KnowledgeError("A page cannot sit under itself.");
    parentId = parent.id;
  }

  let ownerId: string | null = null;
  if (input.ownerId) {
    if (!isUuid(input.ownerId)) throw new KnowledgeError("Unknown owner.");
    const owner = await db.query.users.findFirst({ where: and(eq(s.users.id, input.ownerId), eq(s.users.status, "active")), columns: { id: true } });
    if (!owner) throw new KnowledgeError("The owner must be an active person.");
    ownerId = owner.id;
  }

  const groupIds = [...new Set(input.visibilityGroupIds.filter(isUuid))];
  if (groupIds.length) {
    const found = await db.select({ id: s.groups.id }).from(s.groups).where(inArray(s.groups.id, groupIds));
    if (found.length !== groupIds.length) throw new KnowledgeError("One of the selected groups no longer exists.");
  }

  const reviewBy = input.reviewBy && ISO_DATE.test(input.reviewBy) ? input.reviewBy : null;
  const status: PageStatus = input.action === "publish" ? "published" : (existing?.page.status ?? "draft");
  if (status === "published") {
    if (!ownerId) throw new KnowledgeError("Published pages need an owner who keeps them up to date.");
    if (!reviewBy) throw new KnowledgeError("Published pages need a review-by date.");
    if (reviewBy < todayIso()) throw new KnowledgeError("The review-by date must be today or later.");
  }

  const content = asDoc(input.content);
  const contentText = docToText(content);
  const now = new Date();
  const values = {
    spaceId: space.id,
    parentId,
    title,
    content: content as unknown as Record<string, unknown>,
    contentText,
    template: input.template,
    ownerId,
    reviewBy,
    visibilityGroupIds: groupIds,
    status,
  };

  let saved: PageRow;
  if (existing) {
    const publishingNow = status === "published" && existing.page.status !== "published";
    [saved] = (await db
      .update(s.pages)
      .set({
        ...values,
        slug: existing.space.id !== space.id ? await uniqueSlug(space.id, title, existing.page.id) : existing.page.slug,
        publishedAt: publishingNow ? now : existing.page.publishedAt,
        archivedAt: status === "published" ? null : existing.page.archivedAt,
        // Saving a reviewed date that moved forward counts as re-verification.
        ...(status === "published" && reviewBy !== existing.page.reviewBy ? { lastReminder: null } : {}),
      })
      .where(eq(s.pages.id, existing.page.id))
      .returning()) as [PageRow];
  } else {
    [saved] = (await db
      .insert(s.pages)
      .values({
        ...values,
        slug: await uniqueSlug(space.id, title),
        publishedAt: status === "published" ? now : null,
        verifiedAt: status === "published" ? now : null,
        verifiedById: status === "published" ? ctx.user.id : null,
      })
      .returning()) as [PageRow];
  }

  if (saved.status === "published") {
    await db.insert(s.pageVersions).values({ pageId: saved.id, title: saved.title, content: saved.content, authorId: ctx.user.id });
  }
  await indexPage(saved.id);
  await audit(ctx.user.id, existing ? (input.action === "publish" ? "knowledge.page_published" : "knowledge.page_updated") : "knowledge.page_created", {
    type: "page",
    id: saved.id,
  }, { title: saved.title, status: saved.status });
  return saved;
}

async function isDescendant(candidateId: string, ancestorId: string): Promise<boolean> {
  let cur: string | null = candidateId;
  for (let hops = 0; cur && hops < 50; hops++) {
    if (cur === ancestorId) return true;
    const row: { parentId: string | null } | undefined = await db.query.pages.findFirst({ where: eq(s.pages.id, cur), columns: { parentId: true } });
    cur = row?.parentId ?? null;
  }
  return false;
}

export async function setPageStatus(ctx: UserContext, pageId: string, status: "archived" | "draft"): Promise<PageRow> {
  const d = await requirePage(ctx, pageId);
  if (!d.canEdit) throw new KnowledgeError("You cannot change this page.", "forbidden");
  const [row] = (await db
    .update(s.pages)
    .set({ status, archivedAt: status === "archived" ? new Date() : null })
    .where(eq(s.pages.id, pageId))
    .returning()) as [PageRow];
  await indexPage(pageId);
  await audit(ctx.user.id, status === "archived" ? "knowledge.page_archived" : "knowledge.page_unpublished", { type: "page", id: pageId }, { title: row.title });
  return row;
}

/** Owner or editor confirms the page is accurate: verified now, next review one interval out. */
export async function markReviewed(ctx: UserContext, pageId: string, intervalDays = REVIEW_INTERVAL_DAYS): Promise<PageRow> {
  const d = await requirePage(ctx, pageId);
  if (!d.canReview) throw new KnowledgeError("Only the owner or an editor can review this page.", "forbidden");
  if (d.page.status !== "published") throw new KnowledgeError("Only published pages can be reviewed.");
  const [row] = (await db
    .update(s.pages)
    .set({ verifiedAt: new Date(), verifiedById: ctx.user.id, reviewBy: addDays(todayIso(), intervalDays), lastReminder: null })
    .where(eq(s.pages.id, pageId))
    .returning()) as [PageRow];
  await indexPage(pageId);
  await audit(ctx.user.id, "knowledge.page_reviewed", { type: "page", id: pageId }, { reviewBy: row.reviewBy });
  return row;
}

// ---------------------------------------------------------------------------------------------
// Versions

export async function listVersions(ctx: UserContext, pageId: string) {
  const d = await requirePage(ctx, pageId);
  if (!d.canEdit && d.page.ownerId !== ctx.user.id) throw new KnowledgeError("Only editors can see version history.", "forbidden");
  return db
    .select({ id: s.pageVersions.id, title: s.pageVersions.title, createdAt: s.pageVersions.createdAt, authorName: s.users.displayName })
    .from(s.pageVersions)
    .leftJoin(s.users, eq(s.users.id, s.pageVersions.authorId))
    .where(eq(s.pageVersions.pageId, pageId))
    .orderBy(desc(s.pageVersions.createdAt))
    .limit(50);
}

export async function getVersion(ctx: UserContext, versionId: string) {
  if (!isUuid(versionId)) return null;
  const v = await db.query.pageVersions.findFirst({ where: eq(s.pageVersions.id, versionId) });
  if (!v) return null;
  const d = await getPageById(ctx, v.pageId);
  if (!d || (!d.canEdit && d.page.ownerId !== ctx.user.id)) return null;
  return v;
}

/** Restores an old version as the current content. The restore is itself saved as a new version. */
export async function restoreVersion(ctx: UserContext, versionId: string): Promise<PageRow> {
  const v = await getVersion(ctx, versionId);
  if (!v) throw new KnowledgeError("That version does not exist.", "not_found");
  const d = await requirePage(ctx, v.pageId);
  if (!d.canEdit) throw new KnowledgeError("You cannot edit this page.", "forbidden");
  const content = asDoc(v.content);
  const [row] = (await db
    .update(s.pages)
    .set({ title: v.title, content: v.content, contentText: docToText(content) })
    .where(eq(s.pages.id, v.pageId))
    .returning()) as [PageRow];
  if (row.status === "published") {
    await db.insert(s.pageVersions).values({ pageId: row.id, title: row.title, content: row.content, authorId: ctx.user.id });
  }
  await indexPage(row.id);
  await audit(ctx.user.id, "knowledge.version_restored", { type: "page", id: row.id }, { versionId });
  return row;
}

// ---------------------------------------------------------------------------------------------
// Acknowledgements

export async function hasAcknowledged(userId: string, pageId: string): Promise<boolean> {
  if (!isUuid(userId) || !isUuid(pageId)) return false;
  const [row] = await db
    .select({ id: s.pageAcknowledgements.id })
    .from(s.pageAcknowledgements)
    .where(and(eq(s.pageAcknowledgements.userId, userId), eq(s.pageAcknowledgements.pageId, pageId)))
    .limit(1);
  return !!row;
}

export async function acknowledgementInfo(userId: string, pageId: string) {
  const [mine] = await db
    .select({ at: s.pageAcknowledgements.createdAt })
    .from(s.pageAcknowledgements)
    .where(and(eq(s.pageAcknowledgements.userId, userId), eq(s.pageAcknowledgements.pageId, pageId)))
    .limit(1);
  const [total] = await db.select({ n: count() }).from(s.pageAcknowledgements).where(eq(s.pageAcknowledgements.pageId, pageId));
  return { acknowledgedAt: mine?.at ?? null, total: total?.n ?? 0 };
}

/** Records "I have read and understood this". Idempotent. */
export async function acknowledgePage(ctx: UserContext, pageId: string): Promise<{ acknowledgedAt: Date }> {
  const d = await requirePage(ctx, pageId);
  if (d.page.status !== "published") throw new KnowledgeError("Only published pages can be acknowledged.");
  await db.insert(s.pageAcknowledgements).values({ pageId, userId: ctx.user.id }).onConflictDoNothing();
  const info = await acknowledgementInfo(ctx.user.id, pageId);
  await audit(ctx.user.id, "knowledge.page_acknowledged", { type: "page", id: pageId });
  return { acknowledgedAt: info.acknowledgedAt ?? new Date() };
}

// ---------------------------------------------------------------------------------------------
// Content health and the freshness engine

export interface HealthRow extends PageSummary {
  readable: boolean;
}

/** Every published page, oldest review date first. For admins and content editors. */
export async function contentHealth(ctx: UserContext): Promise<HealthRow[]> {
  if (!ctx.has("admin") && !ctx.has("content-editor")) throw new KnowledgeError("Only admins and content editors can see content health.", "forbidden");
  const rows = await selectSummaries()
    .where(eq(s.pages.status, "published"))
    .orderBy(sql`${s.pages.reviewBy} asc nulls first`, asc(s.pages.title));
  const can = visibleTo(ctx);
  return rows.map((r) => ({ ...summarise(r), readable: can(r) }));
}

async function sendReviewNotice(page: { id: string; title: string; ownerId: string; reviewBy: string | null; spaceSlug: string; slug: string }, kind: "soon" | "due" | "nudge" | "archived") {
  const href = pageUrl(page.spaceSlug, page.slug);
  const due = page.reviewBy ? new Date(`${page.reviewBy}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "";
  const copy = {
    soon: { title: `Review "${page.title}" by ${due}`, body: "You own this page. Check it is still right, then mark it as reviewed." },
    due:
      page.reviewBy && page.reviewBy < todayIso()
        ? { title: `"${page.title}" is past its review date`, body: "Readers now see it as stale and it ranks lower in search. Check it is still right, then mark it as reviewed." }
        : { title: `"${page.title}" is due for review today`, body: "Check it is still right, then mark it as reviewed. Tomorrow readers will see it as stale." },
    nudge: { title: `Please review "${page.title}"`, body: `Its review date ${page.reviewBy && page.reviewBy < todayIso() ? "has passed" : `is ${due}`}. Check it is still right, then mark it as reviewed.` },
    archived: {
      title: `"${page.title}" was archived`,
      body: `It was more than ${ARCHIVE_AFTER_STALE_DAYS} days past its review date. Restore it from the page if it is still needed.`,
    },
  }[kind];
  await notify(page.ownerId, { kind: "knowledge.review", title: copy.title, body: copy.body, href, email: kind !== "nudge" });
}

/** Sends a one-off reminder to the owners of the given pages. Returns how many owners were reminded. */
export async function remindOwners(ctx: UserContext, pageIds: string[]): Promise<number> {
  if (!ctx.has("admin") && !ctx.has("content-editor")) throw new KnowledgeError("Only admins and content editors can remind owners.", "forbidden");
  const ids = pageIds.filter(isUuid).slice(0, 200);
  if (!ids.length) return 0;
  const rows = await db
    .select({ id: s.pages.id, title: s.pages.title, ownerId: s.pages.ownerId, reviewBy: s.pages.reviewBy, slug: s.pages.slug, spaceSlug: s.spaces.slug })
    .from(s.pages)
    .innerJoin(s.spaces, eq(s.spaces.id, s.pages.spaceId))
    .where(and(inArray(s.pages.id, ids), eq(s.pages.status, "published"), isNotNull(s.pages.ownerId)));
  const owners = new Set<string>();
  for (const r of rows) {
    await sendReviewNotice({ ...r, ownerId: r.ownerId! }, "nudge");
    owners.add(r.ownerId!);
  }
  await audit(ctx.user.id, "knowledge.owners_reminded", undefined, { pageIds: rows.map((r) => r.id), owners: owners.size });
  return owners.size;
}

export interface FreshnessTickResult {
  remindedSoon: number;
  remindedDue: number;
  archived: number;
  reindexed: number;
}

/**
 * The daily freshness tick: reminds owners 14 days before and on the review date, archives pages
 * stale for more than ARCHIVE_AFTER_STALE_DAYS, and refreshes every page's search freshness factor.
 */
export async function freshnessTick(today = todayIso()): Promise<FreshnessTickResult> {
  const rows = await db
    .select({
      id: s.pages.id,
      title: s.pages.title,
      slug: s.pages.slug,
      ownerId: s.pages.ownerId,
      reviewBy: s.pages.reviewBy,
      lastReminder: s.pages.lastReminder,
      spaceSlug: s.spaces.slug,
    })
    .from(s.pages)
    .innerJoin(s.spaces, eq(s.spaces.id, s.pages.spaceId))
    .where(eq(s.pages.status, "published"));
  const result: FreshnessTickResult = { remindedSoon: 0, remindedDue: 0, archived: 0, reindexed: 0 };
  for (const p of rows) {
    if (shouldArchive(p.reviewBy, today)) {
      await db.update(s.pages).set({ status: "archived", archivedAt: new Date() }).where(eq(s.pages.id, p.id));
      if (p.ownerId) await sendReviewNotice({ ...p, ownerId: p.ownerId }, "archived");
      await audit(null, "knowledge.page_auto_archived", { type: "page", id: p.id }, { reviewBy: p.reviewBy });
      await indexPage(p.id);
      result.archived++;
      continue;
    }
    const kind = reminderToSend(p, today);
    if (kind && p.ownerId) {
      await sendReviewNotice({ ...p, ownerId: p.ownerId }, kind);
      // Bookkeeping, not an edit: keep updated_at so the page does not read as "updated just now".
      await db.update(s.pages).set({ lastReminder: `${p.reviewBy}:${kind}`, updatedAt: sql`${s.pages.updatedAt}` }).where(eq(s.pages.id, p.id));
      if (kind === "soon") result.remindedSoon++;
      else result.remindedDue++;
    }
    await indexPage(p.id);
    result.reindexed++;
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Pickers for the editor

export async function listGroups() {
  return db.select({ id: s.groups.id, name: s.groups.name, displayName: s.groups.displayName }).from(s.groups).orderBy(asc(s.groups.displayName));
}

export async function listPeopleForOwner() {
  return db
    .select({ id: s.users.id, name: s.users.displayName, title: s.users.title })
    .from(s.users)
    .where(and(eq(s.users.status, "active"), eq(s.users.isBreakGlass, false)))
    .orderBy(asc(s.users.displayName));
}

// ---------------------------------------------------------------------------------------------
// Starter content for a brand-new company (setup wizard). Idempotent.

const STARTER: { slug: string; name: string; icon: string; description: string; pages: { slug: string; title: string; template: PageTemplate; body: string }[] }[] = [
  {
    slug: "company",
    name: "Company",
    icon: "building-2",
    description: "Who we are, how we work and where to find things.",
    pages: [
      {
        slug: "welcome",
        title: "Welcome",
        template: "blank",
        body: `This is your company's knowledge base. Every page has an owner and a review date, so what you read here stays true.

## Where to start

- Read the employee handbook in the People space
- Set up your laptop with the guides in the IT space
- Raise a ticket in [Help](/help/new) when you cannot find an answer`,
      },
    ],
  },
  {
    slug: "people",
    name: "People",
    icon: "users",
    description: "Policies, leave and benefits.",
    pages: [
      {
        slug: "employee-handbook",
        title: "Employee handbook",
        template: "policy",
        body: `## Summary

How we work together: hours, leave, expenses and conduct. Replace this text with your own policies.

## Working hours

Describe core hours and flexible working.

## Leave

Describe annual leave, sick leave and how to book time off.

## Questions

Raise a ticket in [Help](/help/new).`,
      },
    ],
  },
  {
    slug: "it",
    name: "IT",
    icon: "laptop",
    description: "Laptops, accounts, security and getting help.",
    pages: [
      {
        slug: "password-and-mfa",
        title: "Passwords and multi-factor authentication",
        template: "how-to",
        body: `## Before you start

- Your company email address
- An authenticator app on your phone

## Steps

1. Sign in to your company account
2. Open your security settings and add an authenticator app
3. Save your recovery codes in your password manager

## If something goes wrong

:::info
Locked out? Raise a ticket in [Help](/help/new) from a colleague's device.
:::`,
      },
    ],
  },
];

export async function installStarterContent(ownerId?: string | null): Promise<{ spaces: number; pages: number }> {
  let spacesMade = 0;
  let pagesMade = 0;
  const today = todayIso();
  for (const [i, sp] of STARTER.entries()) {
    let space = await db.query.spaces.findFirst({ where: eq(s.spaces.slug, sp.slug) });
    if (!space) {
      [space] = await db
        .insert(s.spaces)
        .values({ slug: sp.slug, name: sp.name, icon: sp.icon, description: sp.description, sortOrder: i })
        .onConflictDoNothing()
        .returning();
      if (!space) space = await db.query.spaces.findFirst({ where: eq(s.spaces.slug, sp.slug) });
      else spacesMade++;
    }
    if (!space) continue;
    for (const p of sp.pages) {
      const doc = markdownToDoc(p.body);
      const [row] = await db
        .insert(s.pages)
        .values({
          spaceId: space.id,
          slug: p.slug,
          title: p.title,
          template: p.template,
          content: doc as unknown as Record<string, unknown>,
          contentText: docToText(doc as DocNode),
          ownerId: ownerId ?? null,
          status: ownerId ? "published" : "draft",
          reviewBy: addDays(today, 90),
          verifiedAt: ownerId ? new Date() : null,
          publishedAt: ownerId ? new Date() : null,
        })
        .onConflictDoNothing()
        .returning({ id: s.pages.id });
      if (row) {
        pagesMade++;
        await indexPage(row.id);
      }
    }
  }
  return { spaces: spacesMade, pages: pagesMade };
}

