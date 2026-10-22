import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, ts, updatedAt, users } from "./core";

/** Audience targeting: empty array = everyone; otherwise any of these group ids. */
const audience = () => uuid().array().notNull().default([]);

export const announcements = pgTable("announcements", {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  body: text().notNull(),
  severity: text({ enum: ["info", "important", "critical"] }).notNull().default("info"),
  mustAcknowledge: boolean().notNull().default(false),
  audienceGroupIds: audience(),
  startsAt: ts().defaultNow().notNull(),
  endsAt: ts(),
  authorId: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const announcementReceipts = pgTable(
  "announcement_receipts",
  {
    announcementId: uuid().notNull().references(() => announcements.id, { onDelete: "cascade" }),
    userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
    acknowledgedAt: ts(),
    dismissedAt: ts(),
  },
  (t) => [primaryKey({ columns: [t.announcementId, t.userId] })],
);

/** News posts shown in the home feed. Body is sanitized HTML produced by the editor. */
export const posts = pgTable(
  "posts",
  {
    id: uuid().primaryKey().defaultRandom(),
    title: text().notNull(),
    summary: text(),
    body: text().notNull(),
    coverImageUrl: text(),
    category: text().notNull().default("News"),
    authorId: uuid().references(() => users.id, { onDelete: "set null" }),
    audienceGroupIds: audience(),
    pinned: boolean().notNull().default(false),
    publishedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("posts_published_idx").on(t.publishedAt)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    postId: uuid().notNull().references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("comments_post_idx").on(t.postId)],
);

export const reactions = pgTable(
  "reactions",
  {
    postId: uuid().notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text().notNull().default("like"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId, t.kind] })],
);

export const savedPosts = pgTable(
  "saved_posts",
  {
    postId: uuid().notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

/** Admin-configured home dashboard cards (link list, embed, KPI tile). */
export const homeCards = pgTable("home_cards", {
  id: uuid().primaryKey().defaultRandom(),
  type: text({ enum: ["links", "embed", "kpi"] }).notNull(),
  title: text().notNull(),
  config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  audienceGroupIds: audience(),
  sortOrder: integer().notNull().default(0),
  createdAt: createdAt(),
});

/** "Say hi" greetings sent to new joiners. */
export const greetings = pgTable("greetings", {
  id: uuid().primaryKey().defaultRandom(),
  fromUserId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
  toUserId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text().notNull(),
  createdAt: createdAt(),
});
