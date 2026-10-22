"use client";

import * as React from "react";
import { ArrowUpRight, BookOpen } from "lucide-react";
import type { JourneyFormQuestion } from "@lobby/db/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { skipStepAction } from "@/app/(app)/journeys/_actions";

export function AcknowledgeDialog({
  open,
  onOpenChange,
  page,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: { title: string; href: string; space: string; found: boolean };
  pending: boolean;
  onConfirm: () => void;
}) {
  const [agreed, setAgreed] = React.useState(false);
  const id = React.useId();
  React.useEffect(() => {
    if (!open) setAgreed(false);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Acknowledge {page.title.toLowerCase().startsWith("the ") ? page.title : `the ${page.title}`}</DialogTitle>
          <DialogDescription>Everyone at the company confirms they have read this. It takes a few minutes.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <a
            href={page.href}
            target="_blank"
            rel="noopener"
            className="focus-ring press group flex items-center gap-3 rounded-cell bg-sunken px-3 py-2.5 hover:bg-hover dark:bg-raised dark:shadow-cell"
          >
            <BookOpen className="size-4 shrink-0 stroke-[1.5] text-muted" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body font-medium text-fg">{page.title}</span>
              <span className="truncate text-caption text-muted">Opens in a new tab · {page.space}</span>
            </span>
            <ArrowUpRight className="size-4 shrink-0 stroke-[1.5] text-subtle" aria-hidden />
          </a>
          <div className="flex items-start gap-2.5">
            <Checkbox id={id} checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
            <Label htmlFor={id} className="font-normal leading-5 text-fg">
              I have read {page.title} and will follow it.
            </Label>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Not yet
          </Button>
          <Button onClick={onConfirm} disabled={!agreed} loading={pending}>
            Acknowledge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  questions,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string | null;
  questions: JourneyFormQuestion[];
  pending: boolean;
  onSubmit: (answers: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const set = (k: string, v: string) => {
    setAnswers((a) => ({ ...a, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const missing: Record<string, string> = {};
    for (const q of questions) if (q.required && !answers[q.key]?.trim()) missing[q.key] = "Please answer this one.";
    setErrors(missing);
    if (Object.keys(missing).length) return;
    onSubmit(answers);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {questions.map((q) => {
              const fieldId = `q-${q.key}`;
              return q.type === "select" ? (
                <Field key={q.key} label={q.label} required={q.required} error={errors[q.key] || undefined} controlId={fieldId}>
                  <Select value={answers[q.key] ?? ""} onValueChange={(v) => set(q.key, v)}>
                    <SelectTrigger id={fieldId} aria-invalid={errors[q.key] ? true : undefined}>
                      <SelectValue placeholder="Choose one" />
                    </SelectTrigger>
                    <SelectContent>
                      {(q.options ?? []).map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field key={q.key} label={q.label} required={q.required} error={errors[q.key] || undefined}>
                  {q.type === "textarea" ? (
                    <Textarea rows={3} value={answers[q.key] ?? ""} onChange={(e) => set(q.key, e.target.value)} />
                  ) : (
                    <Input value={answers[q.key] ?? ""} onChange={(e) => set(q.key, e.target.value)} />
                  )}
                </Field>
              );
            })}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Send answers
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SkipDialog({
  open,
  onOpenChange,
  stepId,
  title,
  onSkipped,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepId: string;
  title: string;
  onSkipped: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const skip = () =>
    startTransition(async () => {
      const res = await skipStepAction(stepId, reason);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Skipped: ${title}`);
      setReason("");
      onSkipped();
    });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Skip this step?</DialogTitle>
          <DialogDescription>
            &ldquo;{title}&rdquo; will be marked as not needed and will not count against progress.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="Why" help="Optional. Shown on the journey so others know.">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: already has a laptop" maxLength={500} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button onClick={skip} loading={pending}>
            Skip step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
