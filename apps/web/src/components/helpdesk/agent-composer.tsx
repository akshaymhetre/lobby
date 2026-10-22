"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, MessageSquareText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { LayoutGroup, SlidingPill } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { postComment } from "@/app/(app)/queue/_actions";

export interface CannedReply {
  id: string;
  title: string;
  body: string;
}

/**
 * Reply to the requester or leave an internal note. The two modes look clearly different
 * (amber, with a lock) so an agent never posts a private note publicly by accident.
 */
export function AgentComposer({
  ticketId,
  requesterFirstName,
  canned,
  closed,
}: {
  ticketId: string;
  requesterFirstName: string;
  canned: CannedReply[];
  closed: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"reply" | "note">(closed ? "note" : "reply");
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const pillId = React.useId();
  const note = mode === "note";

  const submit = () => {
    if (!body.trim()) {
      setError("Write something first.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await postComment(ticketId, body, note);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setBody("");
      toast.success(note ? "Internal note added" : `Reply sent to ${requesterFirstName}`);
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card transition-[box-shadow,background-color] duration-160 focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-accent-ring",
        note ? "bg-warning-soft shadow-cell focus-within:outline-warning dark:bg-warning-soft/60" : "cell dark:glass",
      )}
    >
      <LayoutGroup id={pillId}>
        <div role="tablist" aria-label="Message type" className="flex items-center px-2 pt-2">
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full p-1",
              note ? "bg-warning/10 dark:bg-black/20" : "bg-sunken",
            )}
          >
            {(
              [
                ["reply", `Reply to ${requesterFirstName}`, <MessageSquareText key="r" />],
                ["note", "Internal note", <Lock key="n" />],
              ] as const
            ).map(([key, label, icon]) => {
              const active = mode === key;
              const disabled = key === "reply" && closed;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={disabled}
                  onClick={() => {
                    setMode(key);
                    ref.current?.focus();
                  }}
                  className={cn(
                    "focus-ring touch-target relative isolate inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-small font-medium transition-colors duration-160 disabled:opacity-50 md:h-7 [&_svg]:size-3.5 [&_svg]:stroke-[1.75]",
                    active
                      ? key === "note"
                        ? "text-warning-text"
                        : "text-fg"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {active ? (
                    <SlidingPill
                      layoutId={`${pillId}-pill`}
                      className={cn(
                        "rounded-full",
                        key === "note" ? "bg-raised shadow-cell dark:bg-warning/20" : "cell",
                      )}
                    />
                  ) : null}
                  {icon}
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </LayoutGroup>
      <label htmlFor="agent-composer" className="sr-only">
        {note ? "Internal note" : "Reply"}
      </label>
      <Textarea
        id="agent-composer"
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        rows={4}
        placeholder={
          note
            ? "Only the team sees this. Notes are never sent to the requester."
            : `Write to ${requesterFirstName}. They'll get an email.`
        }
        className="min-h-28 rounded-none border-0 bg-transparent shadow-none focus-visible:outline-none dark:bg-transparent"
      />
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2",
          note ? "border-warning/25" : "border-border",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {canned.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MessageSquareText />
                  Canned replies
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[300px]">
                <DropdownMenuLabel>Insert a saved reply</DropdownMenuLabel>
                {canned.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onSelect={() => {
                      setBody((b) => (b.trim() ? `${b.trimEnd()}\n\n${c.body}` : c.body));
                      window.setTimeout(() => ref.current?.focus(), 0);
                    }}
                    className="h-auto flex-col items-start gap-0.5 py-2 md:h-auto"
                  >
                    <span className="text-body text-fg">{c.title}</span>
                    <span className="line-clamp-1 text-caption text-muted">{c.body}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {error ? (
            <p role="alert" className="text-small text-danger-text">
              {error}
            </p>
          ) : (
            <p className="hidden text-caption text-subtle sm:block">Cmd + Enter to send</p>
          )}
        </div>
        <Button
          size="sm"
          onClick={submit}
          loading={pending}
          className={
            note ? "bg-warning text-warning-fg hover:bg-warning hover:brightness-95" : undefined
          }
        >
          {note ? <Lock /> : <Send />}
          {note ? "Add note" : "Send reply"}
        </Button>
      </div>
    </div>
  );
}

/** "Reply now" on a breached ticket: brings the composer into view and puts the caret in it. */
export function FocusComposerButton({ label = "Reply now" }: { label?: string }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      className="w-full shrink-0 sm:w-auto"
      onClick={() => {
        const el = document.getElementById("agent-composer") as HTMLTextAreaElement | null;
        if (!el) return;
        el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        el.focus({ preventScroll: true });
      }}
    >
      <Send />
      {label}
    </Button>
  );
}
