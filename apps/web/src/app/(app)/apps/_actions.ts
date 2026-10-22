"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppBySlug, isAppVisible, listMyOpenAccessRequests, pinApp, reorderPins, unpinApp } from "@lobby/core/apps";
import { requireUser } from "@/server/auth";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const id = z.uuid();

function refresh() {
  revalidatePath("/apps");
  revalidatePath("/");
}

export async function pinAppAction(appId: string): Promise<ActionResult> {
  const ctx = await requireUser();
  const parsed = id.safeParse(appId);
  if (!parsed.success) return { ok: false, error: "That app could not be found." };
  try {
    await pinApp(ctx, parsed.data);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not pin that app." };
  }
  refresh();
  return { ok: true };
}

export async function unpinAppAction(appId: string): Promise<ActionResult> {
  const ctx = await requireUser();
  const parsed = id.safeParse(appId);
  if (!parsed.success) return { ok: false, error: "That app could not be found." };
  await unpinApp(ctx, parsed.data);
  refresh();
  return { ok: true };
}

export async function reorderPinsAction(appIds: string[]): Promise<ActionResult<{ order: string[] }>> {
  const ctx = await requireUser();
  const parsed = z.array(id).max(200).safeParse(appIds);
  if (!parsed.success) return { ok: false, error: "Could not save that order." };
  const order = await reorderPins(ctx, parsed.data);
  refresh();
  return { ok: true, order };
}

const requestSchema = z.object({
  slug: z.string().min(1).max(64),
  reason: z.string().trim().min(3, "Tell the app owner a little about why you need it.").max(1000),
});

export async function requestAccessAction(input: {
  slug: string;
  reason: string;
}): Promise<ActionResult<{ number: number }>> {
  const ctx = await requireUser();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const app = await getAppBySlug(parsed.data.slug);
  if (!app || !app.requestAccessEnabled) return { ok: false, error: "That app does not take access requests." };
  if (isAppVisible(app.groupIds, ctx.groupIds)) return { ok: false, error: `You already have access to ${app.name}.` };
  const pending = (await listMyOpenAccessRequests(ctx)).get(app.slug);
  if (pending) return { ok: false, error: `You already asked for ${app.name}. Request #${pending.number} is open.` };

  let createTicket: typeof import("@lobby/core/helpdesk").createTicket | undefined;
  try {
    ({ createTicket } = await import("@lobby/core/helpdesk"));
  } catch {
    createTicket = undefined;
  }
  if (typeof createTicket !== "function") {
    return { ok: false, error: "Access requests are not switched on yet. Ask in Help or contact IT directly." };
  }
  try {
    const ticket = await createTicket(ctx, {
      requestTypeSlug: "app-access",
      subject: `Access to ${app.name}`,
      description: parsed.data.reason,
      // access_level is required by the starter "app-access" form; a launcher request is for standard access.
      fields: { app: app.slug, reason: parsed.data.reason, access_level: "Standard" },
      source: "access_request",
    });
    refresh();
    revalidatePath("/help");
    return { ok: true, number: ticket.number };
  } catch (e) {
    const fieldErrors = (e as { fieldErrors?: Record<string, string> })?.fieldErrors;
    const detail = fieldErrors ? Object.values(fieldErrors).join(" ") : "";
    console.error("[apps] access request failed", e);
    return {
      ok: false,
      error: e instanceof Error
        ? `Could not send the request. ${e.message}${detail ? ` ${detail}` : ""}`
        : "Could not send the request. Try again in a moment.",
    };
  }
}
