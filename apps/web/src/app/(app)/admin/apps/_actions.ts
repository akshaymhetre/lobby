"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createApp, deleteApp, getPreset, hasPlaceholder, safeLaunchUrl, updateApp } from "@lobby/core/apps";
import { indexApp } from "@lobby/core/apps/index-source";
import { requireAdmin } from "@/server/auth";

export type AdminResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

const appSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Give the app a name.").max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(200, "Keep the description under 200 characters.").optional().default(""),
  category: z.string().trim().min(1, "Choose or type a category.").max(40, "Keep the category short."),
  icon: z.string().trim().max(500).optional().default(""),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Use a colour like #2A5FE6.")
    .optional()
    .or(z.literal("")),
  launchUrl: z.string().trim().min(1, "Add the address people should open."),
  launchType: z.enum(["sso_link", "idp_initiated", "bookmark"]),
  ownerId: z.uuid().nullable().optional(),
  requestAccessEnabled: z.boolean(),
  groupIds: z.array(z.uuid()).max(100),
  presetKey: z.string().max(40).nullable().optional(),
});

export type AppFormInput = z.input<typeof appSchema>;

function refresh() {
  revalidatePath("/admin/apps");
  revalidatePath("/apps");
  revalidatePath("/");
}

async function reindex(id: string) {
  try {
    await indexApp(id);
  } catch (e) {
    console.error("[apps] reindex failed", e);
  }
}

export async function saveAppAction(input: AppFormInput): Promise<AdminResult<{ id: string; slug: string }>> {
  const ctx = await requireAdmin();
  const parsed = appSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Some fields need attention.", fieldErrors };
  }
  const v = parsed.data;
  if (hasPlaceholder(v.launchUrl)) {
    return {
      ok: false,
      error: "Some fields need attention.",
      fieldErrors: { launchUrl: "Replace the part in curly brackets with your company's own value." },
    };
  }
  if (!safeLaunchUrl(v.launchUrl)) {
    return {
      ok: false,
      error: "Some fields need attention.",
      fieldErrors: { launchUrl: "Use a full web address that starts with https:// or http://." },
    };
  }
  if (v.icon && !v.icon.startsWith("preset:") && !v.icon.startsWith("https://") && !v.icon.startsWith("/icons/")) {
    return { ok: false, error: "Some fields need attention.", fieldErrors: { icon: "Use an https:// image address." } };
  }
  if (v.icon.startsWith("preset:") && !getPreset(v.icon.slice(7))) {
    return { ok: false, error: "Some fields need attention.", fieldErrors: { icon: "Choose an icon from the list." } };
  }
  const data = {
    name: v.name,
    description: v.description,
    category: v.category,
    icon: v.icon || null,
    color: v.color || null,
    launchUrl: v.launchUrl,
    launchType: v.launchType,
    ownerId: v.ownerId ?? null,
    requestAccessEnabled: v.requestAccessEnabled,
    groupIds: v.groupIds,
    presetKey: v.presetKey ?? null,
  };
  try {
    const row = v.id ? await updateApp(ctx, v.id, data) : await createApp(ctx, data);
    await reindex(row.id);
    refresh();
    return { ok: true, id: row.id, slug: row.slug };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the app." };
  }
}

export async function deleteAppAction(id: string): Promise<AdminResult> {
  const ctx = await requireAdmin();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "That app could not be found." };
  try {
    await deleteApp(ctx, parsed.data);
    await reindex(parsed.data);
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete the app." };
  }
}
