"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { closeRequest, replyToRequest } from "@/app/(app)/help/_actions";

export function RequesterReplyBox({ ticketId, hint }: { ticketId: string; hint?: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const submit = () => {
    if (!body.trim()) {
      setError("Write something first.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await replyToRequest(ticketId, body);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setBody("");
      toast.success("Reply sent");
      router.refresh();
    });
  };
  return (
    <form
      className="cell overflow-hidden rounded-card transition-shadow duration-160 focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-accent-ring dark:glass"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor="requester-reply" className="sr-only">
        Reply
      </label>
      <Textarea
        id="requester-reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="Reply to the team..."
        rows={3}
        aria-invalid={error ? true : undefined}
        className="min-h-24 rounded-b-none border-0 bg-transparent shadow-none focus-visible:outline-none dark:bg-transparent"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2">
        <p
          className={error ? "text-small text-danger-text" : "text-caption text-subtle"}
          role={error ? "alert" : undefined}
        >
          {error ?? hint ?? "The team gets an email when you reply."}
        </p>
        <Button type="submit" size="sm" loading={pending}>
          <Send />
          Send reply
        </Button>
      </div>
    </form>
  );
}

export function CloseRequestButton({
  ticketId,
  mode,
}: {
  ticketId: string;
  mode: "cancel" | "close";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const run = () =>
    start(async () => {
      const r = await closeRequest(ticketId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setOpen(false);
      toast.success(mode === "cancel" ? "Request cancelled" : "Request closed");
      router.refresh();
    });
  if (mode === "close") {
    return (
      <Button
        variant="secondary"
        onClick={run}
        loading={pending}
        aria-label="Close request"
        className="w-10 px-0 sm:w-auto sm:px-4 md:px-3.5"
      >
        <CircleCheck />
        <span className="hidden sm:inline">Close request</span>
      </Button>
    );
  }
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        aria-label="Cancel request"
        className="w-10 px-0 sm:w-auto sm:px-4 md:px-3.5"
      >
        <XCircle />
        <span className="hidden sm:inline">Cancel request</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Cancel this request?</DialogTitle>
            <DialogDescription>
              The team stops working on it and any pending approvals are withdrawn. You can raise a
              new one later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={run} loading={pending}>
              Cancel request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
