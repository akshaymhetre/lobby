"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play, Trash2 } from "lucide-react";
import type { BuilderOptions } from "@lobby/core/journeys";
import { formatDay, type JourneyKind } from "@lobby/core/journeys/dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { deleteJourneyAction, startForPersonAction } from "@/app/(app)/admin/journeys/_actions";
import { PersonSelect } from "./pickers";

export function StartForPersonButton({
  journeyId,
  journeyName,
  kind,
  people,
  disabled,
}: {
  journeyId: string;
  journeyName: string;
  kind: JourneyKind;
  people: BuilderOptions["people"];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [buddyId, setBuddyId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const person = people.find((p) => p.id === userId);
  const personDate = person ? (kind === "offboarding" ? person.endDate : person.startDate) : null;
  const dateLabel = kind === "offboarding" ? "Last day" : "Start date";

  React.useEffect(() => {
    setDate(personDate ?? "");
    setError(null);
  }, [personDate, userId]);

  const reset = () => {
    setUserId(null);
    setBuddyId(null);
    setDate("");
    setError(null);
  };

  const start = () =>
    startTransition(async () => {
      if (!userId) return setError("Pick a person.");
      if (!date) return setError(`Set a ${dateLabel.toLowerCase()}.`);
      const res = await startForPersonAction({ journeyId, userId, anchorDate: date, buddyUserId: buddyId });
      if (!res.ok) return setError(res.error);
      toast.success(`Started ${journeyName} for ${person?.name ?? "them"}`, {
        action: { label: "View", onClick: () => router.push(`/journeys/runs/${res.runId}`) },
      });
      setOpen(false);
      reset();
    });

  const button = (
    <Button variant="secondary" onClick={() => setOpen(true)} disabled={disabled}>
      <Play aria-hidden />
      Start for a person
    </Button>
  );

  return (
    <>
      {disabled ? (
        <Tooltip label="Save your changes first">
          <span tabIndex={0} className="focus-ring rounded-control">
            {button}
          </span>
        </Tooltip>
      ) : (
        button
      )}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Start {journeyName}</DialogTitle>
            <DialogDescription>Start it by hand, for example for someone who does not match the conditions or whose date changed.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Field label="Person" required controlId="start-person" error={error && !userId ? error : undefined}>
              <PersonSelect id="start-person" people={people} value={userId} onChange={setUserId} />
            </Field>
            <Field
              label={dateLabel}
              required
              help={person ? (personDate ? `From their profile: ${formatDay(personDate)}. Change it here for this journey only.` : `Their profile has no ${dateLabel.toLowerCase()}.`) : "Steps are due relative to this date."}
            >
              <DateField value={date} onValueChange={setDate} placeholder={kind === "offboarding" ? "Pick their last day" : "Pick a start date"} />
            </Field>
            {kind === "onboarding" ? (
              <Field label="Buddy" help="Optional. Their manager can pick one later." controlId="start-buddy">
                <PersonSelect
                  id="start-buddy"
                  people={people.filter((p) => p.id !== userId)}
                  value={buddyId}
                  onChange={setBuddyId}
                  allowClear
                  clearLabel="No buddy yet"
                  placeholder="No buddy yet"
                />
              </Field>
            ) : null}
            {error && userId ? (
              <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-small text-danger-text">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={start} loading={pending}>
              Start journey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteJourneyButton({ id, name, hasRuns }: { id: string; name: string; hasRuns: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const del = () =>
    startTransition(async () => {
      const res = await deleteJourneyAction(id);
      if (!res.ok) {
        toast.error(res.error);
        setOpen(false);
        return;
      }
      toast.success(`Deleted ${name}`);
      router.replace("/admin/journeys");
    });
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} className="text-muted hover:text-danger-text" aria-label={`Delete ${name}`}>
        <Trash2 aria-hidden />
        <span className="sm:hidden xl:inline">Delete</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              {hasRuns
                ? "People are on this journey right now, so it cannot be deleted. Turn off Start automatically instead and their journeys carry on."
                : "The template and its steps are removed for good. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {hasRuns ? "Close" : "Keep it"}
            </Button>
            {hasRuns ? null : (
              <Button variant="danger" onClick={del} loading={pending}>
                Delete journey
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
