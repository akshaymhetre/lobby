"use client";

import * as React from "react";
import { Check, UserRoundPlus } from "lucide-react";
import type { Colleague } from "@lobby/core/journeys";
import { Avatar } from "@/components/ui/avatar";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { assignBuddyAction } from "@/app/(app)/journeys/_actions";

export interface BuddyPickerProps {
  runId: string;
  subject: { id: string; name: string; firstName: string; department?: string | null };
  currentBuddyId: string | null;
  colleagues: Colleague[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Search-and-pick a buddy. Colleagues from the same department come first. */
export function BuddyPicker({ runId, subject, currentBuddyId, colleagues, open, onOpenChange }: BuddyPickerProps) {
  const [pending, startTransition] = React.useTransition();
  const others = colleagues.filter((c) => c.id !== subject.id);
  const sameTeam = subject.department ? others.filter((c) => c.department === subject.department) : [];
  const rest = others.filter((c) => !sameTeam.includes(c));

  const pick = (buddyId: string | null) =>
    startTransition(async () => {
      const res = await assignBuddyAction(runId, buddyId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const who = colleagues.find((c) => c.id === buddyId);
      toast.success(who ? `${who.name} is ${subject.firstName}'s buddy. We let them know.` : "Buddy removed");
      onOpenChange(false);
    });

  const item = (c: Colleague) => (
    <CommandItem
      key={c.id}
      value={`${c.name} ${c.title ?? ""} ${c.department ?? ""}`}
      onSelect={() => pick(c.id)}
      disabled={pending}
      className="h-12 md:h-11"
    >
      <Avatar name={c.name} seed={c.id} src={c.avatarUrl} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body text-fg">{c.name}</span>
        <span className="truncate text-caption text-muted">{[c.title, c.department].filter(Boolean).join(" · ")}</span>
      </span>
      {c.id === currentBuddyId ? <Check className="!text-accent-text" aria-label="Current buddy" /> : null}
    </CommandItem>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="overflow-hidden">
        <DialogHeader className="pb-3">
          <DialogTitle>{currentBuddyId ? `Change ${subject.firstName}'s buddy` : `Pick a buddy for ${subject.firstName}`}</DialogTitle>
          <DialogDescription>A friendly colleague, ideally outside the reporting line, for the small questions in the first weeks.</DialogDescription>
        </DialogHeader>
        <Command className="rounded-none border-t border-border" loop>
          <CommandInput placeholder="Search people" autoFocus />
          <CommandList className="max-h-[min(340px,50dvh)]">
            <CommandEmpty>Nobody by that name.</CommandEmpty>
            {sameTeam.length ? <CommandGroup heading={subject.department ?? "Same team"}>{sameTeam.map(item)}</CommandGroup> : null}
            <CommandGroup heading={sameTeam.length ? "Everyone else" : "Everyone"}>{rest.map(item)}</CommandGroup>
          </CommandList>
        </Command>
        {currentBuddyId ? (
          <DialogFooter className="sm:justify-start">
            <Button variant="ghost" size="sm" onClick={() => pick(null)} disabled={pending} className="text-danger-text">
              Remove the buddy
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** A button that opens the buddy picker. */
export function AssignBuddyButton({
  label,
  variant = "secondary",
  size = "sm",
  ...picker
}: Omit<BuddyPickerProps, "open" | "onOpenChange"> & { label?: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {picker.currentBuddyId ? null : <UserRoundPlus aria-hidden />}
        {label ?? (picker.currentBuddyId ? "Change" : "Assign a buddy")}
      </Button>
      <BuddyPicker {...picker} open={open} onOpenChange={setOpen} />
    </>
  );
}
