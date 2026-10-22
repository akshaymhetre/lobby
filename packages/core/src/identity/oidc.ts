import * as client from "openid-client";
import type { IdentitySettings } from "@lobby/db/schema";
import { decrypt, encrypt } from "../crypto";
import { env } from "../env";
import { getOrgSettings } from "../settings";

export const OIDC_FLOW_COOKIE = "lobby_oidc";
export const CALLBACK_PATH = "/auth/callback";
export const redirectUri = () => `${env.url}${CALLBACK_PATH}`;

export interface ResolvedIdentity {
  provider: IdentitySettings["provider"];
  issuer: string;
  clientId: string;
  clientSecret: string;
  discoveryUrl?: string;
  scopes: string;
  groupsClaim: string;
}

/** Identity settings from the database, falling back to OIDC_* environment variables. */
export async function resolveIdentity(): Promise<ResolvedIdentity | null> {
  const org = await getOrgSettings();
  const id = org.identity;
  if (id?.issuer && id.clientId) {
    return {
      provider: id.provider,
      issuer: id.issuer,
      clientId: id.clientId,
      clientSecret: id.clientSecretEnc ? decrypt(id.clientSecretEnc) : "",
      // Inside Docker the app may reach the IdP on an internal hostname; keep the deploy-level override.
      discoveryUrl: id.discoveryUrl || env.oidc.discoveryUrl || undefined,
      scopes: id.scopes || "openid email profile",
      groupsClaim: id.groupsClaim || "groups",
    };
  }
  if (env.oidc.issuer && env.oidc.clientId) {
    return {
      provider: "oidc",
      issuer: env.oidc.issuer,
      clientId: env.oidc.clientId,
      clientSecret: env.oidc.clientSecret,
      discoveryUrl: env.oidc.discoveryUrl || undefined,
      scopes: "openid email profile",
      groupsClaim: "groups",
    };
  }
  return null;
}

const cache = new Map<string, Promise<client.Configuration>>();

/**
 * Builds the openid-client configuration. When discoveryUrl is set (the app reaches the IdP on an
 * internal hostname, e.g. inside Docker) metadata is fetched from there while the issuer and the
 * browser-facing authorization endpoint stay public.
 */
export async function clientConfig(id: ResolvedIdentity): Promise<client.Configuration> {
  const key = JSON.stringify([id.issuer, id.clientId, id.clientSecret, id.discoveryUrl]);
  let pending = cache.get(key);
  if (!pending) {
    pending = buildConfig(id);
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }
  return pending;
}

async function buildConfig(id: ResolvedIdentity): Promise<client.Configuration> {
  const insecure = id.issuer.startsWith("http://") || id.discoveryUrl?.startsWith("http://");
  const options = insecure ? { execute: [client.allowInsecureRequests] } : undefined;
  if (!id.discoveryUrl) {
    return client.discovery(new URL(id.issuer), id.clientId, id.clientSecret, undefined, options);
  }
  const base = id.discoveryUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`discovery failed: HTTP ${res.status} from ${base}`);
  const metadata = (await res.json()) as client.ServerMetadata;
  const config = new client.Configuration(metadata, id.clientId, id.clientSecret);
  if (insecure) client.allowInsecureRequests(config);
  return config;
}

export function clearOidcCache() {
  cache.clear();
}

interface FlowState {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  test?: boolean;
}

export const safeReturnTo = (value: string | null | undefined) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/";

/** Starts a login. Returns the IdP URL and the encrypted flow cookie to set. */
export async function beginLogin(returnTo: string, opts: { test?: boolean; loginHint?: string } = {}) {
  const id = await resolveIdentity();
  if (!id) throw new Error("No identity provider is configured yet.");
  const config = await clientConfig(id);
  const flow: FlowState = {
    state: client.randomState(),
    nonce: client.randomNonce(),
    verifier: client.randomPKCECodeVerifier(),
    returnTo: safeReturnTo(returnTo),
    test: opts.test,
  };
  const params: Record<string, string> = {
    redirect_uri: redirectUri(),
    scope: id.scopes,
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: await client.calculatePKCECodeChallenge(flow.verifier),
    code_challenge_method: "S256",
  };
  if (opts.loginHint) params.login_hint = opts.loginHint;
  if (opts.test) params.prompt = "login";
  return { url: client.buildAuthorizationUrl(config, params).href, cookie: encrypt(JSON.stringify(flow)) };
}

export interface IdentityClaims {
  sub: string;
  email: string;
  givenName?: string;
  familyName?: string;
  name?: string;
  groups: string[];
  idToken?: string;
}

/** Finishes a login: validates state, nonce and PKCE, exchanges the code, returns normalised claims. */
export async function completeLogin(currentUrl: URL, flowCookie: string | undefined) {
  if (!flowCookie) throw new Error("Sign-in session expired. Please try again.");
  const flow = JSON.parse(decrypt(flowCookie)) as FlowState;
  const id = await resolveIdentity();
  if (!id) throw new Error("No identity provider is configured.");
  const config = await clientConfig(id);
  // The callback is always validated against the configured public redirect URI.
  const callback = new URL(redirectUri());
  callback.search = currentUrl.search;
  const tokens = await client.authorizationCodeGrant(config, callback, {
    pkceCodeVerifier: flow.verifier,
    expectedState: flow.state,
    expectedNonce: flow.nonce,
    idTokenExpected: true,
  });
  const claims = tokens.claims() ?? ({} as Record<string, unknown>);
  let merged: Record<string, unknown> = { ...claims };
  if (!merged.email || !(id.groupsClaim in merged)) {
    try {
      const info = await client.fetchUserInfo(config, tokens.access_token, String(claims.sub));
      merged = { ...info, ...merged };
    } catch {
      /* userinfo is optional */
    }
  }
  const rawGroups = merged[id.groupsClaim];
  const groups = Array.isArray(rawGroups) ? rawGroups.map((g) => String(g).replace(/^\//, "")) : [];
  if (!merged.email) throw new Error("The identity provider did not return an email address.");
  const result: IdentityClaims = {
    sub: String(merged.sub),
    email: String(merged.email).toLowerCase(),
    givenName: merged.given_name as string | undefined,
    familyName: merged.family_name as string | undefined,
    name: merged.name as string | undefined,
    groups,
    idToken: tokens.id_token,
  };
  return { claims: result, returnTo: flow.returnTo, test: !!flow.test };
}

export async function endSessionUrl(idTokenHint: string | null | undefined): Promise<string | null> {
  const id = await resolveIdentity();
  if (!id) return null;
  try {
    const config = await clientConfig(id);
    if (!config.serverMetadata().end_session_endpoint) return null;
    const params: Record<string, string> = { post_logout_redirect_uri: `${env.url}/signed-out`, client_id: id.clientId };
    if (idTokenHint) params.id_token_hint = idTokenHint;
    return client.buildEndSessionUrl(config, params).href;
  } catch {
    return null;
  }
}

/** Discovery-only probe used by the setup wizard before attempting a full login round-trip. */
export async function probeIdentity(id: ResolvedIdentity) {
  clearOidcCache();
  const config = await clientConfig(id);
  const m = config.serverMetadata();
  return {
    issuer: m.issuer,
    authorizationEndpoint: m.authorization_endpoint,
    tokenEndpoint: m.token_endpoint,
    supportsPkce: (m.code_challenge_methods_supported ?? ["S256"]).includes("S256"),
  };
}
