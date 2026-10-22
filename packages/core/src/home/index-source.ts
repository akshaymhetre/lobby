/** Search indexing for news posts. ACL = the post's audience groups, or everyone. */
import { db, eq, s } from "@lobby/db";
import { aclForGroups, chunkText, removeSource, upsertSource } from "../search";

/** Strips tags and decodes the few entities the editor produces. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/blockquote)\s*\/?>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function indexPost(id: string): Promise<void> {
  const post = await db.query.posts.findFirst({ where: eq(s.posts.id, id) });
  if (!post || !post.publishedAt) {
    await removeSource("post", id);
    return;
  }
  const body = [post.summary, htmlToText(post.body)].filter(Boolean).join("\n\n");
  await upsertSource(
    "post",
    post.id,
    chunkText(body).map((text) => ({ title: post.title, text, url: `/news/${post.id}` })),
    aclForGroups(post.audienceGroupIds),
  );
}

export async function reindexPosts(): Promise<number> {
  const posts = await db.select({ id: s.posts.id }).from(s.posts);
  for (const p of posts) await indexPost(p.id);
  const indexed = await db
    .selectDistinct({ id: s.searchChunks.sourceId })
    .from(s.searchChunks)
    .where(eq(s.searchChunks.sourceType, "post"));
  const live = new Set(posts.map((p) => p.id));
  for (const row of indexed) if (!live.has(row.id)) await removeSource("post", row.id);
  return posts.length;
}
