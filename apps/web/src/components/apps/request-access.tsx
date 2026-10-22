"use client";

import * as React from "react";
import { CircleAlert, Lock } from "lucide-react";
import { requestAccessAction } from "@/app/(app)/apps/_actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Section } from "@/components/ui/section";
import { Tile, TileWall } from "@/components/ui/tile-wall";
import { AppIcon } from "./app-icon";
import type { RequestableApp } from "./load";

function RequestDialog({
  app,
  open,
  onOpenChange,
  onRequested,
}: {
  app: RequestableApp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequested: (number: number) => void;
}) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestAccessAction({ slug: app.slug, reason });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      onRequested(res.number);
      toast.success(`Asked for access to ${app.name}`, {
        description: `Request #${res.number} is with the app owner. You will hear back in Help.`,
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-3">
              <AppIcon icon={app.icon} />
              <div className="min-w-0">
                <DialogTitle>Ask for access to {app.name}</DialogTitle>
                <p className="text-small text-muted">{app.category}</p>
              </div>
            </div>
            <DialogDescription>
              This creates a request in Help. The app owner reviews it, and {app.name} appears in your apps once it is
              approved.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <Field
              label="Why do you need it?"
              help="A sentence is enough, for example the project or task."
              required
            >
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`e.g. I am joining the pricing project and need to read the dashboards in ${app.name}.`}
                rows={4}
                maxLength={1000}
                autoFocus
              />
            </Field>
            {error ? (
              <p role="alert" className="flex items-start gap-2 rounded-control bg-danger-soft px-3 py-2 text-small text-danger-text">
                <CircleAlert className="mt-px size-4 shrink-0 stroke-[1.5]" aria-hidden />
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={reason.trim().length < 3}>
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Apps you can ask for": hidden apps that accept access requests. */
export function RequestAccessList({ apps }: { apps: RequestableApp[] }) {
  const [active, setActive] = React.useState<RequestableApp | null>(null);
  const [requested, setRequested] = React.useState<Record<string, number>>({});
  if (!apps.length) return null;
  return (
    <Section
      title="Apps you can ask for"
      count={apps.length}
      description="These are limited to certain teams. Ask, and the app owner will take a look."
    >
      {/* Locked tiles: the same wall as the apps you have, quieter (a plain cell with the brand plate),
          each with a lock and the one action that matters. */}
      {/* The same column grid as the wall above, so the two read as one catalogue. */}
      <TileWall label="Apps you can ask for" className="gap-2.5 md:gap-3 max-sm:![grid-template-columns:repeat(2,minmax(0,1fr))] sm:![grid-template-columns:repeat(3,minmax(0,1fr))] lg:![grid-template-columns:repeat(4,minmax(0,1fr))] xl:![grid-template-columns:repeat(6,minmax(0,1fr))]">
        {apps.map((app) => {
          const ticket = requested[app.slug] ?? app.pendingTicket;
          return (
            <Tile
              key={app.id}
              color={app.color}
              icon={<AppIcon icon={app.icon} size="md" onPlate />}
              label={app.name}
              meta={app.description ?? app.category}
              badge={
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-sunken text-muted" title="Limited to certain teams">
                  <Lock className="size-4 stroke-[1.75]" aria-label="Restricted" />
                </span>
              }
            >
              <span className="mt-1 flex">
                {ticket ? (
                  <Badge tone="warning" dot>
                    Requested, #{ticket}
                  </Badge>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setActive(app)}>
                    Request access
                  </Button>
                )}
              </span>
            </Tile>
          );
        })}
      </TileWall>
      {active ? (
        <RequestDialog
          app={active}
          open={!!active}
          onOpenChange={(o) => !o && setActive(null)}
          onRequested={(n) => setRequested((r) => ({ ...r, [active.slug]: n }))}
        />
      ) : null}
    </Section>
  );
}
