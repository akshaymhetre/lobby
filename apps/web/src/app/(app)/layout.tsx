import { redirect } from "next/navigation";
import { and, count, db, eq, isNull, s } from "@lobby/db";
import { getOrgSettings } from "@lobby/core";
import { AppShell } from "@/components/shell/app-shell";
import { CommandPalette } from "@/components/shell/command-palette";
import { AssistantPanel } from "@/components/shell/assistant-panel";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OrgProvider } from "@/components/ui/org-context";
import { formatDateline } from "@/components/ui/dateline";
import { requireUser } from "@/server/auth";
import { getNavCounts } from "@/server/nav-counts";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await getOrgSettings();
  if (!org.setupCompletedAt && !org.setupSteps.admin) redirect("/setup");
  const ctx = await requireUser();
  const [counts, [unread]] = await Promise.all([
    getNavCounts(ctx),
    db
      .select({ n: count() })
      .from(s.notifications)
      .where(and(eq(s.notifications.userId, ctx.user.id), isNull(s.notifications.readAt))),
  ]);
  const u = ctx.user;
  const tz = u.timezone || org.timezone;
  return (
    <OrgProvider
      value={{
        companyName: org.companyName,
        productName: org.productName,
        timezone: tz,
        dateline: formatDateline(new Date(), tz),
      }}
    >
      <TooltipProvider>
        <AppShell
          org={{ companyName: org.companyName, productName: org.productName, logoUrl: org.logoUrl }}
          user={{
            id: u.id,
            name: u.displayName,
            email: u.email,
            title: u.title,
            avatarUrl: u.avatarUrl,
          }}
          roles={ctx.roles}
          counts={counts}
          unread={unread?.n ?? 0}
          aiEnabled={org.ai?.enabled ?? false}
        >
          {children}
        </AppShell>
        <CommandPalette aiEnabled={org.ai?.enabled ?? false} />
        <AssistantPanel isAdmin={ctx.has("admin")} />
        <Toaster />
      </TooltipProvider>
    </OrgProvider>
  );
}
