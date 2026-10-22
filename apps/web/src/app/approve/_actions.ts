"use server";

import { decideApproval, findApprovalByToken, HelpdeskError } from "@lobby/core/helpdesk";
import { requireUser } from "@/server/auth";
import type { DecideResult } from "@/app/(app)/approvals/_actions";

/**
 * Decides through a one-time email link. The signed-in user must still be the approver:
 * the link proves which approval it is, never who is deciding.
 */
export async function decideByToken(token: string, decision: "approved" | "rejected", comment: string): Promise<DecideResult> {
  const ctx = await requireUser();
  if (decision !== "approved" && decision !== "rejected") return { ok: false, error: "Choose approve or reject." };
  const found = await findApprovalByToken(String(token ?? ""));
  if (!found) return { ok: false, error: "This link has already been used or is no longer valid." };
  try {
    const r = await decideApproval(ctx, found.approval.id, decision, String(comment ?? ""), { token: String(token) });
    return { ok: true, ...r };
  } catch (err) {
    if (err instanceof HelpdeskError) return { ok: false, error: err.message };
    console.error("[approve]", err);
    return { ok: false, error: "We couldn't record that. Try again in a moment." };
  }
}
