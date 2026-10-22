import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { IdentityForm } from "@/components/admin/identity-form";
import { identityPageData } from "@/components/admin/identity-data";
import { IDP_TEST_RETURN_COOKIE } from "@/components/admin/constants";
import { asc, db, s } from "@lobby/db";
import { directoryPeopleCount, directoryPersonWhere } from "@lobby/core/counts";
import { StepHeader } from "@/components/setup/step-header";
import { SignInChain } from "@/components/setup/step-visuals";
import { StepFooter } from "@/components/setup/step-nav";
import { guardSetup } from "../_guard";

export const metadata = { title: "Single sign-on" };

export default async function IdentityStep({ searchParams }: { searchParams: Promise<{ tested?: string; error?: string }> }) {
  await guardSetup("identity");
  const params = await searchParams;
  // The OIDC callback always returns here; send an admin who started the test from the console back there.
  if ((params.tested || params.error) && (await cookies()).get(IDP_TEST_RETURN_COOKIE)?.value === "/admin/identity") {
    const q = new URLSearchParams();
    if (params.tested) q.set("tested", params.tested);
    if (params.error) q.set("error", params.error);
    redirect(`/admin/identity?${q}`);
  }
  const [{ initial, test, redirectUri, org }, people, faces] = await Promise.all([
    identityPageData(params),
    directoryPeopleCount(),
    db.select({ id: s.users.id, name: s.users.displayName }).from(s.users).where(directoryPersonWhere()).orderBy(asc(s.users.createdAt)).limit(2),
  ]);
  const saved = !!initial.issuer && initial.hasSecret;
  return (
    <StepHeader
      step="identity"
      aside={
        <SignInChain
          provider={initial.issuer ? PROVIDER_NAMES[initial.provider] ?? "OpenID Connect" : null}
          host={hostOf(initial.issuer)}
          state={initial.testedAt ? "tested" : saved ? "saved" : "none"}
          companyName={org.companyName}
          logoUrl={org.logoUrl ?? null}
          people={people}
          faces={faces}
        />
      }
    >
      <IdentityForm initial={initial} redirectUri={redirectUri} test={test} returnTo="/setup/identity" />
      <StepFooter step="identity" canContinue={saved} note={saved ? undefined : "Save a provider to continue, or skip and use the administrator account for now."} />
    </StepHeader>
  );
}

const PROVIDER_NAMES: Record<string, string> = { okta: "Okta", entra: "Microsoft Entra ID", google: "Google Workspace", keycloak: "Keycloak", authentik: "Authentik", oidc: "OpenID Connect" };

function hostOf(url: string): string | null {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
}
