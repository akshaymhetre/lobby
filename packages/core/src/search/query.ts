import { db, sql } from "@lobby/db";
import type { SourceType } from "./write";

export interface SearchHit {
  sourceType: SourceType;
  sourceId: string;
  title: string;
  /** Plain-text excerpt with matches wrapped in [[ and ]] markers. */
  snippet: string;
  /** Full chunk text, for AI grounding. */
  text: string;
  url: string;
  freshness: number;
  score: number;
}

export interface SearchOptions {
  /** Caller's ACL principals (UserContext.principals). Required: nothing is returned without them. */
  principals: string[];
  query: string;
  types?: SourceType[];
  limit?: number;
}

const RRF_K = 60;

/**
 * Hybrid search: Postgres full-text (websearch syntax, weighted title > body) fused with trigram
 * similarity on titles (catches names and partial words) by reciprocal rank fusion. Freshness
 * multiplies the score so stale content sinks. ACL filtering happens inside the SQL.
 */
export async function search(opts: SearchOptions): Promise<SearchHit[]> {
  const q = opts.query.trim();
  if (!q || !opts.principals.length) return [];
  const limit = Math.min(opts.limit ?? 20, 50);
  const types = opts.types?.length ? opts.types : null;
  const principals = `{${opts.principals.map((p) => `"${p.replace(/"/g, "")}"`).join(",")}}`;

  const rows = await db.execute<{
    source_type: SourceType;
    source_id: string;
    title: string;
    snippet: string;
    text: string;
    url: string;
    freshness: number;
    score: number;
  }>(sql`
    with visible as (
      select * from search_chunks
      where acl_principals && ${principals}::text[]
        ${types ? sql`and source_type = any(${`{${types.join(",")}}`}::text[])` : sql``}
    ),
    fts as (
      select id, row_number() over (order by ts_rank_cd(tsv, websearch_to_tsquery('english', ${q})) desc) as r
      from visible
      where tsv @@ websearch_to_tsquery('english', ${q})
      limit 100
    ),
    prefix as (
      select id, row_number() over (order by ts_rank_cd(tsv, to_tsquery('english', ${prefixQuery(q)})) desc) as r
      from visible
      where ${prefixQuery(q)} <> '' and tsv @@ to_tsquery('english', ${prefixQuery(q)})
      limit 100
    ),
    trgm as (
      select id, row_number() over (order by similarity(title, ${q}) desc) as r
      from visible
      where title % ${q} or title ilike ${`%${q.replace(/[%_]/g, "")}%`}
      limit 50
    ),
    fused as (
      select id, sum(1.0 / (${RRF_K} + r)) as rrf from (
        select id, r from fts union all select id, r from prefix union all select id, r from trgm
      ) u group by id
    ),
    ranked as (
      select v.*, f.rrf * (0.35 + 0.65 * v.freshness) as score,
        row_number() over (partition by v.source_type, v.source_id order by f.rrf desc) as per_source
      from fused f join visible v on v.id = f.id
    )
    select source_type, source_id::text, title, text, url, freshness, score,
      ts_headline('english', text, websearch_to_tsquery('english', ${q}),
        'StartSel=[[, StopSel=]], MaxWords=28, MinWords=12, ShortWord=2, MaxFragments=1') as snippet
    from ranked
    where per_source = 1
    order by score desc
    limit ${limit}
  `);

  return rows.map((r) => ({
    sourceType: r.source_type,
    sourceId: r.source_id,
    title: r.title,
    snippet: r.snippet,
    text: r.text,
    url: r.url,
    freshness: Number(r.freshness),
    score: Number(r.score),
  }));
}

/** "onboard lapt" -> "onboard:* & lapt:*" for type-ahead matching. */
function prefixQuery(q: string): string {
  const words = q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.slice(0, 6).map((w) => `${w}:*`).join(" & ");
}

/**
 * Chunks for AI grounding: like search() but returns several chunks per source so the
 * model sees the relevant passage, not just the best title match.
 */
export async function retrieve(opts: SearchOptions): Promise<SearchHit[]> {
  return search({ ...opts, limit: opts.limit ?? 8 });
}
