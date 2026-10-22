import { and, db, eq, s } from "@lobby/db";

export type SourceType = (typeof s.searchChunks.$inferInsert)["sourceType"];

export interface ChunkInput {
  title: string;
  text: string;
  url: string;
}

/** Everyone can see it. */
export const PUBLIC_ACL = ["*"];
export const aclForGroups = (groupIds: string[]) => (groupIds.length ? groupIds.map((g) => `group:${g}`) : PUBLIC_ACL);

/**
 * Replaces all chunks of one source. `acl` lists who may see it ("*", "group:<id>", "user:<id>").
 * `freshness` (0..1) multiplies the rank; stale knowledge pages pass less than 1.
 */
export async function upsertSource(
  sourceType: SourceType,
  sourceId: string,
  chunks: ChunkInput[],
  acl: string[],
  freshness = 1,
) {
  await db.transaction(async (tx) => {
    await tx.delete(s.searchChunks).where(and(eq(s.searchChunks.sourceType, sourceType), eq(s.searchChunks.sourceId, sourceId)));
    if (!chunks.length) return;
    await tx.insert(s.searchChunks).values(
      chunks.map((c, i) => ({
        sourceType,
        sourceId,
        chunkIndex: i,
        title: c.title,
        text: c.text,
        url: c.url,
        aclPrincipals: acl.length ? acl : PUBLIC_ACL,
        freshness,
      })),
    );
  });
}

export async function removeSource(sourceType: SourceType, sourceId: string) {
  await db.delete(s.searchChunks).where(and(eq(s.searchChunks.sourceType, sourceType), eq(s.searchChunks.sourceId, sourceId)));
}

/** Splits long text on paragraph boundaries into ~maxChars chunks. */
export function chunkText(text: string, maxChars = 1200): string[] {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > maxChars) {
      out.push(cur);
      cur = "";
    }
    if (p.length > maxChars) {
      for (let i = 0; i < p.length; i += maxChars) out.push(p.slice(i, i + maxChars));
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}
