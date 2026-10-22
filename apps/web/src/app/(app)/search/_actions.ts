"use server";

import { search } from "@lobby/core/search";
import { requireUser } from "@/server/auth";
import type { SearchResult } from "@/components/search/types";

/** Type-ahead search for the command palette. ACL filtering happens in SQL via the caller's principals. */
export async function paletteSearchAction(query: string): Promise<SearchResult[]> {
  const ctx = await requireUser();
  const q = typeof query === "string" ? query.trim().slice(0, 200) : "";
  if (!q) return [];
  const hits = await search({ principals: ctx.principals, query: q, limit: 24 });
  return hits.map((h) => ({ type: h.sourceType, id: h.sourceId, title: h.title, snippet: h.snippet, url: h.url, freshness: h.freshness }));
}
