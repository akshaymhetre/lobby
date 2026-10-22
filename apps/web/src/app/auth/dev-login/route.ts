import { NextResponse, type NextRequest } from "next/server";
import { createSession, env, safeReturnTo, SESSION_COOKIE } from "@lobby/core";
import { db } from "@lobby/db";
import { cookieOptions } from "@/server/auth";

/** Development-only impersonation, used by e2e tests and agents. Refused unless LOBBY_DEV_LOGIN=1 outside production. */
export async function GET(req: NextRequest) {
  if (!env.devLogin) return new NextResponse("Not found", { status: 404 });
  const email = (req.nextUrl.searchParams.get("email") ?? "").toLowerCase();
  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, email) });
  if (!user) return new NextResponse(`No user ${email}`, { status: 404 });
  const { token, maxAgeSeconds } = await createSession(user.id, { userAgent: "dev-login" });
  const res = NextResponse.redirect(new URL(safeReturnTo(req.nextUrl.searchParams.get("returnTo")), env.url));
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(maxAgeSeconds));
  return res;
}
