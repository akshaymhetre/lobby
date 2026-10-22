"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown, UserRound, UserRoundX, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { assign } from "@/app/(app)/queue/_actions";
import { PriorityLabel, SlaDue, StatusBadge, type Priority, type TicketStatus } from "./badges";

export interface QueueRow {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  priority: Priority;
  requesterId?: string;
  requesterName: string;
  requesterAvatar: string | null;
  requestTypeName: string | null;
  teamName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  approvalProgress?: { done: number; total: number } | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
}

export interface AgentOption {
  id: string;
  name: string;
  avatarUrl: string | null;
}

type SortKey = "number" | "subject" | "requester" | "type" | "priority" | "status" | "due";

const DONE = new Set(["resolved", "closed", "rejected"]);

function SortHead({
  k,
  sort,
  dir,
  href,
  children,
  className,
}: {
  k: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const active = sort === k;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "h-9 whitespace-nowrap border-b border-border px-3 text-left text-caption font-medium text-muted",
        className,
      )}
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          "focus-ring group -mx-1.5 inline-flex h-7 items-center gap-1 rounded-[4px] px-1.5 hover:bg-hover hover:text-fg",
          active && "text-fg",
        )}
      >
        {children}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3.5 stroke-[1.5]" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5 stroke-[1.5]" aria-hidden />
          )
        ) : (
          <ChevronsUpDown
            className="size-3.5 stroke-[1.5] opacity-50 group-hover:opacity-100"
            aria-hidden
          />
        )}
      </Link>
    </th>
  );
}

export function QueueTable({
  rows,
  agents,
  meId,
  sort,
  dir,
  hrefFor,
}: {
  rows: QueueRow[];
  agents: AgentOption[];
  meId: string;
  sort: SortKey;
  dir: "asc" | "desc";
  /** Pre-built hrefs for each sort column, toggling direction for the active one. */
  hrefFor: Record<SortKey, string>;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, start] = React.useTransition();
  // Drop selections for rows that left the view after a refresh.
  const visibleSelected = React.useMemo(
    () => new Set([...selected].filter((id) => rows.some((r) => r.id === id))),
    [selected, rows],
  );
  const all = rows.length > 0 && visibleSelected.size === rows.length;
  const some = visibleSelected.size > 0 && !all;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doAssign = (assigneeId: string | null, label: string) =>
    start(async () => {
      const r = await assign([...visibleSelected], assigneeId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `${visibleSelected.size} ${visibleSelected.size === 1 ? "request" : "requests"} ${assigneeId ? `assigned to ${label}` : "unassigned"}`,
      );
      setSelected(new Set());
      router.refresh();
    });

  const AssignMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" loading={pending}>
          <UserRound />
          Assign
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[320px] overflow-y-auto">
        <DropdownMenuItem onSelect={() => doAssign(meId, "you")}>
          <UserRound />
          Assign to me
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => doAssign(null, "")}>
          <UserRoundX />
          Unassign
        </DropdownMenuItem>
        {agents.filter((a) => a.id !== meId).length ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Teammates</DropdownMenuLabel>
            {agents
              .filter((a) => a.id !== meId)
              .map((a) => (
                <DropdownMenuItem key={a.id} onSelect={() => doAssign(a.id, a.name)}>
                  <Avatar name={a.name} src={a.avatarUrl} seed={a.id} size="xs" />
                  {a.name}
                </DropdownMenuItem>
              ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-full px-3 py-1.5 transition-colors duration-120",
          visibleSelected.size ? "bg-accent-soft" : "",
        )}
        aria-live="polite"
      >
        <Checkbox
          checked={all ? true : some ? "indeterminate" : false}
          onCheckedChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
          aria-label={all ? "Clear selection" : "Select all requests in this view"}
          disabled={!rows.length}
        />
        {visibleSelected.size ? (
          <>
            <span className="text-small font-medium text-accent-text">
              {visibleSelected.size} selected
            </span>
            {AssignMenu}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X />
              Clear
            </Button>
          </>
        ) : (
          <span className="text-small text-muted">
            {rows.length} {rows.length === 1 ? "request" : "requests"}
          </span>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-card panel md:block">
        <table className="w-full table-fixed border-collapse text-body">
          <thead className="bg-sunken/50 dark:bg-raised/40">
            <tr>
              <th scope="col" className="h-9 w-10 border-b border-border pl-4 pr-1">
                <span className="sr-only">Select</span>
              </th>
              <SortHead k="number" sort={sort} dir={dir} href={hrefFor.number} className="w-18">
                #
              </SortHead>
              <SortHead k="subject" sort={sort} dir={dir} href={hrefFor.subject}>
                Subject
              </SortHead>
              <SortHead
                k="requester"
                sort={sort}
                dir={dir}
                href={hrefFor.requester}
                className="w-40 xl:w-44"
              >
                Requester
              </SortHead>
              <SortHead
                k="type"
                sort={sort}
                dir={dir}
                href={hrefFor.type}
                className="hidden w-48 2xl:table-cell"
              >
                Type
              </SortHead>
              <SortHead
                k="priority"
                sort={sort}
                dir={dir}
                href={hrefFor.priority}
                className="w-24 xl:w-28"
              >
                Priority
              </SortHead>
              <SortHead
                k="status"
                sort={sort}
                dir={dir}
                href={hrefFor.status}
                className="w-32 xl:w-36"
              >
                Status
              </SortHead>
              <th
                scope="col"
                className="h-9 w-40 whitespace-nowrap border-b border-border px-3 text-left text-caption font-medium text-muted xl:w-44"
              >
                Assignee
              </th>
              <SortHead
                k="due"
                sort={sort}
                dir={dir}
                href={hrefFor.due}
                className="w-32 pr-4 xl:w-36"
              >
                Due
              </SortHead>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isSel = visibleSelected.has(r.id);
              return (
                <tr
                  key={r.id}
                  data-selected={isSel || undefined}
                  className="group border-b border-border transition-colors duration-120 last:border-b-0 hover:bg-raised data-[selected]:bg-cat-blue-soft/60 dark:hover:bg-hover"
                >
                  <td className="h-11 pl-4 pr-1 align-middle">
                    <Checkbox
                      checked={isSel}
                      onCheckedChange={() => toggle(r.id)}
                      aria-label={`Select #${r.number}`}
                    />
                  </td>
                  <td className="tabular whitespace-nowrap px-3 align-middle text-small text-muted">
                    #{r.number}
                  </td>
                  <td className="px-3 align-middle">
                    <Link
                      href={`/queue/${r.number}`}
                      className="focus-ring block truncate rounded-[4px] font-medium text-fg hover:underline"
                    >
                      {r.subject}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 align-middle">
                    <span className="inline-flex max-w-full items-center gap-2">
                      <Avatar name={r.requesterName} seed={r.requesterId} src={r.requesterAvatar} size="xs" />
                      <span className="truncate text-small">{r.requesterName}</span>
                    </span>
                  </td>
                  <td className="hidden truncate whitespace-nowrap px-3 align-middle text-small text-muted 2xl:table-cell">
                    {r.requestTypeName ?? r.teamName}
                  </td>
                  <td className="whitespace-nowrap px-3 align-middle">
                    <PriorityLabel priority={r.priority} />
                  </td>
                  <td className="whitespace-nowrap px-3 align-middle">
                    <StatusBadge status={r.status} perspective="agent" size="sm" approvalProgress={r.approvalProgress} />
                  </td>
                  <td className="whitespace-nowrap px-3 align-middle">
                    {r.assigneeName ? (
                      <span className="inline-flex max-w-full items-center gap-2">
                        <Avatar name={r.assigneeName} seed={r.assigneeId} size="xs" />
                        <span className="truncate text-small">
                          {r.assigneeId === meId ? "You" : r.assigneeName}
                        </span>
                      </span>
                    ) : r.status === "pending_approval" ? (
                      <span className="text-small text-subtle">After approval</span>
                    ) : (
                      <span className="text-small text-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 pr-4 align-middle">
                    {DONE.has(r.status) ? (
                      <span className="text-small text-muted">Done</span>
                    ) : r.status === "pending_approval" ? (
                      // The Assignee cell already says "After approval"; the clock has simply not started.
                      <span className="text-small text-muted">Not started</span>
                    ) : (
                      <SlaDue due={r.dueAt} doneAt={null} variant="block" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card panel md:hidden">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-start gap-3 px-3 py-3 data-[selected]:bg-cat-blue-soft/60"
            data-selected={visibleSelected.has(r.id) || undefined}
          >
            <span className="pt-0.5">
              <Checkbox
                checked={visibleSelected.has(r.id)}
                onCheckedChange={() => toggle(r.id)}
                aria-label={`Select #${r.number}`}
              />
            </span>
            <Link
              href={`/queue/${r.number}`}
              className="focus-ring flex min-w-0 flex-1 flex-col gap-1.5 rounded-[4px]"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="tabular shrink-0 text-small text-subtle">#{r.number}</span>
                <span className="line-clamp-2 text-body font-medium text-fg">{r.subject}</span>
              </span>
              <span className="text-small text-muted">
                {r.requesterName},{" "}
                {r.assigneeName
                  ? `with ${r.assigneeId === meId ? "you" : r.assigneeName}`
                  : r.status === "pending_approval"
                    ? "assigned after approval"
                    : "unassigned"}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <StatusBadge status={r.status} perspective="agent" size="sm" approvalProgress={r.approvalProgress} />
                <PriorityLabel priority={r.priority} />
                {!DONE.has(r.status) && r.status !== "pending_approval" ? (
                  <SlaDue due={r.dueAt} doneAt={null} variant="block" />
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
