import { db, inArray, s } from "@lobby/db";

export interface ApprovalProgress {
  /** Steps already approved. */
  done: number;
  /** Approval steps on the request (a two-step request is 2). */
  total: number;
}

/**
 * How far a request has come through its approvals, for list views that only carry the ticket
 * status. A two-step request with one approver done reads "1 of 2 approved" instead of a bare
 * "Approval", so the requester's view never contradicts the first approver's "Approved".
 * Server only: list pages call it with the ids of their pending_approval tickets.
 */
export async function approvalProgressFor(ticketIds: string[]): Promise<Map<string, ApprovalProgress>> {
  const out = new Map<string, ApprovalProgress>();
  if (!ticketIds.length) return out;
  const rows = await db
    .select({ ticketId: s.approvals.ticketId, step: s.approvals.step, status: s.approvals.status })
    .from(s.approvals)
    .where(inArray(s.approvals.ticketId, ticketIds));
  const steps = new Map<string, Map<number, string[]>>();
  for (const r of rows) {
    const t = steps.get(r.ticketId) ?? new Map<number, string[]>();
    t.set(r.step, [...(t.get(r.step) ?? []), r.status]);
    steps.set(r.ticketId, t);
  }
  for (const [id, t] of steps) {
    // A step is done when any of its rows approved it (a group step has one row per member).
    const done = [...t.values()].filter((st) => st.includes("approved")).length;
    out.set(id, { done, total: t.size });
  }
  return out;
}
