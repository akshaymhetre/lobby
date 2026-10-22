import { listGroupsWithCounts, listRoleMappings, listScimTokens, scimBaseUrl } from "@lobby/core/admin";
import { asc, db, s as schema } from "@lobby/db";
import { directoryPeopleCount, directoryPersonWhere } from "@lobby/core/counts";
import { Page } from "@/components/page";
import { IdentityFlow } from "@/components/admin/identity-flow";
import { PageHeader } from "@/components/ui/page-header";
import { IdentityForm } from "@/components/admin/identity-form";
import { identityPageData } from "@/components/admin/identity-data";
import { IdentityTabs } from "@/components/admin/identity-tabs";
import { RoleMappingsEditor } from "@/components/admin/role-mappings";
import { ScimPanel } from "@/components/admin/scim-panel";
import { SettingsGroup } from "@/components/admin/settings-group";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Identity & roles" };

export default async function IdentityPage({ searchParams }: { searchParams: Promise<{ tested?: string; error?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const [{ initial, test, redirectUri, org }, mappings, groups, tokens, faces, people] = await Promise.all([
    identityPageData(params),
    listRoleMappings(),
    listGroupsWithCounts(),
    listScimTokens(),
    db
      .select({ id: schema.users.id, name: schema.users.displayName })
      .from(schema.users)
      .where(directoryPersonWhere())
      .orderBy(asc(schema.users.createdAt))
      .limit(3),
    directoryPeopleCount(),
  ]);
  const saved = !!org.identity?.issuer;
  let issuerHost: string | null = null;
  try {
    issuerHost = saved ? new URL(org.identity!.issuer).host : null;
  } catch {
    issuerHost = null;
  }
  return (
    <Page width="wide">
      <PageHeader title="Identity & roles" description="Who can sign in, how accounts arrive, and which groups get extra rights." />
      <div className="section-stack">
        <IdentityFlow
          provider={saved ? PROVIDERS[initial.provider] ?? "OpenID Connect" : null}
          providerKey={saved ? initial.provider : null}
          issuerHost={issuerHost}
          tested={!!initial.testedAt}
          testedLabel={initial.testedAt ? `Tested ${new Date(initial.testedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : saved ? "Not tested yet" : "Not connected"}
          companyName={org.companyName}
          logoUrl={org.logoUrl ?? null}
          people={people}
          faces={faces}
          scim={tokens.some((t) => !t.revokedAt && t.lastUsedAt)}
        />
        <IdentityTabs
          panels={{
            sso: <IdentityForm initial={initial} redirectUri={redirectUri} test={test} returnTo="/admin/identity" />,
            roles: (
              <RoleMappingsEditor
                initial={mappings.map((m) => ({ groupName: m.groupName, role: m.role }))}
                knownGroups={groups.map((g) => g.name)}
              />
            ),
            provisioning: (
              <SettingsGroup
                title="SCIM provisioning"
                description="Your identity provider creates, updates and deactivates people here the moment it changes them."
                state={
                  tokens.some((t) => !t.revokedAt && t.lastUsedAt) ? (
                    <Badge tone="success" dot>Syncing</Badge>
                  ) : tokens.some((t) => !t.revokedAt) ? (
                    <Badge tone="warning" dot>Waiting for the first sync</Badge>
                  ) : (
                    <Badge dot>Off, accounts appear at first sign-in</Badge>
                  )
                }
              >
              <ScimPanel
                baseUrl={scimBaseUrl()}
                tokens={tokens.map((t) => ({
                  id: t.id,
                  name: t.name,
                  createdAt: t.createdAt.toISOString(),
                  lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
                  revokedAt: t.revokedAt?.toISOString() ?? null,
                }))}
                defaultName={`${initial.provider === "entra" ? "Microsoft Entra ID" : initial.provider[0]!.toUpperCase() + initial.provider.slice(1)} provisioning`}
              />
              </SettingsGroup>
            ),
          }}
        />
      </div>
    </Page>
  );
}

const PROVIDERS: Record<string, string> = { okta: "Okta", entra: "Microsoft Entra ID", google: "Google Workspace", keycloak: "Keycloak", authentik: "Authentik", oidc: "OpenID Connect" };
