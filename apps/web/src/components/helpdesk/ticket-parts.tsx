import * as React from "react";
import { Check, CircleDashed, Clock3, X } from "lucide-react";
import type { TicketDetail } from "@lobby/core/helpdesk";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/time";
import { SlaDue } from "./badges";
import { ApprovalDecision } from "./approval-decision";
import { formatFieldValue } from "./track-data";

/** The request's form answers and description, as a definition list. */
export function FieldList({
  fields,
  description: raw,
}: {
  fields: TicketDetail["fields"];
  description: string;
}) {
  // Callers like the app launcher repeat the reason as the description; don't show it twice.
  const description = fields.some((f) => f.value.trim() === raw.trim()) ? "" : raw;
  if (!fields.length && !description)
    return <p className="text-body text-muted">No details were added.</p>;
  return (
    <div className="flex flex-col gap-4">
      {fields.length ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div
              key={f.key}
              className={cn(
                "flex min-w-0 flex-col gap-0.5",
                f.type === "textarea" && "sm:col-span-2",
              )}
            >
              <dt className="text-caption text-muted">{f.label}</dt>
              <dd className="tabular whitespace-pre-wrap break-words text-body text-fg">{formatFieldValue(f)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {description ? (
        <div
          className={cn("flex flex-col gap-0.5", fields.length && "border-t border-border pt-4")}
        >
          <p className="text-caption text-muted">Details</p>
          <p className="whitespace-pre-wrap break-words text-body text-fg">{description}</p>
        </div>
      ) : null}
    </div>
  );
}

/** Approval steps as a small vertical progress list, with decide buttons when it's the viewer's turn. */
export function ApprovalSteps({
  approvals,
  subject,
  requesterName,
}: {
  approvals: TicketDetail["approvals"];
  subject: string;
  requesterName: string;
}) {
  if (!approvals.length) return null;
  return (
    <ol className="flex flex-col gap-3">
      {approvals.map((a) => {
        const who = a.approverName ?? (a.groupName ? `Anyone in ${a.groupName}` : "An approver");
        const icon =
          a.status === "approved" ? (
            <Check />
          ) : a.status === "rejected" ? (
            <X />
          ) : a.status === "pending" ? (
            <Clock3 />
          ) : (
            <CircleDashed />
          );
        return (
          <li key={a.id} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5 [&_svg]:stroke-[2]",
                a.status === "approved" && "bg-success-soft text-success-text",
                a.status === "rejected" && "bg-danger-soft text-danger-text",
                a.status === "pending" && "bg-warning-soft text-warning-text",
                a.status === "waiting" && "bg-sunken text-subtle",
              )}
              aria-hidden
            >
              {icon}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-body text-fg">
                <span className="font-medium">{who}</span>
                <span className="text-muted">
                  {" "}
                  {a.status === "approved"
                    ? `approved${a.decidedByName && a.decidedByName !== a.approverName ? ` (${a.decidedByName})` : ""}`
                    : a.status === "rejected"
                      ? `didn't approve${a.decidedByName && a.decidedByName !== a.approverName ? ` (${a.decidedByName})` : ""}`
                      : a.status === "pending"
                        ? "to approve"
                        : "approves next"}
                </span>
              </p>
              {a.decidedAt ? (
                <p className="text-caption text-subtle">{formatDateTime(a.decidedAt)}</p>
              ) : null}
              {a.comment ? <p className="text-small text-fg">&ldquo;{a.comment}&rdquo;</p> : null}
              {a.canDecide ? (
                <div className="pt-1">
                  <ApprovalDecision
                    approvalId={a.id}
                    subject={subject}
                    requesterName={requesterName}
                    size="sm"
                  />
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** `stacked` puts the value under the label, for a value that must not wrap mid-word (an email). */
export function DetailRow({
  label,
  children,
  stacked = false,
}: {
  label: string;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "gap-3 py-1.5",
        stacked ? "flex flex-col gap-0.5" : "grid grid-cols-[112px_minmax(0,1fr)] items-baseline",
      )}
    >
      <dt className="text-small text-muted">{label}</dt>
      <dd className="min-w-0 text-body text-fg">{children}</dd>
    </div>
  );
}

export function SlaRows({ ticket }: { ticket: TicketDetail["ticket"] }) {
  if (ticket.status === "pending_approval")
    return <DetailRow label="Targets">Start once it's approved</DetailRow>;
  if (!ticket.firstResponseDueAt && !ticket.resolutionDueAt)
    return <DetailRow label="Targets">None for this request</DetailRow>;
  return (
    <>
      <DetailRow label="First reply">
        <SlaDue
          due={ticket.firstResponseDueAt}
          doneAt={ticket.firstRespondedAt}
          breachedAt={ticket.firstResponseBreachedAt}
          label="First reply"
        />
      </DetailRow>
      <DetailRow label="Resolution">
        <SlaDue
          due={ticket.resolutionDueAt}
          doneAt={ticket.resolvedAt}
          breachedAt={ticket.resolutionBreachedAt}
          label="Resolution"
        />
      </DetailRow>
    </>
  );
}

export function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pb-3">
      <h2 className="text-body font-medium text-fg">{children}</h2>
      {aside}
    </div>
  );
}
