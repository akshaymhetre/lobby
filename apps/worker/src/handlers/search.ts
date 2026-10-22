import { indexPage, reindexPages } from "@lobby/core/knowledge/index-source";
import type { HandlerModule } from "../types";

type Indexer = (id: string) => Promise<void>;
type Reindexer = () => Promise<number>;

/**
 * Other modules' indexers, loaded lazily and guarded: a module that is not installed yet (or fails to
 * load) costs its own source type, never the whole reindex.
 */
async function load<T>(specifier: string, name: string): Promise<T | null> {
  try {
    const mod = (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
    return typeof mod[name] === "function" ? (mod[name] as T) : null;
  } catch (err) {
    console.warn(`[search] ${specifier} not available:`, (err as Error).message);
    return null;
  }
}

const INDEXERS: Record<string, () => Promise<Indexer | null>> = {
  page: async () => indexPage,
  person: () => load<Indexer>("@lobby/core/people/index-source", "indexPerson"),
  app: () => load<Indexer>("@lobby/core/apps/index-source", "indexApp"),
  request_type: () => load<Indexer>("@lobby/core/helpdesk/index-source", "indexRequestType"),
  ticket: () => load<Indexer>("@lobby/core/helpdesk/index-source", "indexTicket"),
  post: () => load<Indexer>("@lobby/core/home/index-source", "indexPost"),
};

const REINDEXERS: [string, () => Promise<Reindexer | null>][] = [
  ["pages", async () => reindexPages],
  ["people", () => load<Reindexer>("@lobby/core/people/index-source", "reindexPeople")],
  ["apps", () => load<Reindexer>("@lobby/core/apps/index-source", "reindexApps")],
  ["request types", () => load<Reindexer>("@lobby/core/helpdesk/index-source", "reindexRequestTypes")],
  ["tickets", () => load<Reindexer>("@lobby/core/helpdesk/index-source", "reindexTickets")],
  ["posts", () => load<Reindexer>("@lobby/core/home/index-source", "reindexPosts")],
];

export async function reindexAll(): Promise<void> {
  const started = Date.now();
  const parts: string[] = [];
  for (const [label, get] of REINDEXERS) {
    const fn = await get();
    if (!fn) continue;
    try {
      parts.push(`${await fn()} ${label}`);
    } catch (err) {
      // One broken source must not stop the others from being indexed.
      console.error(`[search] reindex of ${label} failed:`, err);
    }
  }
  console.log(`[search] reindexed ${parts.join(", ")} in ${Date.now() - started}ms`);
}

/** Background work for search indexing. */
export const search: HandlerModule = {
  handlers: {
    "search.index-source": async (data: { sourceType?: string; sourceId?: string }) => {
      if (!data.sourceType || !data.sourceId) return;
      const indexer = await INDEXERS[data.sourceType]?.();
      if (!indexer) {
        console.warn(`[search] no indexer for source type ${data.sourceType}`);
        return;
      }
      await indexer(data.sourceId);
    },
    "search.reindex-all": async () => reindexAll(),
  },
  // A fresh worker always has an index, even right after `pnpm db:reset`.
  onStart: reindexAll,
};
