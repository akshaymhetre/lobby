import { FileSpreadsheet, LogIn, RefreshCw } from "lucide-react";
import { getOrgSettings } from "@lobby/core";
import { listScimTokens, scimBaseUrl } from "@lobby/core/admin";
import { Badge } from "@/components/ui/badge";
import { CellList, RowCell } from "@/components/ui/cells";
import { HeroLight } from "@/components/ui/hero-light";
import { ScimPanel } from "@/components/admin/scim-panel";
import { providerHelp } from "@/components/admin/identity-providers";
import { asc, db, s } from "@lobby/db";
import { directoryPeopleCount, directoryPersonWhere } from "@lobby/core/counts";
import { StepHeader } from "@/components/setup/step-header";
import { DirectoryFaces } from "@/components/setup/step-visuals";
import { StepFooter } from "@/components/setup/step-nav";
import { guardSetup } from "../_guard";

export const metadata = { title: "People" };

export default async function PeopleStep() {
  await guardSetup("people");
  const [org, tokens, people, faces] = await Promise.all([
    getOrgSettings(),
    listScimTokens(),
    directoryPeopleCount(),
    db.select({ id: s.users.id, name: s.users.displayName }).from(s.users).where(directoryPersonWhere()).orderBy(asc(s.users.createdAt)).limit(15),
  ]);
  const help = providerHelp(org.identity?.provider);
  // The light says what the sync is doing: green once a token has been used, teal while a token
  // waits for its first push, blue (just information) before any token exists.
  const live = tokens.filter((t) => !t.revokedAt);
  const tone = live.some((t) => t.lastUsedAt) ? "green" : live.length ? "teal" : "blue";
  const disc = "inline-flex size-10 items-center justify-center rounded-full bg-sunken text-muted shadow-inset [&_svg]:size-[18px] [&_svg]:stroke-[1.5]";
  return (
    <StepHeader step="people" aside={<DirectoryFaces people={people} faces={faces} />}>
      <div className="section-stack">
        <section aria-labelledby="scim-heading" className="panel relative isolate flex flex-col gap-6 overflow-hidden rounded-panel p-5 dark:glass sm:p-7">
          <HeroLight tone={tone} position="top-right" />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-raised text-fg shadow-cell" aria-hidden>
                <RefreshCw className="size-5 stroke-[1.75]" />
              </span>
              <Badge tone={tone === "green" ? "success" : "accent"} dot>
                {tone === "green" ? "Syncing" : tone === "teal" ? "Waiting for the first push" : "Recommended"}
              </Badge>
            </div>
            <h2 id="scim-heading" className="text-balance text-h2 font-medium text-fg md:text-hero">
              Sync from {help.key === "oidc" ? "your identity provider" : help.name} with SCIM
            </h2>
            <p className="max-w-lg text-pretty text-body text-muted">Joiners appear before their first day, and leavers lose access the moment IT removes them.</p>
          </div>
          <ScimPanel
            generateVariant="secondary"
            baseUrl={scimBaseUrl()}
            defaultName={`${help.key === "oidc" ? "Identity provider" : help.name} provisioning`}
            tokens={tokens.map((t) => ({
              id: t.id,
              name: t.name,
              createdAt: t.createdAt.toISOString(),
              lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
              revokedAt: t.revokedAt?.toISOString() ?? null,
            }))}
          />
          <div className="flex flex-col gap-3 rounded-card bg-sunken/70 p-4 shadow-inset sm:p-5">
            <h3 className="text-row font-medium text-fg">In {help.name}</h3>
            <ol className="flex flex-col gap-2.5">
              {help.scim.map((s, i) => (
                <li key={i} className="flex gap-3 text-body text-fg">
                  <span className="tabular inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-raised text-caption font-medium text-muted shadow-cell">
                    {i + 1}
                  </span>
                  <span className="text-pretty">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="other-ways" className="flex flex-col gap-4">
          <h2 id="other-ways" className="text-h2 font-medium text-fg">
            Other ways in
          </h2>
          <CellList>
            <RowCell
              href="/admin/people/import"
              leading={
                <span className={disc} aria-hidden>
                  <FileSpreadsheet />
                </span>
              }
              title="Import a spreadsheet"
              meta="Names, titles, managers and start dates from your HR system"
            />
            <RowCell
              leading={
                <span className={disc} aria-hidden>
                  <LogIn />
                </span>
              }
              title="Create accounts at first sign-in"
              meta={`Nothing to set up. The directory fills in as people use ${org.productName}.`}
            />
          </CellList>
        </section>
      </div>
      <StepFooter step="people" />
    </StepHeader>
  );
}
