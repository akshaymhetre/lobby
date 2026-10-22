"use client";

import * as React from "react";
import { Check, Hand } from "lucide-react";
import { sendGreetingAction } from "@/app/(app)/(home)/_actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

export interface JoinerItem {
  id: string;
  name: string;
  firstName: string;
  title: string | null;
  location: string | null;
  avatarUrl: string | null;
  phrase: string;
  /** Whole days until the start date; negative once they have started. */
  daysUntil: number;
  upcoming: boolean;
  greeted: boolean;
}

function suggestions(j: JoinerItem, company: string) {
  return j.upcoming
    ? [`Welcome aboard, ${j.firstName}! Looking forward to working with you.`, `Hi ${j.firstName}, see you soon. Shout if you have any questions before day one.`]
    : [`Welcome to ${company}, ${j.firstName}!`, `Hi ${j.firstName}, great to have you here. Happy to grab a coffee and show you around.`];
}

function SayHiDialog({
  joiner,
  company,
  onClose,
  onSent,
}: {
  joiner: JoinerItem;
  company: string;
  onClose: () => void;
  onSent: (id: string) => void;
}) {
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await sendGreetingAction(joiner.id, message);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSent(joiner.id);
      onClose();
      toast.success(`Said hi to ${joiner.firstName}`, { description: "They will see your message in their notifications." });
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-3">
              <Avatar name={joiner.name} src={joiner.avatarUrl} size="lg" />
              <div className="flex min-w-0 flex-col">
                <DialogTitle>Say hi to {joiner.firstName}</DialogTitle>
                <p className="truncate text-small text-muted">
                  {[joiner.title, joiner.location].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <DialogDescription>A short note goes a long way in someone&apos;s first weeks.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested messages">
              {suggestions(joiner, company).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMessage(s)}
                  className="focus-ring rounded-full border border-border-strong bg-surface px-3 py-1.5 text-left text-small text-fg transition-colors duration-120 hover:bg-sunken dark:bg-raised dark:hover:bg-hover"
                >
                  {s}
                </button>
              ))}
            </div>
            <Field label="Your message" error={error ?? undefined}>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={`Write something friendly for ${joiner.firstName}`}
                autoFocus
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!message.trim()}>
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * People who started recently or start soon, with a "Say hi" that sends them a note.
 * `list` is the rail group (rows under a quiet heading); `chips` is the phone version, one
 * horizontal row of avatar chips under Today so it never sinks below the feed.
 */
export function NewJoiners({
  joiners,
  company,
  variant = "list",
  className,
}: {
  joiners: JoinerItem[];
  company: string;
  variant?: "list" | "chips";
  className?: string;
}) {
  const [active, setActive] = React.useState<JoinerItem | null>(null);
  const [sent, setSent] = React.useState<string[]>([]);
  const isGreeted = (j: JoinerItem) => j.greeted || sent.includes(j.id);
  const dialog = active ? (
    <SayHiDialog joiner={active} company={company} onClose={() => setActive(null)} onSent={(id) => setSent((s) => [...s, id])} />
  ) : null;

  if (variant === "chips") {
    if (!joiners.length) return null;
    return (
      <Section tone="quiet" title="New joiners" count={joiners.length} className={className}>
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {joiners.map((j) => {
            const greeted = isGreeted(j);
            return (
              <li key={j.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => !greeted && setActive(j)}
                  aria-label={greeted ? `${j.name}, you said hi` : `Say hi to ${j.name}`}
                  disabled={greeted}
                  className={cn(
                    "focus-ring flex h-11 items-center gap-2 rounded-full border bg-surface pl-1 pr-3 text-left shadow-lift transition-colors duration-120",
                    greeted ? "border-border text-muted" : "border-border-strong text-fg hover:bg-sunken dark:bg-raised dark:hover:bg-hover",
                  )}
                >
                  <Avatar name={j.name} src={j.avatarUrl} size="lg" className="size-9" />
                  <span className="flex flex-col leading-tight">
                    <span className="text-small font-medium">{j.firstName}</span>
                    <span className="text-caption text-subtle">{j.phrase}</span>
                  </span>
                  {greeted ? (
                    <Check className="size-3.5 stroke-[2] text-muted" aria-hidden />
                  ) : (
                    <Hand className="size-3.5 stroke-[1.5] text-muted" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {dialog}
      </Section>
    );
  }

  return (
    <Section tone="quiet" title="New joiners" count={joiners.length || undefined} className={className}>
      {joiners.length ? (
        <ul className="-mx-2 flex flex-col">
          {joiners.map((j) => {
            const greeted = isGreeted(j);
            return (
              <li key={j.id} className="flex min-h-[52px] items-center gap-3 rounded-control px-2 py-1.5">
                <Avatar name={j.name} src={j.avatarUrl} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body font-medium text-fg">{j.name}</span>
                  <span className="truncate text-caption text-muted">
                    <span className={j.upcoming ? "font-medium text-fg" : undefined}>{j.phrase}</span>
                    {j.title ? ` · ${j.title}` : ""}
                  </span>
                </div>
                {greeted ? (
                  <span className="inline-flex h-8 shrink-0 items-center gap-1 px-1 text-caption text-muted">
                    <Check className="size-3.5 stroke-[2]" aria-hidden />
                    Said hi
                  </span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setActive(j)} aria-label={`Say hi to ${j.name}`} className="-mr-1 text-muted hover:text-fg">
                    <Hand aria-hidden />
                    Say hi
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-body text-muted">Nobody new this month. When people join, you can welcome them from here.</p>
      )}
      {dialog}
    </Section>
  );
}
