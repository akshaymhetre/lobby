import { NextResponse, type NextRequest } from "next/server";
import { beginLogin, OIDC_FLOW_COOKIE } from "@lobby/core";
import { cookieOptions } from "@/server/auth";

export async function GET(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get("returnTo") ?? "/";
  const test = req.nextUrl.searchParams.get("test") === "1";
  try {
    const { url, cookie } = await beginLogin(returnTo, { test, loginHint: req.nextUrl.searchParams.get("hint") ?? undefined });
    const res = NextResponse.redirect(url);
    res.cookies.set(OIDC_FLOW_COOKIE, cookie, cookieOptions(600));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach the identity provider.";
    const back = test ? "/setup/identity" : "/sign-in";
    return NextResponse.redirect(new URL(`${back}?error=${encodeURIComponent(message)}`, req.nextUrl.origin));
  }
}
