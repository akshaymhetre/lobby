"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, CircleCheck, Lock } from "lucide-react";
import type { FreshnessState } from "@lobby/core/knowledge/freshness";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDate, timeAgo } from "@/lib/time";
import { remindOwnersAction } from "@/app/(app)/admin/knowledge/_actions";
import { FreshnessBadge } from "./freshness-badge";

export interface HealthItem {
  id: string;
  title: string;
  /** Null when the admin cannot read the page itself (restricted to other groups). */
  href: string | null;
  spaceName: string;
  ownerId: string | null;
  ownerName: string | null;
  hasOwner: boolean;
  reviewBy: string | null;
  verifiedAt: string | null;
  freshness: FreshnessState;
  restricted: boolean;
}

export function ContentHealthTable({ items }: { items: HealthItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"attention" | "all">("all");
  // Phones open on the short list: the board above already ranks the work, and 30 rows is a long scroll.
  React.useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setFilter("attention");
  }, []);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, start] = React.useTransition();

  const attention = items.filter((i) => i.freshness !== "verified");
  const shown = filter === "attention" ? attention : items;
  const selectable = shown.filter((i) => i.hasOwner);
  const allSelected = selectable.length > 0 && selectable.every((i) => selected.has(i.id));
  const someSelected = selectable.some((i) => selected.has(i.id));
  const selectedIds = [...selected].filter((id) => shown.some((i) => i.id === id));

  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const remind = (ids: string[]) =>
    start(async () => {
      const r = await remindOwnersAction(ids);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.owners === 1 ? "Reminder sent to 1 owner" : `Reminders sent to ${r.owners} owners`, {
        description: "They get a notification in Lobby linking to each page.",
      });
      setSelected(new Set());
      router.refresh();
    });

  return (
    <section aria-labelledby="pages-heading" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="pages-heading" className="sr-only">
          Pages
        </h2>
        <SegmentedControl
          aria-label="Which pages to show"
          value={filter}
          onValueChange={(v) => setFilter(v as "attention" | "all")}
          options={[
            { value: "attention", label: `Needs attention (${attention.length})` },
            { value: "all", label: `All pages (${items.length})` },
          ]}
        />
        <div className="flex items-center gap-3">
          <span className={cn("text-small text-muted tabular-nums", !selectedIds.length && "hidden sm:inline")} role="status">
            {selectedIds.length ? `${selectedIds.length} selected` : shown.length ? "Select pages to remind their owners" : null}
          </span>
          <Button
            variant={selectedIds.length ? "primary" : "secondary"}
            disabled={!selectedIds.length}
            loading={pending}
            onClick={() => remind(selectedIds)}
            title={selectedIds.length ? undefined : "Tick the pages whose owners should be reminded"}
          >
            <BellRing aria-hidden />
            {selectedIds.length ? `Remind ${selectedIds.length === 1 ? "owner" : "owners"}` : "Remind owners"}
          </Button>
        </div>
      </div>

      {shown.length ? (
        <>
          {/* Phones: one row per page, no sideways table. */}
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card bg-surface shadow-panel sm:hidden" aria-label="Published pages by review date">
            {shown.map((i) => (
              <li key={i.id} className={cn("flex items-start gap-3 px-3 py-3", selected.has(i.id) && "bg-selected")}>
                <Checkbox
                  aria-label={`Select ${i.title}`}
                  checked={selected.has(i.id)}
                  disabled={!i.hasOwner}
                  onCheckedChange={(c) => toggle(i.id, !!c)}
                  className="mt-0.5"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {i.href ? (
                    <Link href={i.href} className="focus-ring -my-1 inline-block max-w-full truncate rounded-[4px] py-1 font-medium text-fg hover:underline hover:underline-offset-4">
                      {i.title}
                    </Link>
                  ) : (
                    <span className="truncate font-medium text-fg">{i.title}</span>
                  )}
                  <span className="flex items-center gap-1 truncate text-small text-muted">
                    {i.restricted ? <Lock className="size-3 shrink-0 stroke-[1.75]" aria-label="Restricted" /> : null}
                    {i.spaceName}
                    <span aria-hidden className="text-subtle">
                      ·
                    </span>
                    <span className="tabular">{i.reviewBy ? formatDate(i.reviewBy, { day: "numeric", month: "short" }) : "No date"}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <FreshnessBadge state={i.freshness} reviewBy={i.reviewBy} size="sm" />
                    {i.ownerName ? (
                      <span className="inline-flex items-center gap-1.5 text-small text-muted">
                        <Avatar name={i.ownerName} seed={i.ownerId} size="xs" />
                        {i.ownerName}
                      </span>
                    ) : (
                      <span className="text-small font-medium text-cat-coral-text">No owner</span>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <Table aria-label="Published pages by review date" className="min-w-[760px]" wrapperClassName="hidden max-w-full sm:block">
          <THead>
            <tr>
              <TH className="w-10">
                <Checkbox
                  aria-label="Select all pages with an owner"
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(c) => setSelected(c ? new Set(selectable.map((i) => i.id)) : new Set())}
                  disabled={!selectable.length}
                />
              </TH>
              <TH>Page</TH>
              <TH>Owner</TH>
              <TH>Review by</TH>
              <TH>Status</TH>
              <TH>Last verified</TH>
            </tr>
          </THead>
          <TBody>
            {shown.map((i) => (
              <TRow key={i.id} selected={selected.has(i.id)}>
                <TD>
                  <Checkbox
                    aria-label={`Select ${i.title}`}
                    checked={selected.has(i.id)}
                    disabled={!i.hasOwner}
                    onCheckedChange={(c) => toggle(i.id, !!c)}
                  />
                </TD>
                <TD className="max-w-[320px]">
                  <div className="flex min-w-0 flex-col">
                    {i.href ? (
                      <Link href={i.href} className="focus-ring -my-1 inline-block max-w-full truncate rounded-[4px] py-1 font-medium text-fg hover:underline hover:underline-offset-4">
                        {i.title}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-fg">{i.title}</span>
                    )}
                    <span className="flex items-center gap-1 truncate text-small text-muted">
                      {i.restricted ? <Lock className="size-3 shrink-0 stroke-[1.75]" aria-label="Restricted" /> : null}
                      {i.spaceName}
                    </span>
                  </div>
                </TD>
                <TD>
                  {i.ownerName ? (
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <Avatar name={i.ownerName} seed={i.ownerId} size="sm" />
                      {i.ownerName}
                    </span>
                  ) : (
                    <span className="font-medium text-cat-coral-text">No owner</span>
                  )}
                </TD>
                <TD numeric className="text-left">
                  {i.reviewBy ? formatDate(i.reviewBy) : <span className="text-muted">Not set</span>}
                </TD>
                <TD>
                  <FreshnessBadge state={i.freshness} reviewBy={i.reviewBy} size="sm" />
                </TD>
                <TD className="whitespace-nowrap text-muted">{i.verifiedAt ? timeAgo(i.verifiedAt) : "Never"}</TD>
              </TRow>
            ))}
          </TBody>
        </Table>
        </>
      ) : (
        <EmptyState
          icon={<CircleCheck />}
          title="Every page is in date"
          description="No published page is due for review in the next 14 days. Owners will be reminded automatically when that changes."
        />
      )}
    </section>
  );
}
