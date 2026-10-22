import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, ts, updatedAt, users } from "./core";

export interface Citation {
  sourceType: string;
  sourceId: string;
  title: string;
  url: string;
}

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text().notNull().default("New conversation"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("ai_conversations_user_idx").on(t.userId, t.updatedAt)],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid().notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text({ enum: ["user", "assistant"] }).notNull(),
    /** Plain text shown in the UI. */
    text: text().notNull(),
    /** Provider-native content blocks, kept so the conversation can be replayed to the model. */
    blocks: jsonb().$type<unknown[]>().notNull().default([]),
    citations: jsonb().$type<Citation[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

/** A tool call the assistant proposed. Nothing that changes data runs until the user confirms. */
export const aiActions = pgTable("ai_actions", {
  id: uuid().primaryKey().defaultRandom(),
  conversationId: uuid().notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
  messageId: uuid().references(() => aiMessages.id, { onDelete: "cascade" }),
  userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
  tool: text().notNull(),
  input: jsonb().$type<Record<string, unknown>>().notNull(),
  status: text({ enum: ["proposed", "executed", "cancelled", "failed"] }).notNull().default("proposed"),
  result: jsonb().$type<Record<string, unknown>>(),
  /** Results of the read-only tools from the same assistant turn, plus the numbered sources so far,
   *  held until the user decides, because every tool_use in a turn must be answered together. */
  resume: jsonb().$type<{ toolResults: unknown[]; sources: unknown[] }>(),
  createdAt: createdAt(),
  decidedAt: ts(),
});
