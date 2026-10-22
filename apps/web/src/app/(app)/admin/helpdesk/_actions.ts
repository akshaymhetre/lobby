"use server";

import { revalidatePath } from "next/cache";
import {
  deleteCalendar,
  deleteCannedReply,
  deleteConnector,
  deleteRequestType,
  deleteSlaPolicy,
  deleteTeam,
  HelpdeskError,
  installStarterCatalog,
  saveCalendar,
  saveCannedReply,
  saveConnector,
  saveRequestType,
  saveSlaPolicy,
  saveTeam,
} from "@lobby/core/helpdesk";
import { audit } from "@lobby/core";
import { testConnector } from "@lobby/connectors";
import { requireAdmin } from "@/server/auth";

export type AdminResult = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function run(fn: () => Promise<unknown>, done?: string): Promise<AdminResult> {
  try {
    await fn();
    revalidatePath("/admin/helpdesk");
    revalidatePath("/help", "layout");
    return { ok: true, message: done };
  } catch (err) {
    if (err instanceof HelpdeskError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    console.error("[admin/helpdesk]", err);
    return { ok: false, error: "That didn't save. Try again in a moment." };
  }
}

type Input<F extends (...a: never[]) => unknown> = Parameters<F>[1];

// requireAdmin() re-checks the acting user on every call; core re-checks ctx.has("admin") too.
export async function saveTeamAction(input: Input<typeof saveTeam>) {
  const ctx = await requireAdmin();
  return run(() => saveTeam(ctx, input), "Team saved");
}
export async function deleteTeamAction(id: string) {
  const ctx = await requireAdmin();
  return run(() => deleteTeam(ctx, String(id)), "Team deleted");
}
export async function saveRequestTypeAction(input: Input<typeof saveRequestType>) {
  const ctx = await requireAdmin();
  return run(() => saveRequestType(ctx, input), "Request type saved");
}
export async function deleteRequestTypeAction(id: string) {
  const ctx = await requireAdmin();
  return run(() => deleteRequestType(ctx, String(id)), "Request type deleted");
}
export async function saveSlaPolicyAction(input: Input<typeof saveSlaPolicy>) {
  const ctx = await requireAdmin();
  return run(() => saveSlaPolicy(ctx, input), "SLA policy saved");
}
export async function deleteSlaPolicyAction(id: string) {
  const ctx = await requireAdmin();
  return run(() => deleteSlaPolicy(ctx, String(id)), "SLA policy deleted");
}
export async function saveCalendarAction(input: Input<typeof saveCalendar>) {
  const ctx = await requireAdmin();
  return run(() => saveCalendar(ctx, input), "Calendar saved");
}
export async function deleteCalendarAction(id: string) {
  const ctx = await requireAdmin();
  return run(() => deleteCalendar(ctx, String(id)), "Calendar deleted");
}
export async function saveCannedReplyAction(input: Input<typeof saveCannedReply>) {
  const ctx = await requireAdmin();
  return run(() => saveCannedReply(ctx, input), "Reply saved");
}
export async function deleteCannedReplyAction(id: string) {
  const ctx = await requireAdmin();
  return run(() => deleteCannedReply(ctx, String(id)), "Reply deleted");
}
export async function saveConnectorAction(input: Input<typeof saveConnector>) {
  const ctx = await requireAdmin();
  return run(() => saveConnector(ctx, input), "Connector saved");
}
export async function deleteConnectorAction(id: string) {
  const ctx = await requireAdmin();
  return run(() => deleteConnector(ctx, String(id)), "Connector deleted");
}

export async function testConnectorAction(id: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await requireAdmin();
  const r = await testConnector(String(id));
  await audit(ctx.user.id, "helpdesk.connector_tested", { type: "connector", id: String(id) }, { ok: r.ok });
  return r;
}

export async function installStarterAction(): Promise<AdminResult> {
  const ctx = await requireAdmin();
  return run(async () => {
    const r = await installStarterCatalog();
    await audit(ctx.user.id, "helpdesk.starter_catalog_requested", undefined, r);
  }, "Starter catalog installed");
}
