import { NextResponse, type NextRequest } from "next/server";
import {
  audit, completeLogin, createSession, encrypt, env, getOrgSettings, OIDC_FLOW_COOKIE, SESSION_COOKIE,
  updateOrgSettings, upsertUserFromClaims,
} from "@lobby/core";
import { cookieOptions, IDENTITY_TEST_COOKIE } from "@/server/auth";

export async function GET(req: NextRequest) {
  const flowCookie = req.cookies.get(OIDC_FLOW_COOKIE)?.value;
  const idpError = req.nextUrl.searchParams.get("error_description") ?? req.nextUrl.searchParams.get("error");
  try {
    if (idpError) throw new Error(idpError);
    const { claims, returnTo, test } = await completeLogin(req.nextUrl, flowCookie);

    if (test) {
      // A wizard "Test connection" round-trip: record success, do not replace the admin's session.
      const org = await getOrgSettings();
      if (org.identity) await updateOrgSettings({ identity: { ...org.identity, testedAt: new Date().toISOString() } });
      const res = NextResponse.redirect(new URL("/setup/identity?tested=1", env.url));
      res.cookies.set(IDENTITY_TEST_COOKIE, encrypt(JSON.stringify({ email: claims.email, name: claims.name, groups: claims.groups })), cookieOptions(300));
      res.cookies.delete(OIDC_FLOW_COOKIE);
      return res;
    }

    const userId = await upsertUserFromClaims(claims);
    const { token, maxAgeSeconds } = await createSession(userId, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      idTokenHint: claims.idToken,
    });
    await audit(userId, "auth.signed_in", { type: "user", id: userId }, { method: "oidc" });
    const res = NextResponse.redirect(new URL(returnTo, env.url));
    res.cookies.set(SESSION_COOKIE, token, cookieOptions(maxAgeSeconds));
    res.cookies.delete(OIDC_FLOW_COOKIE);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-in failed.";
    console.error("[auth] callback failed:", message);
    let target = "/sign-in";
    try {
      if (flowCookie) {
        const { decrypt } = await import("@lobby/core");
        if (JSON.parse(decrypt(flowCookie)).test) target = "/setup/identity";
      }
    } catch {
      /* fall through to sign-in */
    }
    const res = NextResponse.redirect(new URL(`${target}?error=${encodeURIComponent(message)}`, env.url));
    res.cookies.delete(OIDC_FLOW_COOKIE);
    return res;
  }
}
