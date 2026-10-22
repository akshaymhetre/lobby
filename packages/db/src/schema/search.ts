import { sql } from "drizzle-orm";
import { customType, index, pgTable, real, text, uniqueIndex, uuid, vector } from "drizzle-orm/pg-core";
import { ts } from "./core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

/** Embedding width used by the search index. Changing it requires a reindex. */
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * One searchable unit (a page section, a person, an app, a request type, a ticket).
 * aclPrincipals holds who may see it: "*" (everyone), "group:<uuid>" or "user:<uuid>".
 * Every query filters on it in SQL, so nothing a user cannot see ever leaves the database.
 */
export const searchChunks = pgTable(
  "search_chunks",
  {
    id: uuid().primaryKey().defaultRandom(),
    sourceType: text({ enum: ["page", "person", "app", "request_type", "ticket", "post"] }).notNull(),
    sourceId: uuid().notNull(),
    chunkIndex: real().notNull().default(0),
    title: text().notNull(),
    text: text().notNull(),
    url: text().notNull(),
    aclPrincipals: text().array().notNull(),
    /** 1 = verified and in date, lower = stale. Multiplies the rank. */
    freshness: real().notNull().default(1),
    tsv: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(text, '')), 'B')`,
    ),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
    updatedAt: ts().defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("search_chunks_source_idx").on(t.sourceType, t.sourceId, t.chunkIndex),
    index("search_chunks_tsv_idx").using("gin", t.tsv),
    index("search_chunks_acl_idx").using("gin", t.aclPrincipals),
    index("search_chunks_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
  ],
);
