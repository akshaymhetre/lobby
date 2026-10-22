import "server-only";
import { forbidden, redirect } from "next/navigation";
import type { SetupStep } from "@lobby/core";
import { hasBreakGlassAdmin } from "@lobby/core/admin";
import { currentUser } from "@/server/auth";

/**
 * Wizard access rule: before any break-glass admin exists, only the admin step is reachable
 * (by anyone, it is how a fresh install is claimed). Afterwards every step needs an admin session.
 */
export async function guardSetup(step: SetupStep | "done") {
  if (!(await hasBreakGlassAdmin())) {
    if (step !== "admin") redirect("/setup/admin");
    return null;
  }
  const ctx = await currentUser();
  if (!ctx) redirect(`/sign-in?mode=admin&returnTo=${encodeURIComponent(`/setup/${step}`)}`);
  if (!ctx.has("admin")) forbidden();
  return ctx;
}

/** True when the admin step must ask for LOBBY_SETUP_TOKEN: a token is configured and the request is not from localhost. */
export async function setupTokenRequired(): Promise<boolean> {
  const { env } = await import("@lobby/core");
  if (!env.setupToken) return false;
  const { headers } = await import("next/headers");
  const host = ((await headers()).get("host") ?? "").toLowerCase();
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0]!;
  return !["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

/** Constant-time comparison against LOBBY_SETUP_TOKEN. */
export async function setupTokenMatches(given: string): Promise<boolean> {
  const { env } = await import("@lobby/core");
  const { timingSafeEqual } = await import("node:crypto");
  const a = Buffer.from(given.trim(), "utf8");
  const b = Buffer.from(env.setupToken, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
