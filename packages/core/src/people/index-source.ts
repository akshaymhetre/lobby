import { db, eq, s } from "@lobby/db";
import { PUBLIC_ACL, removeSource, upsertSource } from "../search/write";

type PersonRow = typeof s.users.$inferSelect;

/** The searchable text for one person: title, team, location, skills and bio. */
export function personSearchText(p: Pick<PersonRow, "title" | "department" | "location" | "skills" | "bio" | "email" | "pronouns">): string {
  return [
    p.title,
    p.department,
    p.location,
    p.skills.length ? `Skills: ${p.skills.join(", ")}` : null,
    p.bio,
    p.email,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Break-glass and other local service accounts are not people, so they stay out of search. */
const isListable = (p: PersonRow) => p.status === "active" && !p.isBreakGlass;

/** Writes (or removes, when deactivated) one person in the search index. Everyone may find people. */
export async function indexPerson(id: string): Promise<void> {
  const p = await db.query.users.findFirst({ where: eq(s.users.id, id) });
  if (!p || !isListable(p)) {
    await removeSource("person", id);
    return;
  }
  await upsertSource("person", p.id, [{ title: p.displayName, text: personSearchText(p), url: `/people/${p.id}` }], PUBLIC_ACL);
}

/** Rebuilds every person in the index; drops entries for people who no longer exist or are deactivated. */
export async function reindexPeople(): Promise<number> {
  const rows = await db.select().from(s.users);
  let n = 0;
  for (const p of rows) {
    if (isListable(p)) {
      await upsertSource("person", p.id, [{ title: p.displayName, text: personSearchText(p), url: `/people/${p.id}` }], PUBLIC_ACL);
      n++;
    } else {
      await removeSource("person", p.id);
    }
  }
  const existing = new Set(rows.map((r) => r.id));
  const indexed = await db.selectDistinct({ id: s.searchChunks.sourceId }).from(s.searchChunks).where(eq(s.searchChunks.sourceType, "person"));
  for (const { id } of indexed) if (!existing.has(id)) await removeSource("person", id);
  return n;
}
