"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, markSetupStep, SESSION_COOKIE, SETUP_STEPS, type SetupStep } from "@lobby/core";
import { createBreakGlassAdmin, hasBreakGlassAdmin, ValidationError } from "@lobby/core/admin";
import { cookieOptions, requireAdmin } from "@/server/auth";
import { nextStepPath } from "@/components/setup/steps";
import type { ActionResult } from "@/app/(app)/admin/_actions";
import { setupTokenMatches, setupTokenRequired } from "./_guard";

/** First step: the break-glass admin. Refused once one exists. Signs the new admin in. */
export async function createAdminAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  if (await hasBreakGlassAdmin()) return { ok: false, error: "An administrator already exists. Sign in to continue setup." };
  if ((await setupTokenRequired()) && !(await setupTokenMatches(String(form.get("setupToken") ?? "")))) {
    return {
      ok: false,
      error: "That setup token is not right, so no account was created.",
      fieldErrors: { setupToken: "This does not match LOBBY_SETUP_TOKEN. Copy it again from deploy/.env." },
    };
  }
  let userId: string;
  try {
    ({ userId } = await createBreakGlassAdmin({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    }));
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    console.error("[setup] admin creation failed", err);
    return { ok: false, error: "Lobby could not create the account. Check the server log and try again." };
  }
  const h = await headers();
  const { token, maxAgeSeconds } = await createSession(userId, { userAgent: h.get("user-agent") ?? undefined });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(maxAgeSeconds));
  revalidatePath("/setup", "layout");
  redirect("/setup/company");
}

function stepFrom(form: FormData): SetupStep | null {
  const step = String(form.get("_setupStep") ?? "");
  return (SETUP_STEPS as readonly string[]).includes(step) ? (step as SetupStep) : null;
}

export async function skipStepAction(form: FormData) {
  await requireAdmin();
  const step = stepFrom(form);
  if (!step || step === "admin") redirect("/setup");
  await markSetupStep(step, "skipped");
  revalidatePath("/setup", "layout");
  redirect(nextStepPath(step));
}

export async function completeStepAction(form: FormData) {
  await requireAdmin();
  const step = stepFrom(form);
  if (!step) redirect("/setup");
  await markSetupStep(step, "done");
  revalidatePath("/setup", "layout");
  redirect(nextStepPath(step));
}

export interface InstallOutcome {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

type Preset = { key: string; name: string; launchUrl?: string };

/** Creates the chosen app presets through the apps module, if it is installed. */
export async function installAppsAction(keys: string[], tenant: string): Promise<{ results: InstallOutcome[] }> {
  const ctx = await requireAdmin();
  const results: InstallOutcome[] = [];
  let mod: Record<string, unknown>;
  try {
    const name = "apps";
    mod = (await import(`@lobby/core/${name}/index`)) as Record<string, unknown>;
  } catch {
    return { results: [{ key: "apps", label: "Apps", ok: false, detail: "The app launcher is not installed in this build yet. Add apps later from Admin, Apps." }] };
  }
  const presets = (Array.isArray(mod.APP_PRESETS) ? mod.APP_PRESETS : Object.values((mod.APP_PRESETS as object) ?? {})) as Preset[];
  const create = mod.createAppFromPreset as
    | ((c: typeof ctx, key: string, o: { groupIds: string[]; launchUrl?: string }) => Promise<unknown>)
    | undefined;
  const { getOrgSettings } = await import("@lobby/core");
  const domain = (await getOrgSettings()).emailDomain ?? "";
  const slug = tenant.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  for (const key of [...new Set(keys)].slice(0, 50)) {
    const preset = presets.find((p) => p.key === key);
    if (!preset || typeof create !== "function") {
      results.push({ key, label: key, ok: false, detail: "Not a known app." });
      continue;
    }
    try {
      const needsTenant = preset.launchUrl?.includes("{tenant}");
      const needsDomain = preset.launchUrl?.includes("{domain}");
      if ((needsTenant && !slug) || (needsDomain && !domain)) {
        results.push({ key, label: preset.name, ok: false, detail: needsTenant ? "Needs your workspace name." : "Needs your email domain from the Company step." });
        continue;
      }
      const launchUrl = preset.launchUrl?.replace(/\{tenant\}/g, slug).replace(/\{domain\}/g, domain);
      await create(ctx, key, { groupIds: [], launchUrl });
      results.push({ key, label: preset.name, ok: true, detail: "Added for everyone" });
    } catch (err) {
      results.push({ key, label: preset.name, ok: false, detail: err instanceof Error ? err.message : "Could not be added." });
    }
  }
  if (results.some((r) => r.ok)) {
    const { audit } = await import("@lobby/core");
    await audit(ctx.user.id, "setup.apps_added", { type: "setup", id: "apps" }, { keys: results.filter((r) => r.ok).map((r) => r.key) });
    await markSetupStep("apps", "done");
    revalidatePath("/", "layout");
  }
  return { results };
}

const CONTENT = {
  knowledge: { module: "knowledge", fn: "installStarterContent", label: "Starter knowledge spaces and pages" },
  helpdesk: { module: "helpdesk", fn: "installStarterCatalog", label: "IT and HR request types" },
  journeys: { module: "journeys", fn: "installStarterJourneys", label: "Onboarding journeys" },
} as const;
export type ContentKey = keyof typeof CONTENT;

/** Runs each chosen starter installer. Each is idempotent and owned by its module. */
export async function installContentAction(keys: ContentKey[]): Promise<{ results: InstallOutcome[] }> {
  const ctx = await requireAdmin();
  const results: InstallOutcome[] = [];
  for (const key of keys) {
    const spec = CONTENT[key];
    if (!spec) continue;
    let mod: Record<string, unknown>;
    try {
      mod = (await import(`@lobby/core/${spec.module}/index`)) as Record<string, unknown>;
    } catch {
      results.push({ key, label: spec.label, ok: false, detail: "This module is not installed in this build yet." });
      continue;
    }
    const fn = mod[spec.fn] as (() => Promise<unknown>) | undefined;
    if (typeof fn !== "function") {
      results.push({ key, label: spec.label, ok: false, detail: "This module does not offer starter content yet." });
      continue;
    }
    try {
      const out = await fn();
      results.push({ key, label: spec.label, ok: true, detail: describe(out) });
    } catch (err) {
      results.push({ key, label: spec.label, ok: false, detail: err instanceof Error ? err.message : "It could not be installed." });
    }
  }
  const { audit } = await import("@lobby/core");
  await audit(ctx.user.id, "setup.starter_content_installed", { type: "setup", id: "content" }, {
    results: results.map((r) => ({ key: r.key, ok: r.ok })),
  });
  await markSetupStep("content", "done");
  revalidatePath("/", "layout");
  return { results };
}

function describe(out: unknown): string {
  if (Array.isArray(out)) {
    const names = out.filter((x): x is string => typeof x === "string");
    if (names.length) return `Added ${names.join(", ")}`;
    return out.length ? `Added ${out.length}` : "Already there, nothing new to add";
  }
  if (out && typeof out === "object") {
    const numbers = Object.entries(out as Record<string, unknown>).filter(([, v]) => typeof v === "number");
    if (numbers.length && numbers.every(([, v]) => v === 0)) return "Already there, nothing new to add";
    const counts = numbers
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => {
        const word = k.replace(/([A-Z])/g, " $1").toLowerCase();
        return `${v} ${v === 1 ? word.replace(/ies$/, "y").replace(/s$/, "") : word}`;
      });
    if (counts.length) return `Added ${counts.join(", ")}`;
  }
  return "Added";
}
