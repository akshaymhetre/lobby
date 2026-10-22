/**
 * App launcher domain logic. Every read takes a UserContext and filters by visibility in SQL or
 * right after it, so nothing a user may not see leaves this module. Admin writes audit.
 */
import { and, count, db, desc, eq, gte, inArray, s, sql } from "@lobby/db";
import { audit } from "../audit";
import type { UserContext } from "../identity/context";
import { isAppVisible, reconcilePinOrder, recentAppIds, safeLaunchUrl, slugify, uniqueSlug } from "./logic";
import { APP_PRESETS, getPreset, type LaunchType } from "./presets";

export { APP_PRESETS, LAUNCH_TYPE_INFO, getPreset, type AppPreset, type LaunchType } from "./presets";
export * from "./logic";

export type AppRow = typeof s.apps.$inferSelect;
export interface AppWithGroups extends AppRow {
  groupIds: string[];
}

async function groupIdsByApp(appIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!appIds.length) return map;
  const rows = await db.select().from(s.appVisibility).where(inArray(s.appVisibility.appId, appIds));
  for (const r of rows) map.set(r.appId, [...(map.get(r.appId) ?? []), r.groupId]);
  return map;
}

async function allAppsWithGroups(): Promise<AppWithGroups[]> {
  const apps = await db.select().from(s.apps).orderBy(s.apps.sortOrder, s.apps.name);
  const groups = await groupIdsByApp(apps.map((a) => a.id));
  return apps.map((a) => ({ ...a, groupIds: groups.get(a.id) ?? [] }));
}

/** Apps this user may see and launch. */
export async function listVisibleApps(ctx: UserContext): Promise<AppWithGroups[]> {
  return (await allAppsWithGroups()).filter((a) => isAppVisible(a.groupIds, ctx.groupIds));
}

/** Apps hidden from this user that they may ask for access to. */
export async function listRequestableApps(ctx: UserContext): Promise<AppWithGroups[]> {
  return (await allAppsWithGroups()).filter((a) => a.requestAccessEnabled && !isAppVisible(a.groupIds, ctx.groupIds));
}

/** One app by slug, only if the user may see it. */
export async function getVisibleApp(ctx: UserContext, slug: string): Promise<AppWithGroups | null> {
  const app = await db.query.apps.findFirst({ where: eq(s.apps.slug, slug) });
  if (!app) return null;
  const groupIds = (await groupIdsByApp([app.id])).get(app.id) ?? [];
  return isAppVisible(groupIds, ctx.groupIds) ? { ...app, groupIds } : null;
}

/** One app by slug if it exists, whether or not the user may see it (for access requests). */
export async function getAppBySlug(slug: string): Promise<AppWithGroups | null> {
  const app = await db.query.apps.findFirst({ where: eq(s.apps.slug, slug) });
  if (!app) return null;
  return { ...app, groupIds: (await groupIdsByApp([app.id])).get(app.id) ?? [] };
}

/**
 * Resolves a launch: checks visibility and URL safety, records the launch, returns where to go.
 * Returns a reason instead of a URL when the user may not launch it.
 */
export async function launchApp(
  ctx: UserContext,
  slug: string,
): Promise<{ ok: true; url: string; app: AppRow } | { ok: false; reason: "not_found" | "no_access" | "bad_url" }> {
  const app = await getAppBySlug(slug);
  if (!app) return { ok: false, reason: "not_found" };
  if (!isAppVisible(app.groupIds, ctx.groupIds)) return { ok: false, reason: "no_access" };
  const url = safeLaunchUrl(app.launchUrl);
  if (!url) return { ok: false, reason: "bad_url" };
  await db.insert(s.appLaunches).values({ userId: ctx.user.id, appId: app.id });
  return { ok: true, url, app };
}

/** Pinned app ids in the user's order (only apps they can still see). */
export async function listPinnedAppIds(ctx: UserContext, visibleIds?: Set<string>): Promise<string[]> {
  const rows = await db
    .select()
    .from(s.userAppPins)
    .where(eq(s.userAppPins.userId, ctx.user.id))
    .orderBy(s.userAppPins.position);
  const ids = rows.map((r) => r.appId);
  const visible = visibleIds ?? new Set((await listVisibleApps(ctx)).map((a) => a.id));
  return ids.filter((id) => visible.has(id));
}

/** Recently launched app ids, newest first, filtered to what the user can still see. */
export async function listRecentAppIds(ctx: UserContext, limit = 6, visibleIds?: Set<string>): Promise<string[]> {
  const rows = await db
    .select({ appId: s.appLaunches.appId, at: s.appLaunches.at })
    .from(s.appLaunches)
    .where(eq(s.appLaunches.userId, ctx.user.id))
    .orderBy(desc(s.appLaunches.at))
    .limit(100);
  const visible = visibleIds ?? new Set((await listVisibleApps(ctx)).map((a) => a.id));
  return recentAppIds(rows.filter((r) => visible.has(r.appId)), limit);
}

export async function pinApp(ctx: UserContext, appId: string): Promise<void> {
  const app = await db.query.apps.findFirst({ where: eq(s.apps.id, appId) });
  if (!app) throw new Error("App not found.");
  const groups = (await groupIdsByApp([appId])).get(appId) ?? [];
  if (!isAppVisible(groups, ctx.groupIds)) throw new Error("You do not have access to this app.");
  const [max] = await db
    .select({ n: sql<number>`coalesce(max(${s.userAppPins.position}), -1)` })
    .from(s.userAppPins)
    .where(eq(s.userAppPins.userId, ctx.user.id));
  await db
    .insert(s.userAppPins)
    .values({ userId: ctx.user.id, appId, position: Number(max?.n ?? -1) + 1 })
    .onConflictDoNothing();
}

export async function unpinApp(ctx: UserContext, appId: string): Promise<void> {
  await db.delete(s.userAppPins).where(and(eq(s.userAppPins.userId, ctx.user.id), eq(s.userAppPins.appId, appId)));
}

/** Saves a new pin order. Unknown ids are ignored and missing pins are kept at the end. */
export async function reorderPins(ctx: UserContext, orderedAppIds: string[]): Promise<string[]> {
  const current = (
    await db.select().from(s.userAppPins).where(eq(s.userAppPins.userId, ctx.user.id)).orderBy(s.userAppPins.position)
  ).map((r) => r.appId);
  const order = reconcilePinOrder(orderedAppIds, current);
  await db.transaction(async (tx) => {
    for (const [position, appId] of order.entries()) {
      await tx
        .update(s.userAppPins)
        .set({ position })
        .where(and(eq(s.userAppPins.userId, ctx.user.id), eq(s.userAppPins.appId, appId)));
    }
  });
  return order;
}

/** Open access requests by this user, keyed by app slug (from helpdesk tickets). */
export async function listMyOpenAccessRequests(ctx: UserContext): Promise<Map<string, { id: string; number: number }>> {
  const rows = await db
    .select({ id: s.tickets.id, number: s.tickets.number, fields: s.tickets.fields })
    .from(s.tickets)
    .where(
      and(
        eq(s.tickets.requesterId, ctx.user.id),
        eq(s.tickets.source, "access_request"),
        inArray(s.tickets.status, ["new", "open", "pending_approval", "waiting_on_requester"]),
      ),
    );
  // The app field may hold the app's slug or its id, depending on how the request was made.
  const apps = await db.select({ id: s.apps.id, slug: s.apps.slug }).from(s.apps);
  const slugById = new Map(apps.map((a) => [a.id, a.slug]));
  const map = new Map<string, { id: string; number: number }>();
  for (const r of rows) {
    const raw = typeof r.fields?.app === "string" ? r.fields.app : null;
    const slug = raw ? (slugById.get(raw) ?? raw) : null;
    if (slug && !map.has(slug)) map.set(slug, { id: r.id, number: r.number });
  }
  return map;
}

// ---------------------------------------------------------------- admin

export interface AppInput {
  name: string;
  description?: string | null;
  category: string;
  icon?: string | null;
  color?: string | null;
  launchUrl: string;
  launchType: LaunchType;
  ownerId?: string | null;
  requestAccessEnabled: boolean;
  groupIds: string[];
  presetKey?: string | null;
}

function requireAdminCtx(ctx: UserContext) {
  if (!ctx.has("admin")) throw new Error("Only admins can manage apps.");
}

async function validGroupIds(ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const rows = await db.select({ id: s.groups.id }).from(s.groups).where(inArray(s.groups.id, unique));
  return rows.map((r) => r.id);
}

function cleanInput(input: AppInput) {
  const url = safeLaunchUrl(input.launchUrl);
  if (!url) throw new Error("Use a full web address that starts with https:// or http://.");
  const name = input.name.trim();
  if (!name) throw new Error("Give the app a name.");
  return {
    name,
    description: input.description?.trim() || null,
    category: input.category.trim() || "General",
    icon: input.icon?.trim() || null,
    color: input.color && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : null,
    launchUrl: url,
    launchType: input.launchType,
    ownerId: input.ownerId || null,
    requestAccessEnabled: input.requestAccessEnabled,
    presetKey: input.presetKey ?? null,
  };
}

async function setVisibility(appId: string, groupIds: string[]) {
  const valid = await validGroupIds(groupIds);
  await db.delete(s.appVisibility).where(eq(s.appVisibility.appId, appId));
  if (valid.length) await db.insert(s.appVisibility).values(valid.map((groupId) => ({ appId, groupId })));
  return valid;
}

export async function createApp(ctx: UserContext, input: AppInput): Promise<AppRow> {
  requireAdminCtx(ctx);
  const values = cleanInput(input);
  const taken = new Set((await db.select({ slug: s.apps.slug }).from(s.apps)).map((r) => r.slug));
  const slug = uniqueSlug(slugify(values.name), taken);
  const [max] = await db.select({ n: sql<number>`coalesce(max(${s.apps.sortOrder}), 0)` }).from(s.apps);
  const [row] = await db.insert(s.apps).values({ ...values, slug, sortOrder: Number(max?.n ?? 0) + 1 }).returning();
  const groupIds = await setVisibility(row!.id, input.groupIds);
  await audit(ctx.user.id, "app.created", { type: "app", id: row!.id }, { slug, name: values.name, launchType: values.launchType, groupIds });
  return row!;
}

export async function updateApp(ctx: UserContext, appId: string, input: AppInput): Promise<AppRow> {
  requireAdminCtx(ctx);
  const before = await db.query.apps.findFirst({ where: eq(s.apps.id, appId) });
  if (!before) throw new Error("That app no longer exists.");
  const values = cleanInput({ ...input, presetKey: input.presetKey ?? before.presetKey });
  const [row] = await db.update(s.apps).set(values).where(eq(s.apps.id, appId)).returning();
  const groupIds = await setVisibility(appId, input.groupIds);
  const changed = Object.keys(values).filter(
    (k) => String(values[k as keyof typeof values] ?? "") !== String(before[k as keyof typeof before] ?? ""),
  );
  await audit(ctx.user.id, "app.updated", { type: "app", id: appId }, { slug: before.slug, changed, groupIds });
  return row!;
}

export async function deleteApp(ctx: UserContext, appId: string): Promise<void> {
  requireAdminCtx(ctx);
  const before = await db.query.apps.findFirst({ where: eq(s.apps.id, appId) });
  if (!before) return;
  await db.delete(s.apps).where(eq(s.apps.id, appId));
  await audit(ctx.user.id, "app.deleted", { type: "app", id: appId }, { slug: before.slug, name: before.name });
}

/** Contract for the setup wizard and the AI assistant. */
export async function createAppFromPreset(
  ctx: UserContext,
  presetKey: string,
  opts: { groupIds?: string[]; launchUrl?: string; name?: string } = {},
): Promise<AppRow> {
  const preset = getPreset(presetKey);
  if (!preset) throw new Error(`Unknown app preset "${presetKey}".`);
  return createApp(ctx, {
    name: opts.name ?? preset.name,
    description: preset.description,
    category: preset.category,
    icon: presetKey === "custom" ? null : `preset:${preset.key}`,
    color: preset.color,
    launchUrl: opts.launchUrl ?? preset.launchUrl.replace(/\{(tenant|domain)\}/g, "example"),
    launchType: preset.launchType,
    requestAccessEnabled: true,
    groupIds: opts.groupIds ?? [],
    presetKey: preset.key,
  });
}

export interface AdminAppRow extends AppWithGroups {
  ownerName: string | null;
  launches30d: number;
}

/** Every app with owner and 30-day launch counts, for the admin table. */
export async function listAppsForAdmin(ctx: UserContext): Promise<AdminAppRow[]> {
  requireAdminCtx(ctx);
  const apps = await allAppsWithGroups();
  const since = new Date(Date.now() - 30 * 24 * 3600_000);
  const [launches, owners] = await Promise.all([
    db
      .select({ appId: s.appLaunches.appId, n: count() })
      .from(s.appLaunches)
      .where(gte(s.appLaunches.at, since))
      .groupBy(s.appLaunches.appId),
    db.select({ id: s.users.id, name: s.users.displayName }).from(s.users),
  ]);
  const launchMap = new Map(launches.map((l) => [l.appId, l.n]));
  const ownerMap = new Map(owners.map((o) => [o.id, o.name]));
  return apps.map((a) => ({
    ...a,
    ownerName: a.ownerId ? (ownerMap.get(a.ownerId) ?? null) : null,
    launches30d: launchMap.get(a.id) ?? 0,
  }));
}

export const PREFERRED_CATEGORY_ORDER = [
  "Communication",
  "Work management",
  "Engineering",
  "Design",
  "Finance",
  "People",
  "Sales",
  "Security",
  "General",
];

/** Categories in use plus the preset ones, for the admin category picker. */
export async function listCategories(): Promise<string[]> {
  const rows = await db.selectDistinct({ c: s.apps.category }).from(s.apps);
  const all = new Set([...PREFERRED_CATEGORY_ORDER, ...APP_PRESETS.map((p) => p.category), ...rows.map((r) => r.c)]);
  return [...all];
}
