/** Search indexing for launcher apps. ACL = the app's visibility groups, or everyone. */
import { db, eq, s } from "@lobby/db";
import { aclForGroups, removeSource, upsertSource } from "../search";
import { LAUNCH_TYPE_INFO } from "./presets";

export async function indexApp(id: string): Promise<void> {
  const app = await db.query.apps.findFirst({ where: eq(s.apps.id, id) });
  if (!app) {
    await removeSource("app", id);
    return;
  }
  const groups = await db.select({ groupId: s.appVisibility.groupId }).from(s.appVisibility).where(eq(s.appVisibility.appId, id));
  const text = [app.description, `Category: ${app.category}.`, `${LAUNCH_TYPE_INFO[app.launchType].label}.`]
    .filter(Boolean)
    .join(" ");
  await upsertSource(
    "app",
    app.id,
    [{ title: app.name, text, url: `/apps?focus=${encodeURIComponent(app.slug)}` }],
    aclForGroups(groups.map((g) => g.groupId)),
  );
}

export async function reindexApps(): Promise<number> {
  const apps = await db.select({ id: s.apps.id }).from(s.apps);
  for (const a of apps) await indexApp(a.id);
  // Drop index entries for apps that no longer exist.
  const indexed = await db
    .selectDistinct({ id: s.searchChunks.sourceId })
    .from(s.searchChunks)
    .where(eq(s.searchChunks.sourceType, "app"));
  const live = new Set(apps.map((a) => a.id));
  for (const row of indexed) if (!live.has(row.id)) await removeSource("app", row.id);
  return apps.length;
}
