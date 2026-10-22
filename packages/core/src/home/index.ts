/**
 * Home page domain logic: the Today strip, announcements, the news feed, new joiners and
 * admin-configured home cards. Every read is filtered by the acting user's audience.
 */
import { and, asc, count, db, desc, eq, gte, inArray, isNotNull, lte, ne, or, s, sql } from "@lobby/db";
import { inAudience, type UserContext } from "../identity/context";
import { notify } from "../notify";
import { OPEN_STATUSES } from "../helpdesk/internal";
import { cleanMessage, newJoinerWindow, shouldShowAnnouncement } from "./logic";

export * from "./logic";
export * from "./authoring";
export { sanitizePostHtml } from "./sanitize";

// Open requests use the canonical definition (counts.ts openRequestCount): not resolved, closed or rejected.
const OPEN_TICKET = OPEN_STATUSES;

// ---------------------------------------------------------------- Today

export interface TodayData {
  tasks: { id: string; title: string; dueDate: string; subjectName: string | null }[];
  taskCount: number;
  approvals: { id: string; ticketNumber: number; subject: string; requesterName: string }[];
  approvalCount: number;
  tickets: { id: string; number: number; subject: string; status: string; updatedAt: Date }[];
  ticketCount: number;
}

export async function getToday(ctx: UserContext): Promise<TodayData> {
  const uid = ctx.user.id;
  const stepWhere = and(
    eq(s.journeyStepRuns.assigneeId, uid),
    eq(s.journeyStepRuns.status, "pending"),
    eq(s.journeyRuns.status, "active"),
  );
  const approvalWhere = and(
    eq(s.approvals.status, "pending"),
    or(eq(s.approvals.approverId, uid), ctx.groupIds.length ? inArray(s.approvals.groupId, ctx.groupIds) : undefined),
  );
  const ticketWhere = and(eq(s.tickets.requesterId, uid), inArray(s.tickets.status, [...OPEN_TICKET]));

  const [tasks, [taskCount], approvals, [approvalCount], tickets, [ticketCount]] = await Promise.all([
    db
      .select({
        id: s.journeyStepRuns.id,
        title: s.journeySteps.title,
        dueDate: s.journeyStepRuns.dueDate,
        subjectId: s.journeyRuns.subjectUserId,
        subjectName: s.users.displayName,
      })
      .from(s.journeyStepRuns)
      .innerJoin(s.journeyRuns, eq(s.journeyRuns.id, s.journeyStepRuns.runId))
      .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
      .innerJoin(s.users, eq(s.users.id, s.journeyRuns.subjectUserId))
      .where(stepWhere)
      .orderBy(asc(s.journeyStepRuns.dueDate), asc(s.journeySteps.position))
      .limit(3),
    db
      .select({ n: count() })
      .from(s.journeyStepRuns)
      .innerJoin(s.journeyRuns, eq(s.journeyRuns.id, s.journeyStepRuns.runId))
      .where(stepWhere),
    db
      .select({
        id: s.approvals.id,
        ticketNumber: s.tickets.number,
        subject: s.tickets.subject,
        requesterName: s.users.displayName,
      })
      .from(s.approvals)
      .innerJoin(s.tickets, eq(s.tickets.id, s.approvals.ticketId))
      .innerJoin(s.users, eq(s.users.id, s.tickets.requesterId))
      .where(approvalWhere)
      .orderBy(asc(s.approvals.createdAt))
      .limit(3),
    db.select({ n: count() }).from(s.approvals).where(approvalWhere),
    db
      .select({
        id: s.tickets.id,
        number: s.tickets.number,
        subject: s.tickets.subject,
        status: s.tickets.status,
        updatedAt: s.tickets.updatedAt,
      })
      .from(s.tickets)
      .where(ticketWhere)
      .orderBy(desc(s.tickets.updatedAt))
      .limit(3),
    db.select({ n: count() }).from(s.tickets).where(ticketWhere),
  ]);

  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      subjectName: t.subjectId === uid ? null : t.subjectName,
    })),
    taskCount: taskCount?.n ?? 0,
    approvals,
    approvalCount: approvalCount?.n ?? 0,
    tickets,
    ticketCount: ticketCount?.n ?? 0,
  };
}

// ---------------------------------------------------------------- announcements

export type AnnouncementRow = typeof s.announcements.$inferSelect;

export async function listAnnouncementsFor(ctx: UserContext, now = new Date()): Promise<AnnouncementRow[]> {
  const rows = await db
    .select()
    .from(s.announcements)
    .where(lte(s.announcements.startsAt, now))
    .orderBy(desc(s.announcements.mustAcknowledge), desc(s.announcements.startsAt));
  if (!rows.length) return [];
  const receipts = await db
    .select()
    .from(s.announcementReceipts)
    .where(
      and(
        eq(s.announcementReceipts.userId, ctx.user.id),
        inArray(
          s.announcementReceipts.announcementId,
          rows.map((r) => r.id),
        ),
      ),
    );
  const byId = new Map(receipts.map((r) => [r.announcementId, r]));
  const severityRank = { critical: 0, important: 1, info: 2 } as const;
  return rows
    .filter((a) => shouldShowAnnouncement(a, ctx.groupIds, byId.get(a.id), now))
    .sort((a, b) => Number(b.mustAcknowledge) - Number(a.mustAcknowledge) || severityRank[a.severity] - severityRank[b.severity]);
}

async function visibleAnnouncement(ctx: UserContext, id: string) {
  const a = await db.query.announcements.findFirst({ where: eq(s.announcements.id, id) });
  if (!a || !inAudience(ctx, a.audienceGroupIds)) throw new Error("That announcement is not available.");
  return a;
}

export async function acknowledgeAnnouncement(ctx: UserContext, id: string): Promise<void> {
  await visibleAnnouncement(ctx, id);
  const now = new Date();
  await db
    .insert(s.announcementReceipts)
    .values({ announcementId: id, userId: ctx.user.id, acknowledgedAt: now })
    .onConflictDoUpdate({
      target: [s.announcementReceipts.announcementId, s.announcementReceipts.userId],
      set: { acknowledgedAt: now },
    });
}

export async function dismissAnnouncement(ctx: UserContext, id: string): Promise<void> {
  const a = await visibleAnnouncement(ctx, id);
  if (a.mustAcknowledge) throw new Error("This one needs you to confirm you have read it.");
  const now = new Date();
  await db
    .insert(s.announcementReceipts)
    .values({ announcementId: id, userId: ctx.user.id, dismissedAt: now })
    .onConflictDoUpdate({
      target: [s.announcementReceipts.announcementId, s.announcementReceipts.userId],
      set: { dismissedAt: now },
    });
}

// ---------------------------------------------------------------- news feed

export interface FeedPost {
  id: string;
  title: string;
  summary: string | null;
  coverImageUrl: string | null;
  category: string;
  pinned: boolean;
  publishedAt: Date;
  author: { id: string; name: string; title: string | null; avatarUrl: string | null } | null;
  likeCount: number;
  liked: boolean;
  commentCount: number;
  saved: boolean;
}

/** SQL condition: published, and in the user's audience. */
function postVisibleWhere(ctx: UserContext, now: Date) {
  const groups = ctx.groupIds.length
    ? sql`${s.posts.audienceGroupIds} && ARRAY[${sql.join(
        ctx.groupIds.map((g) => sql`${g}`),
        sql`, `,
      )}]::uuid[]`
    : sql`false`;
  return and(
    isNotNull(s.posts.publishedAt),
    lte(s.posts.publishedAt, now),
    or(sql`cardinality(${s.posts.audienceGroupIds}) = 0`, groups),
  );
}

async function decorate(ctx: UserContext, rows: (typeof s.posts.$inferSelect)[]): Promise<FeedPost[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.authorId).filter((x): x is string => !!x))];
  const [authors, likes, mine, comments, saved] = await Promise.all([
    authorIds.length
      ? db
          .select({ id: s.users.id, name: s.users.displayName, title: s.users.title, avatarUrl: s.users.avatarUrl })
          .from(s.users)
          .where(inArray(s.users.id, authorIds))
      : Promise.resolve([]),
    db
      .select({ postId: s.reactions.postId, n: count() })
      .from(s.reactions)
      .where(and(inArray(s.reactions.postId, ids), eq(s.reactions.kind, "like")))
      .groupBy(s.reactions.postId),
    db
      .select({ postId: s.reactions.postId })
      .from(s.reactions)
      .where(and(inArray(s.reactions.postId, ids), eq(s.reactions.userId, ctx.user.id), eq(s.reactions.kind, "like"))),
    db
      .select({ postId: s.comments.postId, n: count() })
      .from(s.comments)
      .where(inArray(s.comments.postId, ids))
      .groupBy(s.comments.postId),
    db
      .select({ postId: s.savedPosts.postId })
      .from(s.savedPosts)
      .where(and(inArray(s.savedPosts.postId, ids), eq(s.savedPosts.userId, ctx.user.id))),
  ]);
  const authorMap = new Map(authors.map((a) => [a.id, a]));
  const likeMap = new Map(likes.map((l) => [l.postId, l.n]));
  const mineSet = new Set(mine.map((m) => m.postId));
  const commentMap = new Map(comments.map((c) => [c.postId, c.n]));
  const savedSet = new Set(saved.map((x) => x.postId));
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    summary: p.summary,
    coverImageUrl: p.coverImageUrl,
    category: p.category,
    pinned: p.pinned,
    publishedAt: p.publishedAt!,
    author: p.authorId ? (authorMap.get(p.authorId) ?? null) : null,
    likeCount: likeMap.get(p.id) ?? 0,
    liked: mineSet.has(p.id),
    commentCount: commentMap.get(p.id) ?? 0,
    saved: savedSet.has(p.id),
  }));
}

export async function listFeed(
  ctx: UserContext,
  opts: { limit?: number; savedOnly?: boolean; category?: string } = {},
): Promise<FeedPost[]> {
  const now = new Date();
  const conds = [postVisibleWhere(ctx, now)];
  if (opts.category) conds.push(eq(s.posts.category, opts.category));
  if (opts.savedOnly) {
    conds.push(
      inArray(
        s.posts.id,
        db.select({ id: s.savedPosts.postId }).from(s.savedPosts).where(eq(s.savedPosts.userId, ctx.user.id)),
      ),
    );
  }
  const rows = await db
    .select()
    .from(s.posts)
    .where(and(...conds))
    .orderBy(desc(s.posts.pinned), desc(s.posts.publishedAt))
    .limit(Math.min(opts.limit ?? 20, 50));
  return decorate(ctx, rows);
}

export async function listFeedCategories(ctx: UserContext): Promise<string[]> {
  const rows = await db
    .selectDistinct({ c: s.posts.category })
    .from(s.posts)
    .where(postVisibleWhere(ctx, new Date()));
  return rows.map((r) => r.c).sort();
}

export interface PostComment {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; title: string | null; avatarUrl: string | null };
  canDelete: boolean;
}

export interface PostDetail extends FeedPost {
  body: string;
  comments: PostComment[];
}

async function visiblePostRow(ctx: UserContext, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select()
    .from(s.posts)
    .where(and(eq(s.posts.id, id), postVisibleWhere(ctx, new Date())))
    .limit(1);
  return row ?? null;
}

export async function getPost(ctx: UserContext, id: string): Promise<PostDetail | null> {
  const row = await visiblePostRow(ctx, id);
  if (!row) return null;
  const [decorated] = await decorate(ctx, [row]);
  const comments = await db
    .select({
      id: s.comments.id,
      body: s.comments.body,
      createdAt: s.comments.createdAt,
      authorId: s.users.id,
      name: s.users.displayName,
      title: s.users.title,
      avatarUrl: s.users.avatarUrl,
    })
    .from(s.comments)
    .innerJoin(s.users, eq(s.users.id, s.comments.authorId))
    .where(eq(s.comments.postId, id))
    .orderBy(asc(s.comments.createdAt));
  const moderator = ctx.has("admin") || ctx.has("content-editor");
  return {
    ...decorated!,
    body: row.body,
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: { id: c.authorId, name: c.name, title: c.title, avatarUrl: c.avatarUrl },
      canDelete: moderator || c.authorId === ctx.user.id,
    })),
  };
}

async function requirePost(ctx: UserContext, id: string) {
  const row = await visiblePostRow(ctx, id);
  if (!row) throw new Error("That post is not available.");
  return row;
}

/** Toggles the user's like. Returns the new state and count. */
export async function toggleLike(ctx: UserContext, postId: string): Promise<{ liked: boolean; count: number }> {
  await requirePost(ctx, postId);
  const where = and(eq(s.reactions.postId, postId), eq(s.reactions.userId, ctx.user.id), eq(s.reactions.kind, "like"));
  const existing = await db.select().from(s.reactions).where(where).limit(1);
  if (existing.length) await db.delete(s.reactions).where(where);
  else await db.insert(s.reactions).values({ postId, userId: ctx.user.id, kind: "like" }).onConflictDoNothing();
  const [c] = await db
    .select({ n: count() })
    .from(s.reactions)
    .where(and(eq(s.reactions.postId, postId), eq(s.reactions.kind, "like")));
  return { liked: !existing.length, count: c?.n ?? 0 };
}

export async function toggleSave(ctx: UserContext, postId: string): Promise<{ saved: boolean }> {
  await requirePost(ctx, postId);
  const where = and(eq(s.savedPosts.postId, postId), eq(s.savedPosts.userId, ctx.user.id));
  const existing = await db.select().from(s.savedPosts).where(where).limit(1);
  if (existing.length) await db.delete(s.savedPosts).where(where);
  else await db.insert(s.savedPosts).values({ postId, userId: ctx.user.id }).onConflictDoNothing();
  return { saved: !existing.length };
}

export async function addComment(ctx: UserContext, postId: string, body: string): Promise<{ id: string }> {
  const post = await requirePost(ctx, postId);
  const text = cleanMessage(body, 4000);
  const [row] = await db.insert(s.comments).values({ postId, authorId: ctx.user.id, body: text }).returning({ id: s.comments.id });
  if (post.authorId && post.authorId !== ctx.user.id) {
    await notify(post.authorId, {
      kind: "post.comment",
      title: `${ctx.user.displayName} commented on "${post.title}"`,
      body: text.length > 140 ? `${text.slice(0, 137)}...` : text,
      href: `/news/${postId}#comment-${row!.id}`,
    });
  }
  return row!;
}

export async function deleteComment(ctx: UserContext, commentId: string): Promise<void> {
  const c = await db.query.comments.findFirst({ where: eq(s.comments.id, commentId) });
  if (!c) return;
  await requirePost(ctx, c.postId);
  const moderator = ctx.has("admin") || ctx.has("content-editor");
  if (!moderator && c.authorId !== ctx.user.id) throw new Error("You can only delete your own comments.");
  await db.delete(s.comments).where(eq(s.comments.id, commentId));
}

// ---------------------------------------------------------------- new joiners

export interface NewJoiner {
  id: string;
  name: string;
  firstName: string;
  title: string | null;
  department: string | null;
  location: string | null;
  avatarUrl: string | null;
  startDate: string;
  greeted: boolean;
}

export async function listNewJoiners(ctx: UserContext, now = new Date()): Promise<NewJoiner[]> {
  const w = newJoinerWindow(now);
  const rows = await db
    .select()
    .from(s.users)
    .where(
      and(
        eq(s.users.status, "active"),
        ne(s.users.id, ctx.user.id),
        isNotNull(s.users.startDate),
        gte(s.users.startDate, w.from),
        lte(s.users.startDate, w.to),
      ),
    )
    .orderBy(desc(s.users.startDate))
    .limit(12);
  if (!rows.length) return [];
  const greeted = await db
    .select({ to: s.greetings.toUserId })
    .from(s.greetings)
    .where(
      and(
        eq(s.greetings.fromUserId, ctx.user.id),
        inArray(
          s.greetings.toUserId,
          rows.map((r) => r.id),
        ),
      ),
    );
  const greetedSet = new Set(greeted.map((g) => g.to));
  return rows.map((u) => ({
    id: u.id,
    name: u.displayName,
    firstName: u.firstName || u.displayName.split(" ")[0]!,
    title: u.title,
    department: u.department,
    location: u.location,
    avatarUrl: u.avatarUrl,
    startDate: u.startDate!,
    greeted: greetedSet.has(u.id),
  }));
}

export async function sendGreeting(ctx: UserContext, toUserId: string, message: string, now = new Date()): Promise<void> {
  const text = cleanMessage(message, 500);
  if (toUserId === ctx.user.id) throw new Error("You cannot greet yourself.");
  const w = newJoinerWindow(now);
  const target = await db.query.users.findFirst({ where: eq(s.users.id, toUserId) });
  if (!target || target.status !== "active" || !target.startDate || target.startDate < w.from || target.startDate > w.to) {
    throw new Error("You can say hi to people who joined recently or are about to.");
  }
  await db.insert(s.greetings).values({ fromUserId: ctx.user.id, toUserId, message: text });
  await notify(toUserId, {
    kind: "greeting",
    title: `${ctx.user.displayName} said hi`,
    body: text,
    href: `/people/${ctx.user.id}`,
    email: true,
  });
}

// ---------------------------------------------------------------- home cards

export type HomeCardRow = typeof s.homeCards.$inferSelect;

export async function listHomeCards(ctx: UserContext): Promise<HomeCardRow[]> {
  const rows = await db.select().from(s.homeCards).orderBy(asc(s.homeCards.sortOrder), asc(s.homeCards.createdAt));
  return rows.filter((c) => inAudience(ctx, c.audienceGroupIds));
}
