"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { markSetupStep, type SetupStep } from "@lobby/core";
import {
  createScimToken, revokeScimToken, saveAiSettings, saveBranding, saveIdentitySettings, setRoleMappings,
  listGroupMembers, testIdentityDiscovery, ValidationError, MAPPABLE_ROLES, type MappableRole, type ProbeResult,
} from "@lobby/core/admin";
import { requireAdmin } from "@/server/auth";
import { IDP_TEST_RETURN_COOKIE } from "@/components/admin/constants";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T; next?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string | undefined> };


function fail(err: unknown): { ok: false; error: string; fieldErrors?: Record<string, string | undefined> } {
  if (err instanceof ValidationError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
  console.error("[admin]", err);
  return { ok: false, error: err instanceof Error ? err.message : "Something went wrong. Try again." };
}

const SETUP_ORDER: SetupStep[] = ["admin", "company", "identity", "people", "apps", "content"];
const nextSetupPath = (step: SetupStep) => {
  const i = SETUP_ORDER.indexOf(step);
  return i >= 0 && i < SETUP_ORDER.length - 1 ? `/setup/${SETUP_ORDER[i + 1]}` : "/setup/done";
};

/** When a shared form is submitted from the wizard, mark the step done and say where to go next. */
async function finishStep(form: FormData): Promise<string | undefined> {
  const step = form.get("_setupStep");
  if (typeof step !== "string" || !SETUP_ORDER.includes(step as SetupStep)) return undefined;
  await markSetupStep(step as SetupStep, "done");
  revalidatePath("/setup", "layout");
  return nextSetupPath(step as SetupStep);
}

export async function saveBrandingAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  try {
    await saveBranding(ctx.user.id, {
      companyName: String(form.get("companyName") ?? ""),
      productName: String(form.get("productName") ?? ""),
      logoUrl: String(form.get("logoUrl") ?? ""),
      accentColor: String(form.get("accentColor") ?? ""),
      timezone: String(form.get("timezone") ?? ""),
      workingDays: form.getAll("workingDays").map(Number),
      emailDomain: String(form.get("emailDomain") ?? ""),
    });
    const next = await finishStep(form);
    revalidatePath("/", "layout");
    return { ok: true, message: "Branding saved. Everyone sees the change on their next page load.", next };
  } catch (err) {
    return fail(err);
  }
}

const identityFrom = (form: FormData) => ({
  provider: String(form.get("provider") ?? "oidc") as "oidc",
  issuer: String(form.get("issuer") ?? ""),
  clientId: String(form.get("clientId") ?? ""),
  clientSecret: String(form.get("clientSecret") ?? ""),
  discoveryUrl: String(form.get("discoveryUrl") ?? ""),
  scopes: String(form.get("scopes") ?? ""),
  groupsClaim: String(form.get("groupsClaim") ?? ""),
});

export async function saveIdentityAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  try {
    const input = identityFrom(form);
    await saveIdentitySettings(ctx.user.id, input);
    revalidatePath("/admin/identity");
    revalidatePath("/setup/identity");
    return { ok: true, message: "Identity provider saved. Test the connection before you rely on it." };
  } catch (err) {
    return fail(err);
  }
}

export async function probeIdentityAction(input: { issuer: string; discoveryUrl?: string; clientId?: string }): Promise<ProbeResult> {
  await requireAdmin();
  return testIdentityDiscovery(input);
}

/** Starts a real sign-in round trip against the saved provider; the callback reports who signed in. */
export async function beginIdentityTestAction(form: FormData) {
  await requireAdmin();
  const back = String(form.get("returnTo") ?? "/setup/identity");
  const jar = await cookies();
  jar.set(IDP_TEST_RETURN_COOKIE, back === "/admin/identity" ? back : "/setup/identity", {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 600,
  });
  redirect("/auth/login?test=1");
}

export async function createScimTokenAction(name: string): Promise<ActionResult<{ token: string; name: string }>> {
  const ctx = await requireAdmin();
  try {
    const t = await createScimToken(ctx.user.id, name);
    revalidatePath("/admin");
    return { ok: true, data: { token: t.token, name: t.name } };
  } catch (err) {
    return fail(err);
  }
}

export async function revokeScimTokenAction(id: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "That token no longer exists." };
  const done = await revokeScimToken(ctx.user.id, id);
  revalidatePath("/admin/identity");
  revalidatePath("/setup/people");
  return done ? { ok: true, message: "Token revoked. Provisioning with it stops immediately." } : { ok: false, error: "That token no longer exists." };
}

export async function saveRoleMappingsAction(mappings: { groupName: string; role: string }[]): Promise<ActionResult> {
  const ctx = await requireAdmin();
  try {
    const clean = mappings
      .filter((m) => (MAPPABLE_ROLES as readonly string[]).includes(m.role) && m.groupName.trim())
      .map((m) => ({ groupName: m.groupName.trim().slice(0, 200), role: m.role as MappableRole }));
    const { added, removed } = await setRoleMappings(ctx.user.id, clean);
    revalidatePath("/admin/identity");
    const n = added.length + removed.length;
    return { ok: true, message: n ? "Role mappings saved. They apply at each person's next sign-in." : "Nothing changed." };
  } catch (err) {
    return fail(err);
  }
}

export async function groupMembersAction(groupId: string) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return [];
  return listGroupMembers(groupId);
}

export async function saveAiAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  try {
    const modelChoice = String(form.get("modelChoice") ?? "");
    await saveAiSettings(ctx.user.id, {
      enabled: form.get("enabled") === "on",
      provider: "anthropic",
      model: modelChoice === "custom" ? String(form.get("customModel") ?? "") : modelChoice,
      apiKey: String(form.get("apiKey") ?? ""),
      clearApiKey: form.get("clearApiKey") === "1",
      embeddingsProvider: String(form.get("embeddingsProvider") ?? "none") as "none",
      embeddingsModel: String(form.get("embeddingsModel") ?? ""),
      embeddingsKey: String(form.get("embeddingsKey") ?? ""),
      retentionDays: String(form.get("retentionDays") ?? "90") as unknown as number,
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Assistant settings saved." };
  } catch (err) {
    return fail(err);
  }
}

export type AiTestResult = { ok: true; model: string; latencyMs: number } | { ok: false; error: string };

/** Makes one tiny real call through @lobby/ai. A typed key is tested without being saved. */
export async function testAiAction(input: { apiKey?: string; model: string }): Promise<AiTestResult> {
  await requireAdmin();
  const model = input.model.trim();
  if (!model) return { ok: false, error: "Pick a model first." };
  try {
    const mod = (await import("@lobby/ai")) as Record<string, unknown>;
    const fn = mod.testAiConnection as ((i: { apiKey?: string; model: string }) => Promise<AiTestResult>) | undefined;
    if (typeof fn !== "function") {
      return { ok: false, error: "The assistant package is not installed in this build yet, so the connection cannot be tested." };
    }
    return await fn({ apiKey: input.apiKey?.trim() || undefined, model });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The test call failed." };
  }
}

export async function planConfigAction(yaml: string) {
  await requireAdmin();
  if (yaml.length > 2_000_000) return { sections: [], errors: ["That file is larger than 2 MB."], hasChanges: false };
  try {
    const { planImport } = await import("@lobby/config");
    return await planImport(yaml);
  } catch (err) {
    console.error("[config] plan failed", err);
    return { sections: [], errors: [`Lobby could not compare this file: ${err instanceof Error ? err.message.slice(0, 300) : "unknown error"}`], hasChanges: false };
  }
}

export async function applyConfigAction(yaml: string) {
  const ctx = await requireAdmin();
  if (yaml.length > 2_000_000) return { sections: [], errors: ["That file is larger than 2 MB."], hasChanges: false, applied: false };
  try {
    const { applyImport } = await import("@lobby/config");
    const result = await applyImport(yaml, ctx.user.id);
    if (result.applied) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    console.error("[config] apply failed", err);
    return { sections: [], errors: [`Nothing was written: ${err instanceof Error ? err.message.slice(0, 300) : "unknown error"}`], hasChanges: false, applied: false };
  }
}
