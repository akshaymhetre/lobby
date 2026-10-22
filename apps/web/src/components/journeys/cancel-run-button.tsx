"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cancelRunAction } from "@/app/(app)/journeys/_actions";

export function CancelRunButton({ runId, subjectName, journeyName }: { runId: string; subjectName: string; journeyName: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const cancel = () =>
    startTransition(async () => {
      const res = await cancelRunAction(runId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Cancelled ${subjectName}'s ${journeyName}`);
      setOpen(false);
      router.refresh();
    });
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} className="text-danger-text">
        <Ban aria-hidden />
        Cancel journey
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Cancel this journey?</DialogTitle>
            <DialogDescription>
              {subjectName}&rsquo;s open steps will stop and nobody will be reminded about them. Use this when a start date falls through. You can start the journey again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={cancel} loading={pending}>
              Cancel journey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
