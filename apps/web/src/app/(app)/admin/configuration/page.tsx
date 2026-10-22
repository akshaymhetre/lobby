import { Page } from "@/components/page";
import { PageHeader } from "@/components/ui/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { ConfigPanel } from "@/components/admin/config-panel";
import { CopyField } from "@/components/admin/copy-field";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Configuration" };

export default async function ConfigurationPage() {
  await requireAdmin();
  return (
    <Page width="wide">
      <PageHeader
        title="Configuration"
        description="Keep Lobby's setup in version control, copy it between environments, or review a change before it goes live."
      />
      <ConfigPanel
        aside={
          <Disclosure variant="card" title="For developers" aside="Command line">
            <div className="section-content pt-2">
              <p className="text-small text-muted">The same export and import run on the server, which suits deploy pipelines.</p>
              <CopyField label="export command" value="pnpm --filter @lobby/config exec tsx src/cli.ts export lobby.yaml" />
              <CopyField label="dry run command" value="pnpm --filter @lobby/config exec tsx src/cli.ts apply lobby.yaml --dry-run" />
            </div>
          </Disclosure>
        }
      />
    </Page>
  );
}
