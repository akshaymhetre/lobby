import { asc, db, eq, s } from "@lobby/db";
import { APP_PRESETS, listAppsForAdmin, listCategories } from "@lobby/core/apps";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/ui/page-header";
import { AppsAdmin, type AdminApp, type PresetOption } from "@/components/apps/admin/apps-admin";
import { resolveAppIcon } from "@/components/apps/brand-icons";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Apps · Admin" };

export default async function AdminAppsPage() {
  const ctx = await requireAdmin();
  const [apps, categories, groups, people] = await Promise.all([
    listAppsForAdmin(ctx),
    listCategories(),
    db.select({ id: s.groups.id, name: s.groups.displayName }).from(s.groups).orderBy(asc(s.groups.displayName)),
    db
      .select({ id: s.users.id, name: s.users.displayName, title: s.users.title })
      .from(s.users)
      .where(eq(s.users.status, "active"))
      .orderBy(asc(s.users.displayName)),
  ]);

  const rows: AdminApp[] = apps.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    description: a.description ?? "",
    category: a.category,
    iconKey: a.icon ?? "",
    color: a.color ?? "",
    icon: resolveAppIcon(a),
    launchUrl: a.launchUrl,
    launchType: a.launchType,
    ownerId: a.ownerId,
    ownerName: a.ownerName,
    requestAccessEnabled: a.requestAccessEnabled,
    groupIds: a.groupIds,
    presetKey: a.presetKey,
    launches30d: a.launches30d,
  }));

  const presets: PresetOption[] = APP_PRESETS.map((p) => ({
    ...p,
    icon: resolveAppIcon({ name: p.name, icon: p.key === "custom" ? null : `preset:${p.key}`, color: p.color }),
  }));

  return (
    <Page width="wide">
      <PageHeader
        title="Apps"
        description="The tiles people see in the launcher. Changes apply straight away, and every change is recorded in the audit log."
      />
      <AppsAdmin apps={rows} presets={presets} categories={categories} groups={groups} people={people} />
    </Page>
  );
}
