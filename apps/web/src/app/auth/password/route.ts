import { NextResponse, type NextRequest } from "next/server";
import { audit, createSession, env, safeReturnTo, SESSION_COOKIE, verifyPassword } from "@lobby/core";
import { db } from "@lobby/db";
import { cookieOptions } from "@/server/auth";

/** Break-glass admin sign-in. Only the account created by the setup wizard has a password. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.query.users.findFirst({ where: (u, { eq, and }) => and(eq(u.email, email), eq(u.isBreakGlass, true)) });
  const ok = !!user?.passwordHash && user.status === "active" && (await verifyPassword(password, user.passwordHash));
  if (!ok || !user) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.redirect(new URL("/sign-in?mode=admin&error=That+email+and+password+did+not+match.", env.url), 303);
  }
  const { token, maxAgeSeconds } = await createSession(user.id, { userAgent: req.headers.get("user-agent") ?? undefined });
  await audit(user.id, "auth.signed_in", { type: "user", id: user.id }, { method: "break_glass" });
  const res = NextResponse.redirect(new URL(safeReturnTo(String(form.get("returnTo") ?? "/")), env.url), 303);
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(maxAgeSeconds));
  return res;
}
