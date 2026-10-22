import type { FreshnessState } from "@lobby/core/knowledge/freshness";

/*
 * Freshness tallies for the Knowledge home's masthead line. The visible hero is <KnowledgeConstellation>
 * (knowledge-constellation.tsx); these helpers stay server-side and dependency-free.
 */
export interface FreshnessCounts {
  verified: number;
  dueSoon: number;
  stale: number;
  unset: number;
}

/** Tally published pages by freshness state. */
export function countFreshness(pages: { status: string; freshness: FreshnessState }[]): FreshnessCounts {
  const c: FreshnessCounts = { verified: 0, dueSoon: 0, stale: 0, unset: 0 };
  for (const p of pages) {
    if (p.status !== "published") continue;
    if (p.freshness === "verified") c.verified += 1;
    else if (p.freshness === "due-soon") c.dueSoon += 1;
    else if (p.freshness === "stale") c.stale += 1;
    else c.unset += 1;
  }
  return c;
}

export const totalOf = (c: FreshnessCounts) => c.verified + c.dueSoon + c.stale + c.unset;
