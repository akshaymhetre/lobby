"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { decide as decideById, type DecideResult } from "@/app/(app)/approvals/_actions";
import { decideByToken } from "@/app/approve/_actions";

/** What a review queue can drive from the keyboard. */
export interface ApprovalDecisionHandle {
  approve: () => void;
  reject: () => void;
}

/**
 * Approve right away, or reject with a reason (asked for in a dialog, since the requester
 * deserves to know why). An optional note can go with an approval too.
 *
 * One row of three: Reject (ghost, danger text), Approve with note (secondary), Approve.
 * Approve is filled only when `emphasis` is set, so a page of four approvals shows one primary
 * action, the one for the card under the reader's attention (audit E5). `shortcuts` shows the
 * A and R keys the queue listens for.
 */
export function ApprovalDecision({
  approvalId,
  token,
  subject,
  requesterName,
  onDone,
  size = "md",
  emphasis = true,
  shortcuts = false,
  ref,
  className,
}: {
  /** Decide in-app by approval id, or through an email link by its token. */
  approvalId?: string;
  token?: string;
  subject: string;
  requesterName: string;
  onDone?: (r: Extract<DecideResult, { ok: true }>) => void;
  size?: "sm" | "md";
  /** Fill the Approve button. Off for every card but the active one in a queue. */
  emphasis?: boolean;
  /** Show the A and R key hints. */
  shortcuts?: boolean;
  ref?: React.Ref<ApprovalDecisionHandle>;
  className?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"approved" | "rejected" | null>(null);
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const firstName = requesterName.split(" ")[0];

  const submit = (decision: "approved" | "rejected", note: string) => {
    if (decision === "rejected" && !note.trim()) {
      setError(`Tell ${firstName} why, so they know what to do next.`);
      return;
    }
    setError(null);
    start(async () => {
      const r = token
        ? await decideByToken(token, decision, note)
        : await decideById(approvalId ?? "", decision, note);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setMode(null);
      setComment("");
      toast.success(
        r.outcome === "rejected"
          ? `#${r.ticketNumber} wasn't approved`
          : r.outcome === "approved_final"
            ? `#${r.ticketNumber} approved and sent to the team`
            : `#${r.ticketNumber} approved, next approver notified`,
      );
      if (onDone) onDone(r);
      else router.refresh();
    });
  };

  React.useImperativeHandle(
    ref,
    () => ({
      approve: () => {
        if (!pending && mode === null) submit("approved", "");
      },
      reject: () => {
        if (!pending) setMode("rejected");
      },
    }),
    // submit closes over state that changes every render; the handle only needs the latest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, mode, approvalId, token],
  );

  return (
    <>
      {/* Approve first in the DOM (it is the primary action and what the keyboard reaches first), shown rightmost;
          on a phone it takes the full first row and the two quieter actions share the second. */}
      <div
        className={cn(
          "grid grid-cols-2 gap-2 sm:flex sm:flex-row-reverse sm:items-center sm:justify-end",
          className,
        )}
      >
        <Button
          size={size}
          variant={emphasis ? "primary" : "secondary"}
          onClick={() => submit("approved", "")}
          loading={pending && mode === null}
          className="col-span-2 sm:col-span-1"
        >
          <Check />
          Approve
          {shortcuts ? (
            <Kbd
              className={cn(
                "hidden md:inline-flex",
                emphasis &&
                  "border-accent-fg/30 bg-transparent text-accent-fg/90 shadow-none dark:bg-transparent",
              )}
            >
              A
            </Kbd>
          ) : null}
        </Button>
        <Button
          size={size}
          variant="secondary"
          onClick={() => setMode("approved")}
          disabled={pending}
          className="max-sm:w-full"
        >
          Approve with note
        </Button>
        <Button
          size={size}
          variant="ghost"
          onClick={() => setMode("rejected")}
          disabled={pending}
          className="text-danger-text hover:bg-danger-soft hover:text-danger-text max-sm:w-full"
        >
          <X />
          Reject
          {shortcuts ? <Kbd className="hidden md:inline-flex">R</Kbd> : null}
        </Button>
      </div>
      <Dialog
        open={mode !== null}
        onOpenChange={(o) => {
          if (!o) {
            setMode(null);
            setError(null);
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {mode === "rejected" ? "Reject this request?" : "Approve with a note"}
            </DialogTitle>
            <DialogDescription>
              {requesterName}: {subject}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field
              label={mode === "rejected" ? "Reason" : "Note"}
              required={mode === "rejected"}
              error={error}
              help={
                mode === "rejected" ? `${firstName} sees this.` : "Shown on the request's timeline."
              }
            >
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                autoFocus
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMode(null)}>
              Back
            </Button>
            <Button
              variant={mode === "rejected" ? "danger" : "primary"}
              onClick={() => mode && submit(mode, comment)}
              loading={pending}
            >
              {mode === "rejected" ? "Reject request" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
