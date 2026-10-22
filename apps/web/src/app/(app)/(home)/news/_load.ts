import "server-only";
import { asc, db, s } from "@lobby/db";
import { listPostCategories } from "@lobby/core/home";

/** Groups and categories for the post editor. */
export async function loadEditorOptions() {
  const [groups, categories] = await Promise.all([
    db.select({ id: s.groups.id, name: s.groups.displayName }).from(s.groups).orderBy(asc(s.groups.displayName)),
    listPostCategories(),
  ]);
  return { groups, categories };
}
