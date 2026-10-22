import { NextResponse, type NextRequest } from "next/server";
import { destroySession, endSessionUrl, env, SESSION_COOKIE } from "@lobby/core";

export async function POST(req: NextRequest) {
  const session = await destroySession(req.cookies.get(SESSION_COOKIE)?.value);
  // End the IdP session too, so "sign out" really signs out of every app opened from the launcher.
  const idpLogout = session?.idTokenHint ? await endSessionUrl(session.idTokenHint) : null;
  const res = NextResponse.redirect(idpLogout ?? new URL("/signed-out", env.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
