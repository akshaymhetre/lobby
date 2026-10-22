"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { assign, changePriority, changeStatus } from "@/app/(app)/queue/_actions";
import { PRIORITY_OPTIONS, statusLabel, type Priority, type TicketStatus } from "./badges";

const AGENT_STATUSES: TicketStatus[] = [
  "new",
  "open",
  "waiting_on_requester",
  "resolved",
  "closed",
];
const UNASSIGNED = "__unassigned";

/** Status, priority and assignee for the agent side panel. Each change saves immediately. */
export function TicketControls({
  ticketId,
  status,
  priority,
  assigneeId,
  agents,
  meId,
}: {
  ticketId: string;
  status: TicketStatus;
  priority: Priority;
  assigneeId: string | null;
  agents: { id: string; name: string; avatarUrl: string | null }[];
  meId: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  // Unique per instance: the page renders one copy for phones and one for the desktop rail.
  const uid = React.useId();
  const locked = status === "pending_approval" || status === "rejected";

  const save = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error((r as { error: string }).error);
        router.refresh();
        return;
      }
      toast.success(done);
      router.refresh();
    });

  const statusOptions = locked ? [status] : AGENT_STATUSES;
  return (
    <div className="flex flex-col gap-3" aria-busy={pending || undefined}>
      <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
        <label htmlFor={`${uid}-status`} className="text-small text-muted">
          Status
        </label>
        <Select
          value={status}
          onValueChange={(v) =>
            save(
              () => changeStatus(ticketId, v as TicketStatus),
              `Status set to ${statusLabel(v as TicketStatus, "agent")}`,
            )
          }
          disabled={locked || pending}
        >
          <SelectTrigger id={`${uid}-status`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(s, "agent")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label htmlFor={`${uid}-priority`} className="text-small text-muted">
          Priority
        </label>
        <Select
          value={priority}
          onValueChange={(v) =>
            save(() => changePriority(ticketId, v as Priority), `Priority set to ${v}`)
          }
          disabled={pending}
        >
          <SelectTrigger id={`${uid}-priority`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label htmlFor={`${uid}-assignee`} className="text-small text-muted">
          Assignee
        </label>
        <Select
          value={assigneeId ?? UNASSIGNED}
          onValueChange={(v) => {
            const id = v === UNASSIGNED ? null : v;
            const name = agents.find((a) => a.id === id)?.name;
            save(
              () => assign([ticketId], id),
              id ? `Assigned to ${id === meId ? "you" : name}` : "Unassigned",
            );
          }}
          disabled={pending}
        >
          <SelectTrigger id={`${uid}-assignee`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>
              <span className="text-muted">Unassigned</span>
            </SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="inline-flex items-center gap-2">
                  <Avatar name={a.name} src={a.avatarUrl} seed={a.id} size="xs" />
                  {a.id === meId ? `${a.name} (you)` : a.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {assigneeId !== meId && agents.some((a) => a.id === meId) ? (
        <Button
          variant="secondary"
          size="sm"
          className="self-end"
          onClick={() => save(() => assign([ticketId], meId), "Assigned to you")}
          disabled={pending}
        >
          <UserRound />
          Assign to me
        </Button>
      ) : null}
    </div>
  );
}
