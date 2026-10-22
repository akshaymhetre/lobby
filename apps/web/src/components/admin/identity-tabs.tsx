"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type IdentityTab = "sso" | "roles" | "provisioning";
const TABS: { key: IdentityTab; label: string; description: string }[] = [
  { key: "sso", label: "Single sign-on", description: "Pick the provider, register Lobby in its console, then paste the client details here." },
  { key: "roles", label: "Roles", description: "Map group names from your identity provider to roles in Lobby. Changes apply the next time each person signs in." },
  { key: "provisioning", label: "Provisioning", description: "SCIM lets your identity provider create, update and deactivate people in Lobby the moment it changes them." },
];
const isTab = (v: string): v is IdentityTab => TABS.some((t) => t.key === v);

/**
 * Identity & roles as three tabs with one save each (audit G3). The tab rides in the URL hash
 * (`/admin/identity#provisioning` from the overview still works), read after mount so the server
 * and the first client paint agree.
 */
export function IdentityTabs({ panels, initial = "sso" }: { panels: Record<IdentityTab, React.ReactNode>; initial?: IdentityTab }) {
  const [tab, setTab] = React.useState<IdentityTab>(initial);
  React.useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (isTab(h)) setTab(h);
  }, []);
  const change = (v: string) => {
    if (!isTab(v)) return;
    setTab(v);
    window.history.replaceState(null, "", v === "sso" ? window.location.pathname + window.location.search : `#${v}`);
  };
  return (
    <Tabs value={tab} onValueChange={change}>
      <TabsList aria-label="Identity settings">
        {TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((t) => (
        <TabsContent key={t.key} value={t.key} className="pt-8" aria-description={t.description}>
          {panels[t.key]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
