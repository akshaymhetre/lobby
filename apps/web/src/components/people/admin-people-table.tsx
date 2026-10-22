"use client";

import { TableToolbar } from "@/components/ui/table-toolbar";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Search, SearchX, UserCheck, UserRound, UserX } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { CountUp } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { HeroLight } from "@/components/ui/hero-light";
import styles from "./day-track.module.css";
import { timeAgo } from "@/lib/time";
import { setActiveAction } from "@/app/(app)/admin/people/_actions";

export interface AdminRow {
  id: string;
  displayName: string;
  email: string;
  title: string | null;
  department: string | null;
  status: "active" | "deactivated";
  source: "oidc" | "scim" | "csv" | "seed" | "local";
  lastLoginAt: string | null;
  isBreakGlass: boolean;
  avatarUrl: string | null;
}

/* Sources are plain words; only the two that need an admin's eye (a local password account, break-glass) get a tinted pill. */
const SOURCE: Record<AdminRow["source"], { label: string; tone: BadgeTone | null }> = {
  oidc: { label: "Sign-in", tone: null },
  scim: { label: "SCIM", tone: null },
  csv: { label: "CSV import", tone: null },
  seed: { label: "Demo data", tone: null },
  local: { label: "Local", tone: "warning" },
};

export function AdminPeopleTable({
  rows,
  counts,
  viewerId,
}: {
  rows: AdminRow[];
  counts: { active: number; deactivated: number };
  viewerId: string;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "deactivated" | "all">("active");
  const [confirm, setConfirm] = React.useState<AdminRow | null>(null);
  const [pending, start] = React.useTransition();
  const [recency, setRecency] = React.useState<Bucket | null>(null);
  // "Never signed in" starts folded into a wall of faces: one block to chase, not 31 rows to scroll.
  const [neverOpen, setNeverOpen] = React.useState(false);
  // "Today" is the calendar day, not the last 24 hours, so a sign-in late last night reads as this week.
  const bucketOf = React.useMemo(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const day = 86_400_000;
    return (r: AdminRow): Bucket => {
      if (!r.lastLoginAt) return "never";
      const t = new Date(r.lastLoginAt).getTime();
      return t >= midnight.getTime()
        ? "today"
        : t >= midnight.getTime() - 6 * day
          ? "week"
          : t >= midnight.getTime() - 29 * day
            ? "month"
            : "earlier";
    };
  }, []);
  // "Active" on every row says nothing while the filter already says Active.
  const showStatus = status !== "active";

  const shown = React.useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (recency && (r.status !== "active" || bucketOf(r) !== recency)) return false;
      const hay =
        `${r.displayName} ${r.email} ${r.title ?? ""} ${r.department ?? ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [rows, q, status, recency, bucketOf]);

  // The table is grouped by last sign-in, most recent first, so the accounts nobody has used
  // (the ones an admin should chase) are one block with one count instead of 31 scattered "Never"s.
  const groups = React.useMemo(() => {
    const order: { key: Bucket | "deactivated"; label: string; note?: string }[] = [
      { key: "today", label: "Signed in today" },
      { key: "week", label: "Signed in this week" },
      { key: "month", label: "Signed in this month" },
      { key: "earlier", label: "Signed in earlier" },
      { key: "never", label: "Never signed in", note: "They have an account but have not opened Lobby yet." },
      { key: "deactivated", label: "Deactivated" },
    ];
    const by = new Map<string, AdminRow[]>();
    for (const r of shown) {
      const k = r.status === "deactivated" ? "deactivated" : bucketOf(r);
      by.set(k, [...(by.get(k) ?? []), r]);
    }
    return order.filter((o) => by.has(o.key)).map((o) => ({ ...o, rows: by.get(o.key)! }));
  }, [shown, bucketOf]);

  // A column that says the same word on every row says nothing: when everyone came from one place,
  // the source goes in a caption once and the column drops out (break-glass keeps its pill by the name).
  const sources = new Set(rows.filter((r) => !r.isBreakGlass).map((r) => r.source));
  const oneSource = sources.size === 1 ? SOURCE[[...sources][0]!].label : null;
  const columns = 4 + (showStatus ? 1 : 0) + (oneSource ? 0 : 1);

  const apply = (row: AdminRow, active: boolean) =>
    start(async () => {
      const res = await setActiveAction(row.id, active);
      if (res.ok) {
        toast.success(
          active ? `${row.displayName} is active again` : `${row.displayName} is deactivated`,
          {
            description: active
              ? "They can sign in with your identity provider."
              : "We signed them out of every session.",
          },
        );
        setConfirm(null);
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-4">
      <SignInActivity rows={rows} bucketOf={bucketOf} value={recency} onChange={setRecency} />
      <TableToolbar
        search={
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, title or team"
            aria-label="Search people"
            leading={<Search />}
          />
        }
        filters={
          <SegmentedControl
            aria-label="Status"
            size="sm"
            value={status}
            onValueChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: "active", label: `Active ${counts.active}` },
              { value: "deactivated", label: `Deactivated ${counts.deactivated}` },
              { value: "all", label: "All" },
            ]}
          />
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          variant="filtered"
          icon={<SearchX />}
          title={
            status === "deactivated" && !q && !recency ? "No one is deactivated" : "No one matches"
          }
          description={
            status === "deactivated" && !q && !recency
              ? "People you deactivate, or your identity provider turns off, show up here."
              : recency
                ? "Clear the sign-in filter above, or try another name or email."
                : "Try another name or email."
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Person</TH>
              <TH className="hidden md:table-cell">Role</TH>
              {showStatus ? <TH className="hidden sm:table-cell">Status</TH> : null}
              {oneSource ? null : <TH className="hidden sm:table-cell">Source</TH>}
              <TH className="hidden lg:table-cell">Last sign-in</TH>
              <TH className="w-12">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          {groups.map((g) => (
            <TBody key={g.key}>
              <tr className="border-b border-border">
                <th colSpan={columns} scope="colgroup" className="px-4 pb-2.5 pt-5 text-left font-normal">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className={cn(
                        "tabular inline-flex h-7 items-center gap-2 rounded-full px-3 text-small font-medium",
                        g.key === "never" ? "cat-amber" : g.key === "deactivated" ? "bg-danger-soft text-danger-text" : g.key === "today" ? "bg-now text-now-fg" : "bg-sunken text-fg",
                      )}
                    >
                      {g.label}
                      <span className="opacity-80">{g.rows.length}</span>
                    </span>
                    {g.note ? <span className="text-small text-muted">{g.note}</span> : null}
                  </span>
                </th>
              </tr>
              {g.key === "never" && !neverOpen && !q.trim() && recency !== "never" ? (
                <tr className="bg-cat-amber-soft/25 dark:bg-cat-amber-soft/10">
                  <td colSpan={columns} className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      <ul className="flex flex-wrap items-center gap-1.5" aria-label={`${g.rows.length} accounts that have never signed in`}>
                        {g.rows.slice(0, 24).map((r) => (
                          <li key={r.id}>
                            <Link href={`/people/${r.id}`} className="focus-ring press block rounded-full" title={r.displayName} aria-label={r.displayName}>
                              <Avatar name={r.displayName} seed={r.id} src={r.avatarUrl} size="lg" className="ring-2 ring-surface" />
                            </Link>
                          </li>
                        ))}
                        {g.rows.length > 24 ? (
                          <li className="tabular inline-flex size-10 items-center justify-center rounded-full bg-raised text-small font-medium text-muted shadow-cell">
                            +{g.rows.length - 24}
                          </li>
                        ) : null}
                      </ul>
                      <Button variant="secondary" size="sm" onClick={() => setNeverOpen(true)} className="ml-auto">
                        Show all {g.rows.length} as rows
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : null}
              {(g.key === "never" && !neverOpen && !q.trim() && recency !== "never" ? [] : g.rows).map((r) => {
                const never = g.key === "never";
                return (
                <TRow key={r.id} className={never ? "bg-cat-amber-soft/25 dark:bg-cat-amber-soft/10" : undefined}>
                  <TD>
                    <div className="flex max-w-[260px] items-center gap-3 py-0.5 sm:min-w-[200px] sm:max-w-[340px]">
                      <Avatar
                        name={r.displayName}
                        seed={r.id}
                        src={r.avatarUrl}
                        size="lg"
                        className={r.status === "deactivated" ? "opacity-60" : undefined}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="flex min-w-0 items-center gap-2">
                          <Link
                            href={`/people/${r.id}`}
                            className="focus-ring -my-1 truncate rounded-[4px] py-1 font-medium text-fg hover:underline"
                          >
                            {r.displayName}
                          </Link>
                          {r.isBreakGlass && oneSource ? (
                            <Badge tone="warning" size="sm">
                              Break-glass
                            </Badge>
                          ) : null}
                        </span>
                        {/* Phones drop the email rather than cut it off; the profile has it. */}
                      <span className="hidden truncate text-small text-muted sm:block">{r.email}</span>
                        {/* Below `lg` the last sign-in column folds in here; a deactivated account always says so. */}
                        <span
                          className="truncate text-small text-muted lg:hidden"
                          suppressHydrationWarning
                        >
                          {r.status === "deactivated" ? (
                            <span className="text-danger-text">Deactivated</span>
                          ) : r.lastLoginAt ? (
                            `Signed in ${timeAgo(r.lastLoginAt)}`
                          ) : (
                            "Never signed in"
                          )}
                        </span>
                      </div>
                    </div>
                  </TD>
                  <TD className="hidden md:table-cell">
                    <div className="flex min-w-0 max-w-[260px] flex-col">
                      <span className="truncate">
                        {r.title ?? <span className="text-subtle">No title</span>}
                      </span>
                      <span className="truncate text-small text-muted">{r.department ?? ""}</span>
                    </div>
                  </TD>
                  {showStatus ? (
                    <TD className="hidden sm:table-cell">
                      {r.status === "active" ? (
                        <span className="inline-flex items-center gap-1.5 text-small text-muted">
                          <span className="size-1.5 rounded-full bg-success" aria-hidden />
                          Active
                        </span>
                      ) : (
                        <Badge tone="danger" dot>
                          Deactivated
                        </Badge>
                      )}
                    </TD>
                  ) : null}
                  {oneSource ? null : (
                    <TD className="hidden sm:table-cell">
                      {r.isBreakGlass ? (
                        <Badge tone="warning">Break-glass</Badge>
                      ) : SOURCE[r.source].tone ? (
                        <Badge tone={SOURCE[r.source].tone!}>{SOURCE[r.source].label}</Badge>
                      ) : (
                        <span className="text-small text-muted">{SOURCE[r.source].label}</span>
                      )}
                    </TD>
                  )}
                  <TD className="hidden whitespace-nowrap text-small text-muted lg:table-cell">
                    {/* Relative time can tick between the server and client renders; the mismatch is harmless. */}
                    {never ? (
                      <span className="sr-only">Never</span>
                    ) : r.lastLoginAt ? (
                      <time
                        dateTime={r.lastLoginAt}
                        title={new Date(r.lastLoginAt).toLocaleString("en-GB")}
                        suppressHydrationWarning
                      >
                        {timeAgo(r.lastLoginAt)}
                      </time>
                    ) : (
                      "Never"
                    )}
                  </TD>
                  <TD align="right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${r.displayName}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => router.push(`/people/${r.id}`)}>
                          <UserRound />
                          View profile
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {r.status === "active" ? (
                          <DropdownMenuItem
                            destructive
                            disabled={r.id === viewerId || r.isBreakGlass}
                            onSelect={() => setConfirm(r)}
                          >
                            <UserX />
                            {r.id === viewerId
                              ? "You cannot deactivate yourself"
                              : r.isBreakGlass
                                ? "Break-glass stays active"
                                : "Deactivate"}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem disabled={pending} onSelect={() => apply(r, true)}>
                            <UserCheck />
                            Reactivate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TD>
                </TRow>
                );
              })}
            </TBody>
          ))}
        </Table>
      )}
      <p className="tabular text-small text-muted">
        Showing {shown.length} of {rows.length}
      </p>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Deactivate {confirm?.displayName}?</DialogTitle>
            <DialogDescription>
              They will be signed out everywhere and will not be able to sign in to Lobby.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-muted">
              <li>Their tickets, pages and history stay as they are.</li>
              <li>They disappear from the directory, search and the org chart.</li>
              <li>You can reactivate them at any time.</li>
            </ul>
            {confirm?.source === "scim" ? (
              <p className="mt-3 rounded-cell bg-warning-soft px-3 py-2 text-small text-warning-text">
                This person is managed by SCIM. Your identity provider may turn them back on at its
                next sync.
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => confirm && apply(confirm, false)}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Bucket = "today" | "week" | "month" | "earlier" | "never";

const BUCKETS: { key: Bucket; label: string; fill: string; dot: string }[] = [
  { key: "today", label: "Today", fill: "bg-now text-now-fg", dot: "bg-now" },
  { key: "week", label: "This week", fill: "cat-blue", dot: "bg-cat-blue" },
  {
    key: "month",
    label: "This month",
    fill: "bg-cat-blue-soft text-cat-blue-text",
    dot: "bg-cat-blue-soft ring-1 ring-cat-blue/40",
  },
  {
    key: "earlier",
    label: "Earlier",
    fill: "bg-raised text-muted shadow-cell",
    dot: "bg-raised shadow-cell",
  },
  { key: "never", label: "Never signed in", fill: "cat-amber", dot: "bg-cat-amber" },
];

/**
 * The admin page's lead: who is actually using Lobby. Active accounts as one bar split by their
 * last sign-in (today in the vivid "now" blue, never signed in hatched like time off), and every
 * segment is a filter for the table underneath, so "who has never signed in" is one click.
 */
function SignInActivity({
  rows,
  bucketOf,
  value,
  onChange,
}: {
  rows: AdminRow[];
  bucketOf: (r: AdminRow) => Bucket;
  value: Bucket | null;
  onChange: (b: Bucket | null) => void;
}) {
  const active = rows.filter((r) => r.status === "active");
  const counts = Object.fromEntries(BUCKETS.map((b) => [b.key, 0])) as Record<Bucket, number>;
  for (const r of active) counts[bucketOf(r)]++;
  const recent = counts.today + counts.week;
  const total = active.length || 1;
  const shown = BUCKETS.filter((b) => counts[b.key] > 0);
  return (
    <section
      aria-labelledby="signin-heading"
      className="panel relative isolate flex flex-col gap-4 overflow-hidden rounded-panel p-4 sm:p-5 md:p-6"
    >
      {/* Amber while accounts have never been used (something is due), green once everyone has. */}
      <HeroLight tone={counts.never ? "amber" : "green"} position="top-right" />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id="signin-heading" className="text-h2 font-medium text-fg md:text-hero">
            Sign-in activity
          </h2>
          <p className="mt-1 text-body text-muted" suppressHydrationWarning>
            <CountUp value={recent} duration={0.9} delay={0.2} className="font-medium text-fg" /> of{" "}
            {active.length} active {active.length === 1 ? "account" : "accounts"} signed in this
            week.
            {counts.never ? ` ${counts.never} never have.` : ""}
          </p>
        </div>
        {value ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Show everyone
          </Button>
        ) : null}
      </div>
      <div className="flex h-14 w-full gap-1.5" role="group" aria-label="Filter by last sign-in">
        {shown.map((b, i) => {
          const n = counts[b.key];
          const on = value === b.key;
          return (
            <button
              key={b.key}
              type="button"
              aria-pressed={on}
              aria-label={`${b.label}: ${n} ${n === 1 ? "person" : "people"}. ${on ? "Showing only them" : "Show only them"}`}
              onClick={() => onChange(on ? null : b.key)}
              className={cn(
                styles.band,
                "focus-ring press relative flex min-w-11 items-center justify-between gap-2 overflow-hidden rounded-cell px-3 text-left",
                b.fill,
                on && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
              )}
              style={{ flexGrow: n / total, flexBasis: 0, ["--d" as string]: `${120 + i * 90}ms` }}
              suppressHydrationWarning
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="tabular text-body-lg font-medium" aria-hidden>
                  {n}
                </span>
                {(b.key === "today" || b.key === "week") && n / total > 0.16 ? (
                  <AvatarStack
                    people={active
                      .filter((r) => bucketOf(r) === b.key)
                      .map((r) => ({ name: r.displayName, seed: r.id, src: r.avatarUrl }))}
                    max={4}
                    size="sm"
                    className="hidden sm:flex [&>*]:ring-white/60"
                  />
                ) : null}
              </span>
              {n / total > 0.14 ? (
                <span className="truncate text-small" aria-hidden>
                  {b.label}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-caption text-muted" aria-hidden>
        {shown.map((b) => (
          <li key={b.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", b.dot)} />
            {b.label}
            <span className="tabular text-subtle">{counts[b.key]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
