import { timeAgo } from "@/lib/time";
import type { TicketStatus } from "./status";

/**
 * The data behind the request track, safe to call from server components (request-track.tsx is
 * a client module). Pages build the stages and pass them down as plain props.
 */

export type StageState = "done" | "current" | "waiting" | "failed" | "upcoming";

export interface TrackStage {
  key: "raised" | "approval" | "team" | "resolved";
  label: string;
  detail?: string;
  state: StageState;
}

export interface TrackInput {
  status: TicketStatus;
  createdAt: Date | string;
  teamName: string;
  assigneeName?: string | null;
  pickedUpAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  /** Leave out when the request never needed approval (or it is not known, in a list). */
  approval?: {
    state: "pending" | "approved" | "rejected";
    who?: string | null;
    group?: boolean;
    at?: Date | string | null;
    /** Multi-step approvals: steps approved so far of all steps. Labels the stage "1 of 2 approved". */
    progress?: { done: number; total: number } | null;
  } | null;
  perspective?: "requester" | "agent";
}

export function buildStages(i: TrackInput): TrackStage[] {
  const s = i.status;
  const rejected = s === "rejected";
  const finished = s === "resolved" || s === "closed";
  const approval =
    i.approval ?? (s === "pending_approval" ? { state: "pending" as const } : rejected ? { state: "rejected" as const } : null);
  const out: TrackStage[] = [{ key: "raised", label: "Raised", detail: timeAgo(i.createdAt), state: "done" }];
  if (approval) {
    out.push({
      key: "approval",
      label:
        approval.state === "approved"
          ? "Approved"
          : approval.state === "rejected"
            ? "Not approved"
            : approval.progress && approval.progress.total > 1 && approval.progress.done > 0
              ? `${approval.progress.done} of ${approval.progress.total} approved`
              : "Approval",
      detail:
        approval.state === "pending"
          ? approval.who
            ? `${approval.group ? approval.who : approval.who.split(" ")[0]} decides`
            : "Waiting"
          : approval.at
            ? timeAgo(approval.at)
            : (approval.who ?? undefined),
      state: approval.state === "pending" ? "current" : approval.state === "rejected" ? "failed" : "done",
    });
  }
  const teamState: StageState =
    rejected || s === "pending_approval" ? "upcoming" : finished ? "done" : s === "waiting_on_requester" ? "waiting" : "current";
  out.push({
    key: "team",
    label:
      teamState === "waiting"
        ? i.perspective === "agent"
          ? "Awaiting reply"
          : "Waiting on you"
        : `With ${i.teamName}`,
    detail:
      teamState === "upcoming"
        ? rejected
          ? "Not needed"
          : "After approval"
        : i.assigneeName
          ? i.assigneeName
          : i.pickedUpAt
            ? timeAgo(i.pickedUpAt)
            : "Not picked up yet",
    state: teamState,
  });
  out.push({
    key: "resolved",
    label: s === "closed" ? "Closed" : "Resolved",
    detail: finished && i.resolvedAt ? timeAgo(i.resolvedAt) : finished ? "Done" : undefined,
    state: finished ? "done" : "upcoming",
  });
  return out;
}


/** The approval summary for a ticket's track, from its approval steps. */
export function approvalForTrack(
  approvals: { status: string; approverName: string | null; groupName: string | null; decidedAt: Date | string | null }[],
): TrackInput["approval"] {
  if (!approvals.length) return null;
  const rejected = approvals.find((a) => a.status === "rejected");
  if (rejected) return { state: "rejected", at: rejected.decidedAt };
  const pending = approvals.find((a) => a.status === "pending");
  const progress = { done: approvals.filter((a) => a.status === "approved").length, total: approvals.length };
  if (pending)
    return pending.approverName
      ? { state: "pending", who: pending.approverName, progress }
      : { state: "pending", who: pending.groupName, group: true, progress };
  const last = approvals[approvals.length - 1]!;
  return { state: "approved", at: last.decidedAt };
}

/** The hero's one sentence: what is happening to this request right now, in the reader's words. */
export function headlineFor(i: TrackInput & { approverName?: string | null }): string {
  const first = (n?: string | null) => (n ? n.split(" ")[0] : null);
  switch (i.status) {
    case "pending_approval": {
      const a = i.approval?.state === "pending" ? i.approval : null;
      const who = i.approverName ? first(i.approverName) : a?.who ? (a.group ? `the ${a.who}` : first(a.who)) : null;
      return who ? `Waiting for ${who} to approve` : "Waiting for approval";
    }
    case "rejected":
      return "This wasn't approved";
    case "new":
      return `Received. ${i.teamName} picks it up next`;
    case "open":
      return i.assigneeName ? `${i.assigneeName} is working on it` : `${i.teamName} is on it`;
    case "waiting_on_requester":
      return i.perspective === "agent" ? "Waiting on the requester's reply" : `${i.teamName} is waiting on your reply`;
    case "resolved":
      return "Resolved. Is it fixed for you?";
    case "closed":
      return "Closed";
    default:
      return "";
  }
}

/** "3h 9m", "1d 4h", "12m": a duration as an agent reads it in a queue. */
export function compact(ms: number) {
  const mins = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m && h < 10 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** The agent's headline for a ticket: who has it and what it is waiting on. */
export function agentHeadline(i: {
  status: string;
  assigneeName: string | null;
  assigneeIsMe: boolean;
  requesterFirstName: string;
  teamName: string;
}): string {
  switch (i.status) {
    case "pending_approval":
      return "Waiting for approval before the clock starts";
    case "rejected":
      return "Not approved, so nothing to do";
    case "new":
    case "open":
      if (!i.assigneeName) return `Nobody in ${i.teamName} has picked this up`;
      return i.assigneeIsMe ? "You're on this one" : `${i.assigneeName} is on it`;
    case "waiting_on_requester":
      return `Waiting on ${i.requesterFirstName}'s reply`;
    case "resolved":
      return `Resolved. Waiting for ${i.requesterFirstName} to confirm`;
    case "closed":
      return "Closed";
    default:
      return "";
  }
}

/** How long ago a moment passed, as compact text ("1d 4h"). */
export function overdueBy(due: Date | string, now = Date.now()) {
  return compact(now - new Date(due).getTime());
}

/** A form answer as a reader expects it: an amount whose label names a currency ("Amount (GBP)") reads "£1,199.00". */
export function formatFieldValue(f: { label: string; type: string; value: string }): string {
  const code = /\(([A-Z]{3})\)/.exec(f.label)?.[1];
  const n = Number(f.value.replace(/,/g, ""));
  if (f.type === "number" && code && f.value.trim() !== "" && Number.isFinite(n)) {
    try {
      return new Intl.NumberFormat("en-GB", { style: "currency", currency: code }).format(n);
    } catch {
      return f.value;
    }
  }
  return f.value;
}
