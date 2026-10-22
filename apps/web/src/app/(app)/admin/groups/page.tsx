import { listGroupsWithCounts, listRoleMappings } from "@lobby/core/admin";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/ui/page-header";
import { GroupsHero } from "@/components/admin/groups-hero";
import { GroupsTable } from "@/components/admin/groups-table";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Groups" };

export default async function GroupsPage() {
  await requireAdmin();
  const [groups, mappings] = await Promise.all([listGroupsWithCounts(), listRoleMappings()]);
  const rolesByGroup = new Map<string, string[]>();
  for (const m of mappings) rolesByGroup.set(m.groupName, [...(rolesByGroup.get(m.groupName) ?? []), m.role]);
  const rows = groups.map((g) => ({
    id: g.id,
    name: g.name,
    displayName: g.displayName,
    source: g.source,
    members: Number(g.members),
    roles: rolesByGroup.get(g.name) ?? [],
  }));
  return (
    <Page width="wide">
      <PageHeader
        title="Groups"
        description="Groups come from your identity provider. Use them to decide who sees apps and pages, and who gets a role."
      />
      <div className="section-stack">
        {rows.length ? <GroupsHero groups={rows} /> : null}
        <GroupsTable groups={rows} />
      </div>
    </Page>
  );
}
