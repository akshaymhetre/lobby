import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { env, loadUserContext, readSession, SESSION_COOKIE, type UserContext } from "@lobby/core";
import type { Role } from "@lobby/db/schema";

/** Short-lived cookie carrying the result of a setup-wizard identity test login. */
export const IDENTITY_TEST_COOKIE = "lobby_idp_test";

export const cookieOptions = (maxAge?: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.url.startsWith("https://"),
  path: "/",
  ...(maxAge ? { maxAge } : {}),
});

/** The signed-in user for this request, or null. Cached per request. */
export const currentUser = cache(async (): Promise<UserContext | null> => {
  const jar = await cookies();
  const session = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return loadUserContext(session.userId);
});

/** Use in server components, actions and route handlers that need a signed-in user. */
export async function requireUser(): Promise<UserContext> {
  const ctx = await currentUser();
  if (!ctx) {
    const h = await headers();
    const path = h.get("x-lobby-path") ?? "/";
    redirect(`/sign-in?returnTo=${encodeURIComponent(path)}`);
  }
  return ctx;
}

export async function requireRole(role: Role): Promise<UserContext> {
  const ctx = await requireUser();
  if (!ctx.has(role)) forbidden();
  return ctx;
}

export const requireAdmin = () => requireRole("admin");

/** Admins and the people who own onboarding (the People team) may manage journeys. */
export async function requireJourneyManager(): Promise<UserContext> {
  const ctx = await requireUser();
  const { canManageJourneys } = await import("@lobby/core/journeys");
  if (!(await canManageJourneys(ctx))) forbidden();
  return ctx;
}
