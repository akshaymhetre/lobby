import type { BadgeTone } from "@/components/ui/badge";

/** Status and priority vocabulary, safe to use from server and client components. */
export type TicketStatus = "new" | "open" | "pending_approval" | "waiting_on_requester" | "resolved" | "closed" | "rejected";
export type Priority = "low" | "normal" | "high" | "urgent";

/*
 * v2: a request or approval under way is the cat-blue category (the same blue the Home planner
 * draws it in), so status reads as "a request" rather than as the brand accent. Waiting on the
 * requester stays amber, done is green, not approved is red, closed is neutral.
 */
const STATUS: Record<TicketStatus, { label: string; agentLabel?: string; tone: BadgeTone }> = {
  new: { label: "Received", agentLabel: "New", tone: "blue" },
  open: { label: "In progress", agentLabel: "Open", tone: "blue" },
  pending_approval: { label: "Waiting for approval", agentLabel: "In approval", tone: "blue" },
  waiting_on_requester: { label: "Waiting on you", agentLabel: "Awaiting reply", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
  rejected: { label: "Not approved", tone: "danger" },
};

export const STATUS_TONE = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.tone])) as Record<TicketStatus, BadgeTone>;

export const statusLabel = (s: TicketStatus, perspective: "requester" | "agent" = "requester") =>
  (perspective === "agent" ? STATUS[s].agentLabel : undefined) ?? STATUS[s].label;

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];
