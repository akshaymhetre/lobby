import { env } from "@lobby/core";
import { loadHelpdeskAdmin, type FormFieldDef } from "@lobby/core/helpdesk";
import { Page } from "@/components/page";
import { Breadcrumb, PageHeader } from "@/components/ui/page-header";
import { HelpdeskAdmin, type AdminData } from "@/components/helpdesk/admin/helpdesk-admin";
import type { Priority } from "@/components/helpdesk/status";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Helpdesk · Admin" };

const TABS = ["types", "teams", "sla", "calendars", "canned", "connectors"];

export default async function HelpdeskAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireAdmin();
  const { tab } = await searchParams;
  const d = await loadHelpdeskAdmin(ctx);

  // Only plain, secret-free data crosses to the client.
  const data: AdminData = {
    teams: d.teams.map((t) => ({ id: t.id, slug: t.slug, name: t.name, description: t.description ?? "", icon: t.icon ?? "life-buoy", agentGroupId: t.agentGroupId, calendarId: t.calendarId, roundRobin: t.roundRobin, ticketCount: t.ticketCount })),
    requestTypes: d.requestTypes.map((r) => ({
      id: r.id,
      slug: r.slug,
      teamId: r.teamId,
      name: r.name,
      description: r.description ?? "",
      icon: r.icon ?? "life-buoy",
      fields: r.fields as FormFieldDef[],
      approval: r.approval,
      slaPolicyId: r.slaPolicyId,
      defaultPriority: r.defaultPriority as Priority,
      active: r.active,
    })),
    policies: d.policies.map((p) => ({ id: p.id, name: p.name, targets: p.targets })),
    calendars: d.calendars.map((c) => ({ id: c.id, name: c.name, timezone: c.timezone, workDays: c.workDays, startMinute: c.startMinute, endMinute: c.endMinute, holidays: c.holidays })),
    canned: d.canned.map((c) => ({ id: c.id, teamId: c.teamId, title: c.title, body: c.body })),
    groups: d.groups.map((g) => ({ id: g.id, displayName: g.displayName })),
    connectors: d.connectors.map((c) => ({ id: c.id, kind: c.kind, name: c.name, enabled: c.enabled, requestTypeIds: c.requestTypeIds, config: c.config, linkedTickets: c.linkedTickets })),
  };

  return (
    <Page width="wide">
      <PageHeader
        breadcrumb={<Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Helpdesk" }]} />}
        title="Helpdesk"
        description="The service catalog, who handles what, how fast, and where requests sync to."
      />
      <HelpdeskAdmin data={data} origin={env.url} initialTab={TABS.includes(tab ?? "") ? tab! : "types"} />
    </Page>
  );
}
