"use server";

import { revalidatePath } from "next/cache";
import { decideApproval, HelpdeskError } from "@lobby/core/helpdesk";
import { requireUser } from "@/server/auth";

export type DecideResult = { ok: true; ticketNumber: number; outcome: "approved_step" | "approved_final" | "rejected" } | { ok: false; error: string };

export async function decide(approvalId: string, decision: "approved" | "rejected", comment: string): Promise<DecideResult> {
  const ctx = await requireUser();
  if (decision !== "approved" && decision !== "rejected") return { ok: false, error: "Choose approve or reject." };
  try {
    const r = await decideApproval(ctx, String(approvalId), decision, String(comment ?? ""));
    revalidatePath("/approvals");
    revalidatePath("/help", "layout");
    revalidatePath("/queue", "layout");
    return { ok: true, ...r };
  } catch (err) {
    if (err instanceof HelpdeskError) return { ok: false, error: err.message };
    console.error("[approvals]", err);
    return { ok: false, error: "We couldn't record that. Try again in a moment." };
  }
}
