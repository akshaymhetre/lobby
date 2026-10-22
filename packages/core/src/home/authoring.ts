/**
 * Content authoring for the home page: news posts (content editors and admins), announcements
 * and home cards (admins). Every write is audited; posts are sanitized and reindexed.
 */
import { and, asc, db, desc, eq, inArray, isNull, s, sql } from "@lobby/db";
import { audit } from "../audit";
import type { UserContext } from "../identity/context";
import { indexPost } from "./index-source";
import { htmlTextLength, safeHref, sanitizePostHtml } from "./sanitize";

export class ContentError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const canAuthorPosts = (ctx: UserContext) => ctx.has("admin") || ctx.has("content-editor");

function requireAuthor(ctx: UserContext) {
  if (!canAuthorPosts(ctx)) throw new ContentError("Only content editors and admins can publish news.");
}
function requireAdmin(ctx: UserContext) {
  if (!ctx.has("admin")) throw new ContentError("Only admins can change this.");
}

async function validGroupIds(ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const rows = await db.select({ id: s.groups.id }).from(s.groups).where(inArray(s.groups.id, unique));
  return rows.map((r) => r.id);
}

async function safeIndex(id: string) {
  try {
    await indexPost(id);
  } catch (e) {
    console.error("[home] post reindex failed", e);
  }
}

// ---------------------------------------------------------------- posts

export interface PostInput {
  title: string;
  summary?: string | null;
  category: string;
  coverImageUrl?: string | null;
  bodyHtml: string;
  audienceGroupIds: string[];
  pinned: boolean;
  /** true = published (now, or keep the original date); false = draft. */
  publish: boolean;
}

export const POST_CATEGORIES = ["Company", "People", "Engineering", "Workplace", "Culture", "Sales", "Product"];

function cleanPost(input: PostInput) {
  const errors: Record<string, string> = {};
  const title = input.title.trim().replace(/\s+/g, " ");
  if (!title) errors.title = "Give the post a headline.";
  else if (title.length > 140) errors.title = "Keep the headline under 140 characters.";
  const summary = input.summary?.trim() || null;
  if (summary && summary.length > 280) errors.summary = "Keep the summary under 280 characters.";
  const category = input.category.trim() || "News";
  if (category.length > 40) errors.category = "Keep the category short.";
  let cover = input.coverImageUrl?.trim() || null;
  if (cover && !cover.startsWith("https://") && !(cover.startsWith("/") && !cover.startsWith("//"))) {
    errors.coverImageUrl = "Use an https:// image address.";
    cover = null;
  }
  const body = sanitizePostHtml(input.bodyHtml ?? "");
  if (input.publish && htmlTextLength(body) === 0) errors.body = "Write the post before publishing it.";
  if (body.length > 200_000) errors.body = "That post is too long.";
  if (Object.keys(errors).length) throw new ContentError("Some fields need attention.", errors);
  return { title, summary, category, coverImageUrl: cover, body };
}

export async function createPost(ctx: UserContext, input: PostInput): Promise<{ id: string }> {
  requireAuthor(ctx);
  const v = cleanPost(input);
  const audienceGroupIds = await validGroupIds(input.audienceGroupIds);
  const [row] = await db
    .insert(s.posts)
    .values({
      ...v,
      authorId: ctx.user.id,
      audienceGroupIds,
      pinned: input.pinned,
      publishedAt: input.publish ? new Date() : null,
    })
    .returning({ id: s.posts.id });
  await audit(ctx.user.id, input.publish ? "post.published" : "post.drafted", { type: "post", id: row!.id }, {
    title: v.title,
    audienceGroupIds,
  });
  await safeIndex(row!.id);
  return row!;
}

export async function updatePost(ctx: UserContext, id: string, input: PostInput): Promise<{ id: string }> {
  requireAuthor(ctx);
  const before = await db.query.posts.findFirst({ where: eq(s.posts.id, id) });
  if (!before) throw new ContentError("That post no longer exists.");
  const v = cleanPost(input);
  const audienceGroupIds = await validGroupIds(input.audienceGroupIds);
  const publishedAt = input.publish ? (before.publishedAt ?? new Date()) : null;
  await db
    .update(s.posts)
    .set({ ...v, audienceGroupIds, pinned: input.pinned, publishedAt })
    .where(eq(s.posts.id, id));
  const action = !before.publishedAt && input.publish ? "post.published" : before.publishedAt && !input.publish ? "post.unpublished" : "post.updated";
  await audit(ctx.user.id, action, { type: "post", id }, { title: v.title, audienceGroupIds, pinned: input.pinned });
  await safeIndex(id);
  return { id };
}

export async function deletePost(ctx: UserContext, id: string): Promise<void> {
  requireAuthor(ctx);
  const before = await db.query.posts.findFirst({ where: eq(s.posts.id, id) });
  if (!before) return;
  await db.delete(s.posts).where(eq(s.posts.id, id));
  await audit(ctx.user.id, "post.deleted", { type: "post", id }, { title: before.title });
  await safeIndex(id);
}

export async function getPostForEdit(ctx: UserContext, id: string) {
  requireAuthor(ctx);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await db.query.posts.findFirst({ where: eq(s.posts.id, id) })) ?? null;
}

export async function listDrafts(ctx: UserContext) {
  if (!canAuthorPosts(ctx)) return [];
  return db
    .select({
      id: s.posts.id,
      title: s.posts.title,
      summary: s.posts.summary,
      category: s.posts.category,
      updatedAt: s.posts.updatedAt,
      authorName: s.users.displayName,
    })
    .from(s.posts)
    .leftJoin(s.users, eq(s.users.id, s.posts.authorId))
    .where(isNull(s.posts.publishedAt))
    .orderBy(desc(s.posts.updatedAt));
}

export async function listPostCategories(): Promise<string[]> {
  const rows = await db.selectDistinct({ c: s.posts.category }).from(s.posts);
  return [...new Set([...POST_CATEGORIES, ...rows.map((r) => r.c)])];
}

// ---------------------------------------------------------------- announcements

export interface AnnouncementInput {
  title: string;
  body: string;
  severity: "info" | "important" | "critical";
  mustAcknowledge: boolean;
  audienceGroupIds: string[];
  startsAt: Date;
  endsAt: Date | null;
}

function cleanAnnouncement(input: AnnouncementInput) {
  const errors: Record<string, string> = {};
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) errors.title = "Add a title.";
  else if (title.length > 140) errors.title = "Keep the title under 140 characters.";
  if (!body) errors.body = "Say what people need to know.";
  else if (body.length > 1000) errors.body = "Keep it under 1,000 characters. Link to a page for the details.";
  if (Number.isNaN(input.startsAt.getTime())) errors.startsAt = "Pick a start date.";
  if (input.endsAt && Number.isNaN(input.endsAt.getTime())) errors.endsAt = "Pick a valid end date.";
  if (input.endsAt && !errors.startsAt && input.endsAt <= input.startsAt) errors.endsAt = "The end has to be after the start.";
  if (Object.keys(errors).length) throw new ContentError("Some fields need attention.", errors);
  return { title, body, severity: input.severity, mustAcknowledge: input.mustAcknowledge, startsAt: input.startsAt, endsAt: input.endsAt };
}

/** Active people an audience (empty = everyone) covers. Break-glass accounts are excluded. */
async function audienceMembers(audienceGroupIds: string[]) {
  const base = and(eq(s.users.status, "active"), eq(s.users.isBreakGlass, false));
  if (!audienceGroupIds.length) {
    return db
      .select({ id: s.users.id, name: s.users.displayName, title: s.users.title, department: s.users.department, avatarUrl: s.users.avatarUrl })
      .from(s.users)
      .where(base)
      .orderBy(asc(s.users.displayName));
  }
  return db
    .selectDistinct({ id: s.users.id, name: s.users.displayName, title: s.users.title, department: s.users.department, avatarUrl: s.users.avatarUrl })
    .from(s.users)
    .innerJoin(s.groupMembers, eq(s.groupMembers.userId, s.users.id))
    .where(and(base, inArray(s.groupMembers.groupId, audienceGroupIds)))
    .orderBy(asc(s.users.displayName));
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: "info" | "important" | "critical";
  mustAcknowledge: boolean;
  audienceGroupIds: string[];
  startsAt: Date;
  endsAt: Date | null;
  authorName: string | null;
  audienceSize: number;
  acknowledged: number;
}

export async function listAnnouncementsAdmin(ctx: UserContext): Promise<AdminAnnouncement[]> {
  requireAdmin(ctx);
  const rows = await db
    .select({ a: s.announcements, authorName: s.users.displayName })
    .from(s.announcements)
    .leftJoin(s.users, eq(s.users.id, s.announcements.authorId))
    .orderBy(desc(s.announcements.startsAt));
  const out: AdminAnnouncement[] = [];
  for (const { a, authorName } of rows) {
    const members = await audienceMembers(a.audienceGroupIds);
    const ids = members.map((m) => m.id);
    const [ack] = ids.length
      ? await db
          .select({ n: sql<number>`count(*)::int` })
          .from(s.announcementReceipts)
          .where(
            and(
              eq(s.announcementReceipts.announcementId, a.id),
              inArray(s.announcementReceipts.userId, ids),
              sql`${s.announcementReceipts.acknowledgedAt} is not null`,
            ),
          )
      : [{ n: 0 }];
    out.push({ ...a, authorName, audienceSize: ids.length, acknowledged: ack?.n ?? 0 });
  }
  return out;
}

export async function saveAnnouncement(ctx: UserContext, id: string | null, input: AnnouncementInput): Promise<{ id: string }> {
  requireAdmin(ctx);
  const v = cleanAnnouncement(input);
  const audienceGroupIds = await validGroupIds(input.audienceGroupIds);
  if (id) {
    const before = await db.query.announcements.findFirst({ where: eq(s.announcements.id, id) });
    if (!before) throw new ContentError("That announcement no longer exists.");
    await db.update(s.announcements).set({ ...v, audienceGroupIds }).where(eq(s.announcements.id, id));
    await audit(ctx.user.id, "announcement.updated", { type: "announcement", id }, { title: v.title, audienceGroupIds, mustAcknowledge: v.mustAcknowledge });
    return { id };
  }
  const [row] = await db
    .insert(s.announcements)
    .values({ ...v, audienceGroupIds, authorId: ctx.user.id })
    .returning({ id: s.announcements.id });
  await audit(ctx.user.id, "announcement.created", { type: "announcement", id: row!.id }, { title: v.title, audienceGroupIds, mustAcknowledge: v.mustAcknowledge });
  return row!;
}

export async function deleteAnnouncement(ctx: UserContext, id: string): Promise<void> {
  requireAdmin(ctx);
  const before = await db.query.announcements.findFirst({ where: eq(s.announcements.id, id) });
  if (!before) return;
  await db.delete(s.announcements).where(eq(s.announcements.id, id));
  await audit(ctx.user.id, "announcement.deleted", { type: "announcement", id }, { title: before.title });
}

export interface AckReport {
  total: number;
  acknowledged: { id: string; name: string; title: string | null; department: string | null; avatarUrl: string | null; at: Date }[];
  pending: { id: string; name: string; title: string | null; department: string | null; avatarUrl: string | null }[];
}

export async function acknowledgementReport(ctx: UserContext, id: string): Promise<AckReport | null> {
  requireAdmin(ctx);
  const a = await db.query.announcements.findFirst({ where: eq(s.announcements.id, id) });
  if (!a) return null;
  const members = await audienceMembers(a.audienceGroupIds);
  const receipts = await db
    .select()
    .from(s.announcementReceipts)
    .where(and(eq(s.announcementReceipts.announcementId, id), sql`${s.announcementReceipts.acknowledgedAt} is not null`));
  const at = new Map(receipts.map((r) => [r.userId, r.acknowledgedAt!]));
  return {
    total: members.length,
    acknowledged: members
      .filter((m) => at.has(m.id))
      .map((m) => ({ ...m, at: at.get(m.id)! }))
      .sort((x, y) => y.at.getTime() - x.at.getTime()),
    pending: members.filter((m) => !at.has(m.id)),
  };
}

// ---------------------------------------------------------------- home cards

export type CardType = "links" | "kpi" | "embed";

export interface CardInput {
  type: CardType;
  title: string;
  config: Record<string, unknown>;
  audienceGroupIds: string[];
}

/** Validates and normalises a card's config for its type. Exported for tests. */
export function cleanCardConfig(type: CardType, raw: Record<string, unknown>): Record<string, unknown> {
  const errors: Record<string, string> = {};
  let config: Record<string, unknown> = {};
  if (type === "links") {
    const links = Array.isArray(raw.links) ? raw.links : [];
    const clean: { label: string; href: string; external?: boolean }[] = [];
    links.forEach((l, i) => {
      const label = typeof l?.label === "string" ? l.label.trim() : "";
      const href = typeof l?.href === "string" ? safeHref(l.href) : null;
      if (!label && !l?.href) return;
      if (!label) errors[`links.${i}.label`] = "Add a label.";
      if (!href || href.startsWith("mailto:") || href.startsWith("#")) errors[`links.${i}.href`] = "Use a page path like /help or an https:// address.";
      else clean.push({ label: label.slice(0, 60), href, ...(href.startsWith("https://") || l?.external === true ? { external: true } : {}) });
    });
    if (!clean.length && !Object.keys(errors).length) errors.links = "Add at least one link.";
    if (clean.length > 12) errors.links = "Keep it to 12 links or fewer.";
    config = { links: clean };
  } else if (type === "kpi") {
    const compute = raw.compute === "next-payday" ? "next-payday" : undefined;
    const value = typeof raw.value === "string" ? raw.value.trim().slice(0, 40) : "";
    const hint = typeof raw.hint === "string" ? raw.hint.trim().slice(0, 120) : "";
    if (!compute && !value) errors.value = "Add the number or short value to show.";
    config = { ...(compute ? { compute } : { value }), ...(hint ? { hint } : {}) };
  } else {
    const url = typeof raw.url === "string" ? raw.url.trim() : "";
    if (!url.startsWith("https://")) errors.url = "Embeds must use an https:// address.";
    const height = Math.min(Math.max(Number(raw.height) || 240, 120), 600);
    config = { url, height };
  }
  if (Object.keys(errors).length) throw new ContentError("Some fields need attention.", errors);
  return config;
}

export async function listHomeCardsAdmin(ctx: UserContext) {
  requireAdmin(ctx);
  return db.select().from(s.homeCards).orderBy(asc(s.homeCards.sortOrder), asc(s.homeCards.createdAt));
}

export async function saveHomeCard(ctx: UserContext, id: string | null, input: CardInput): Promise<{ id: string }> {
  requireAdmin(ctx);
  const title = input.title.trim();
  if (!title) throw new ContentError("Some fields need attention.", { title: "Give the card a title." });
  const config = cleanCardConfig(input.type, input.config);
  const audienceGroupIds = await validGroupIds(input.audienceGroupIds);
  if (id) {
    const before = await db.query.homeCards.findFirst({ where: eq(s.homeCards.id, id) });
    if (!before) throw new ContentError("That card no longer exists.");
    await db.update(s.homeCards).set({ type: input.type, title, config, audienceGroupIds }).where(eq(s.homeCards.id, id));
    await audit(ctx.user.id, "home_card.updated", { type: "home_card", id }, { title, cardType: input.type, audienceGroupIds });
    return { id };
  }
  const [max] = await db.select({ n: sql<number>`coalesce(max(${s.homeCards.sortOrder}), -1)::int` }).from(s.homeCards);
  const [row] = await db
    .insert(s.homeCards)
    .values({ type: input.type, title, config, audienceGroupIds, sortOrder: (max?.n ?? -1) + 1 })
    .returning({ id: s.homeCards.id });
  await audit(ctx.user.id, "home_card.created", { type: "home_card", id: row!.id }, { title, cardType: input.type, audienceGroupIds });
  return row!;
}

export async function deleteHomeCard(ctx: UserContext, id: string): Promise<void> {
  requireAdmin(ctx);
  const before = await db.query.homeCards.findFirst({ where: eq(s.homeCards.id, id) });
  if (!before) return;
  await db.delete(s.homeCards).where(eq(s.homeCards.id, id));
  await audit(ctx.user.id, "home_card.deleted", { type: "home_card", id }, { title: before.title });
}

/** Moves a card one place up or down by swapping sort orders with its neighbour. */
export async function moveHomeCard(ctx: UserContext, id: string, delta: -1 | 1): Promise<void> {
  requireAdmin(ctx);
  const cards = await db.select({ id: s.homeCards.id }).from(s.homeCards).orderBy(asc(s.homeCards.sortOrder), asc(s.homeCards.createdAt));
  const i = cards.findIndex((c) => c.id === id);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= cards.length) return;
  const order = cards.map((c) => c.id);
  [order[i], order[j]] = [order[j]!, order[i]!];
  await db.transaction(async (tx) => {
    for (const [sortOrder, cid] of order.entries()) await tx.update(s.homeCards).set({ sortOrder }).where(eq(s.homeCards.id, cid));
  });
  await audit(ctx.user.id, "home_card.reordered", { type: "home_card", id }, { delta });
}
