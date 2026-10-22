"use server";

import { revalidatePath } from "next/cache";
import { addComment, assignTickets, HelpdeskError, setPriority, setStatus, type Priority, type TicketStatus } from "@lobby/core/helpdesk";
import { requireRole } from "@/server/auth";

export type QueueActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function run(fn: () => Promise<unknown>, fallback: string): Promise<QueueActionResult> {
  try {
    await fn();
    revalidatePath("/queue", "layout");
    revalidatePath("/help", "layout");
    return { ok: true };
  } catch (err) {
    if (err instanceof HelpdeskError) return { ok: false, error: err.message };
    console.error("[queue]", err);
    return { ok: false, error: fallback };
  }
}

// Every action re-checks the user (agent role) here and the row-level team access in core.

export async function postComment(ticketId: string, body: string, internal: boolean): Promise<QueueActionResult> {
  const ctx = await requireRole("agent");
  return run(() => addComment(ctx, String(ticketId), { body: String(body ?? ""), internal: internal === true }), "We couldn't post that. Try again in a moment.");
}

export async function changeStatus(ticketId: string, status: TicketStatus): Promise<QueueActionResult> {
  const ctx = await requireRole("agent");
  return run(() => setStatus(ctx, String(ticketId), status), "We couldn't change the status.");
}

export async function changePriority(ticketId: string, priority: Priority): Promise<QueueActionResult> {
  const ctx = await requireRole("agent");
  return run(() => setPriority(ctx, String(ticketId), priority), "We couldn't change the priority.");
}

export async function assign(ticketIds: string[], assigneeId: string | null): Promise<QueueActionResult> {
  const ctx = await requireRole("agent");
  const ids = Array.isArray(ticketIds) ? ticketIds.map(String).slice(0, 200) : [];
  return run(() => assignTickets(ctx, ids, assigneeId ? String(assigneeId) : null), "We couldn't assign that.");
}
