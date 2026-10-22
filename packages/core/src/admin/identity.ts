import type { IdentitySettings } from "@lobby/db/schema";
import { z } from "zod";
import { audit } from "../audit";
import { encrypt } from "../crypto";
import { clearOidcCache, probeIdentity, type ResolvedIdentity } from "../identity/oidc";
import { getOrgSettings, updateOrgSettings } from "../settings";
import { ValidationError } from "./setup";

export const IDENTITY_PROVIDERS = ["okta", "entra", "google", "keycloak", "authentik", "oidc"] as const;

const url = z
  .string()
  .trim()
  .min(1, "Enter the issuer URL.")
  .refine((v) => /^https?:\/\/[^\s/]+/i.test(v), "This must be a full URL starting with https://");

export const identityInput = z.object({
  provider: z.enum(IDENTITY_PROVIDERS),
  issuer: url,
  clientId: z.string().trim().min(1, "Enter the client ID."),
  /** Blank keeps the saved secret. */
  clientSecret: z.string().optional().default(""),
  discoveryUrl: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || /^https?:\/\//i.test(v), "This must be a full URL, or leave it blank."),
  scopes: z.string().trim().optional().default("openid email profile"),
  groupsClaim: z.string().trim().optional().default("groups"),
});
export type IdentityInput = z.input<typeof identityInput>;

function parse(input: IdentityInput) {
  const r = identityInput.safeParse(input);
  if (!r.success) {
    const errors: Record<string, string> = {};
    for (const issue of r.error.issues) errors[String(issue.path[0])] ??= issue.message;
    throw new ValidationError(errors);
  }
  return r.data;
}

/** Saves identity settings. The client secret is encrypted; a blank secret keeps the saved one. */
export async function saveIdentitySettings(actorId: string, input: IdentityInput): Promise<IdentitySettings> {
  const v = parse(input);
  const org = await getOrgSettings();
  const prev = org.identity;
  const secretEnc = v.clientSecret ? encrypt(v.clientSecret) : (prev?.clientSecretEnc ?? "");
  if (!secretEnc) throw new ValidationError({ clientSecret: "Enter the client secret from your identity provider." });
  const changedEndpoint = !prev || prev.issuer !== v.issuer || prev.clientId !== v.clientId || !!v.clientSecret;
  const identity: IdentitySettings = {
    provider: v.provider,
    issuer: v.issuer,
    clientId: v.clientId,
    clientSecretEnc: secretEnc,
    discoveryUrl: v.discoveryUrl || undefined,
    scopes: v.scopes || "openid email profile",
    groupsClaim: v.groupsClaim || "groups",
    // A changed issuer, client or secret means the last test no longer proves anything.
    testedAt: changedEndpoint ? undefined : prev?.testedAt,
  };
  await updateOrgSettings({ identity });
  clearOidcCache();
  await audit(actorId, "identity.updated", { type: "org_settings", id: "1" }, {
    provider: identity.provider,
    issuer: identity.issuer,
    clientId: identity.clientId,
    secretChanged: !!v.clientSecret,
  });
  return identity;
}

export interface ProbeResult {
  ok: boolean;
  issuer?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  supportsPkce?: boolean;
  error?: string;
}

/** Turns low-level fetch and discovery failures into sentences an admin can act on. */
export function explainProbeError(err: unknown, issuer: string): string {
  const status = (err as { cause?: { status?: number }; status?: number } | null)?.cause?.status ?? (err as { status?: number } | null)?.status;
  if (typeof status === "number" && err instanceof Error && /unexpected HTTP response status code/i.test(err.message)) {
    if (status === 404) return `No OpenID configuration was found at ${issuer.replace(/\/$/, "")}/.well-known/openid-configuration. Check the issuer URL, for example the realm or tenant name in it.`;
    return `The identity provider answered with HTTP ${status} when Lobby asked for its OpenID configuration. Check the issuer URL.`;
  }
  const raw = err instanceof Error ? `${err.message} ${(err as { cause?: { code?: string; message?: string } }).cause?.code ?? ""}` : String(err);
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(raw)) return `Lobby could not find the host in ${issuer}. Check the spelling of the issuer URL.`;
  if (/ECONNREFUSED/i.test(raw)) return `Nothing answered at ${issuer}. Is the identity provider running and reachable from the Lobby server?`;
  if (/timed? ?out|ETIMEDOUT|aborted/i.test(raw)) return `The identity provider did not answer within 8 seconds. Check the issuer URL and any firewall between Lobby and it.`;
  if (/certificate|SSL|TLS|self.signed/i.test(raw)) return `The identity provider's TLS certificate was not trusted. Use a certificate from a public authority, or set NODE_EXTRA_CA_CERTS on the Lobby server.`;
  if (/HTTP 404|status code 404|404/i.test(raw)) return `No OpenID configuration was found at ${issuer.replace(/\/$/, "")}/.well-known/openid-configuration. The issuer URL is probably missing a path such as /realms/<name> or /v2.0.`;
  if (/issuer/i.test(raw) && /mismatch|does not match|unexpected/i.test(raw)) return `The provider reports a different issuer than the one you entered. Copy the issuer exactly as shown in its OpenID configuration, including any trailing slash.`;
  if (/JSON|Unexpected token/i.test(raw)) return `${issuer} answered, but not with an OpenID configuration. Check that this is the issuer URL and not the admin console URL.`;
  return `Lobby could not read the identity provider's configuration: ${err instanceof Error ? err.message : String(err)}`;
}

/** Discovery-only check of the values currently in the form (saved or not). */
export async function testIdentityDiscovery(input: { issuer: string; discoveryUrl?: string; clientId?: string }): Promise<ProbeResult> {
  const issuer = (input.issuer ?? "").trim();
  if (!/^https?:\/\//i.test(issuer)) return { ok: false, error: "Enter the issuer URL first. It starts with https://" };
  const id: ResolvedIdentity = {
    provider: "oidc",
    issuer,
    clientId: (input.clientId ?? "").trim() || "probe",
    clientSecret: "",
    discoveryUrl: input.discoveryUrl?.trim() || undefined,
    scopes: "openid",
    groupsClaim: "groups",
  };
  try {
    const m = await probeIdentity(id);
    return { ok: true, ...m };
  } catch (err) {
    return { ok: false, error: explainProbeError(err, issuer) };
  }
}
