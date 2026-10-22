import "server-only";
import { cookies } from "next/headers";
import { decrypt, getOrgSettings, redirectUri } from "@lobby/core";
import { IDENTITY_TEST_COOKIE } from "@/server/auth";
import type { IdentityValues, TestOutcome } from "./identity-form";

/** Shared by the wizard step and the admin page: current values and the last test result. */
export async function identityPageData(params: { tested?: string; error?: string }) {
  const org = await getOrgSettings();
  const id = org.identity;
  const initial: IdentityValues = {
    provider: id?.provider ?? "okta",
    issuer: id?.issuer ?? "",
    clientId: id?.clientId ?? "",
    hasSecret: !!id?.clientSecretEnc,
    discoveryUrl: id?.discoveryUrl ?? "",
    scopes: id?.scopes ?? "openid email profile",
    groupsClaim: id?.groupsClaim ?? "groups",
    testedAt: id?.testedAt ?? null,
  };
  let test: TestOutcome | null = null;
  if (params.error) test = { ok: false, error: params.error.slice(0, 500) };
  else if (params.tested) {
    const raw = (await cookies()).get(IDENTITY_TEST_COOKIE)?.value;
    try {
      const parsed = raw ? (JSON.parse(decrypt(raw)) as { email: string; name?: string; groups?: string[] }) : null;
      test = parsed
        ? { ok: true, email: parsed.email, name: parsed.name, groups: parsed.groups ?? [] }
        : { ok: false, error: "The result of the test expired. Sign in to test again." };
    } catch {
      test = { ok: false, error: "The result of the test could not be read. Sign in to test again." };
    }
  }
  return { initial, test, redirectUri: redirectUri(), org };
}
