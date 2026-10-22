"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { AdminResult } from "@/app/(app)/admin/helpdesk/_actions";

export type Errors = Record<string, string>;

/** Runs a save/delete action with toasts, field errors and a refresh. */
export function useAdminAction() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const run = (fn: () => Promise<AdminResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setFormError(r.error);
        return;
      }
      setErrors({});
      setFormError(null);
      if (r.message) toast.success(r.message);
      onOk?.();
      router.refresh();
    });
  const reset = () => {
    setErrors({});
    setFormError(null);
  };
  return { pending, errors, formError, run, reset };
}

export function EditorSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSave,
  onDelete,
  pending,
  formError,
  wide = false,
  saveLabel = "Save",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSave: () => void;
  onDelete?: () => void;
  pending: boolean;
  formError: string | null;
  wide?: boolean;
  saveLabel?: string;
}) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn(wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          noValidate
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <SheetBody className="flex flex-col gap-5">
            {children}
            {formError ? (
              <p
                role="alert"
                className="rounded-cell bg-danger-soft px-3 py-2 text-small text-danger-text"
              >
                {formError}
              </p>
            ) : null}
          </SheetBody>
          <SheetFooter className="justify-between">
            <div>
              {onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-danger-text"
                  onClick={() => setConfirm(true)}
                  disabled={pending}
                >
                  <Trash2 />
                  Delete
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {saveLabel}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
      {onDelete ? (
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Delete {title.replace(/^Edit /, "").toLowerCase()}?</DialogTitle>
              <DialogDescription>This can&apos;t be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Keep it
              </Button>
              <Button
                variant="danger"
                loading={pending}
                onClick={() => {
                  setConfirm(false);
                  onDelete();
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </Sheet>
  );
}

/** A section header row: title, one line of explanation, and the primary action. */
export function SectionHead({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-h4 font-medium text-fg">{title}</h2>
        <p className="max-w-prose text-small text-muted">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Clickable list row inside a card list. */
export function RowButton({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-120 hover:bg-raised focus-visible:-outline-offset-2 dark:hover:bg-hover",
        className,
      )}
    >
      {children}
    </button>
  );
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
