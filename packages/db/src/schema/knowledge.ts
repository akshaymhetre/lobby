import { date, index, jsonb, pgTable, text, uniqueIndex, uuid, integer } from "drizzle-orm/pg-core";
import { createdAt, ts, updatedAt, users } from "./core";

export const spaces = pgTable("spaces", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text(),
  icon: text(),
  /** Groups whose members may edit pages in this space (plus content-editors and admins). */
  editorGroupIds: uuid().array().notNull().default([]),
  /** Empty = visible to everyone. */
  visibilityGroupIds: uuid().array().notNull().default([]),
  sortOrder: integer().notNull().default(0),
  createdAt: createdAt(),
});

export const pages = pgTable(
  "pages",
  {
    id: uuid().primaryKey().defaultRandom(),
    spaceId: uuid().notNull().references(() => spaces.id, { onDelete: "cascade" }),
    parentId: uuid(),
    slug: text().notNull(),
    title: text().notNull(),
    /** Editor document (Tiptap JSON). */
    content: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    /** Plain-text projection of content, used by search and AI. */
    contentText: text().notNull().default(""),
    template: text({ enum: ["blank", "policy", "how-to", "team", "onboarding-guide"] }).notNull().default("blank"),
    ownerId: uuid().references(() => users.id, { onDelete: "set null" }),
    status: text({ enum: ["draft", "published", "archived"] }).notNull().default("draft"),
    /** Freshness engine: the owner must re-verify the page by this date. */
    reviewBy: date({ mode: "string" }),
    verifiedAt: ts(),
    verifiedById: uuid().references(() => users.id, { onDelete: "set null" }),
    /** Empty = inherit the space's visibility. */
    visibilityGroupIds: uuid().array().notNull().default([]),
    publishedAt: ts(),
    archivedAt: ts(),
    /** Freshness engine bookkeeping: "<reviewBy>:soon" or "<reviewBy>:due", so each reminder is sent once per review date. */
    lastReminder: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("pages_space_slug_idx").on(t.spaceId, t.slug), index("pages_review_idx").on(t.reviewBy)],
);

export const pageVersions = pgTable(
  "page_versions",
  {
    id: uuid().primaryKey().defaultRandom(),
    pageId: uuid().notNull().references(() => pages.id, { onDelete: "cascade" }),
    title: text().notNull(),
    content: jsonb().$type<Record<string, unknown>>().notNull(),
    authorId: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("page_versions_page_idx").on(t.pageId, t.createdAt)],
);

export const pageAcknowledgements = pgTable(
  "page_acknowledgements",
  {
    id: uuid().primaryKey().defaultRandom(),
    pageId: uuid().notNull().references(() => pages.id, { onDelete: "cascade" }),
    userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("page_acknowledgements_page_user_idx").on(t.pageId, t.userId)],
);

