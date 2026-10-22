"use client";

import { useMemo, useState, useTransition } from "react";
import { KeyRound, Search, ShieldCheck, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CellList, RowCell } from "@/components/ui/cells";
import { CategoryBlock } from "@/components/ui/category-block";
import { cn } from "@/lib/cn";
import { groupMembersAction } from "@/app/(app)/admin/_actions";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { Reveal, RevealItem } from "@/components/ui/motion";

export interface GroupRow {
  id: string;
  name: string;
  displayName: string;
  source: string;
  members: number;
  roles: string[];
}

type Member = Awaited<ReturnType<typeof groupMembersAction>>[number];

const SOURCE: Record<string, { label: string; tone: BadgeTone }> = {
  oidc: { label: "Sign-in token", tone: "info" },
  scim: { label: "SCIM", tone: "accent" },
  csv: { label: "CSV import", tone: "neutral" },
  local: { label: "Created in Lobby", tone: "neutral" },
  seed: { label: "Demo data", tone: "neutral" },
};

const ROLE_LABEL: Record<string, string> = { admin: "Administrator", agent: "Helpdesk agent", "content-editor": "Content editor" };

export function GroupsTable({ groups }: { groups: GroupRow[] }) {
  const [q, setQ] = useState("");
  const [grant, setGrant] = useState<"all" | "roles" | "none">("all");
  const [open, setOpen] = useState<GroupRow | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [, start] = useTransition();
  const withRoles = useMemo(() => groups.filter((g) => g.roles.length).length, [groups]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups.filter((g) => {
      if (grant === "roles" && !g.roles.length) return false;
      if (grant === "none" && g.roles.length) return false;
      return needle ? `${g.displayName} ${g.name}`.toLowerCase().includes(needle) : true;
    });
  }, [groups, q, grant]);

  const show = (g: GroupRow) => {
    setOpen(g);
    setMembers(null);
    start(async () => setMembers(await groupMembersAction(g.id)));
  };

  const maxMembers = Math.max(1, ...groups.map((g) => g.members));
  // When every group comes from one place, say it once instead of in every row.
  const sources = [...new Set(groups.map((g) => g.source))];
  const oneSource = sources.length === 1 ? (SOURCE[sources[0]!]?.label ?? sources[0]) : null;
  if (!groups.length) {
    return (
      <EmptyState
        icon={<Users />}
        title="No groups yet"
        description="Groups arrive from your identity provider when people sign in, from SCIM provisioning, or from a CSV import."
      />
    );
  }

  return (
    <div className="section-content">
      <TableToolbar
        search={<Input type="search" leading={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter groups" aria-label="Filter groups" />}
        filters={
          <SegmentedControl
            aria-label="Role grants"
            size="sm"
            value={grant}
            onValueChange={(v) => setGrant(v as typeof grant)}
            options={[
              { value: "all", label: `All ${groups.length}` },
              { value: "roles", label: `Grant a role ${withRoles}` },
              { value: "none", label: "Employee only" },
            ]}
          />
        }
      />
      {oneSource && sources[0] !== "seed" ? (
        <p className="text-small text-muted">
          Every group here comes from <span className="text-fg">{/^[A-Z][a-z]/.test(oneSource) ? oneSource[0]!.toLowerCase() + oneSource.slice(1) : oneSource}</span>.
        </p>
      ) : null}
      {filtered.length ? (
        <CellList layout="grid" min="320px">
          {filtered.map((g) => (
            <RowCell
              key={g.id}
              onClick={() => show(g)}
              aria-label={`${g.displayName}, ${g.members} ${g.members === 1 ? "member" : "members"}${g.roles.length ? `, grants ${g.roles.map((r) => ROLE_LABEL[r] ?? r).join(" and ")}` : ""}`}
              leading={
                <span aria-hidden className={cn("grid size-11 place-items-center rounded-full [&>svg]:size-5 [&>svg]:stroke-[1.75]", g.roles.length ? "cat-blue" : "bg-sunken text-muted shadow-inset")}>
                  {g.roles.includes("admin") ? <ShieldCheck /> : g.roles.length ? <KeyRound /> : <Users />}
                </span>
              }
              title={g.displayName}
              meta={
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="truncate font-mono">{g.name}</span>
                  {oneSource ? null : <span>{SOURCE[g.source]?.label ?? g.source}</span>}
                </span>
              }
              trailing={
                <span className="flex flex-col items-end gap-1">
                  <span className="tabular text-h3 font-medium leading-none text-fg">{g.members}</span>
                  <span className="text-caption text-muted">{g.members === 1 ? "member" : "members"}</span>
                </span>
              }
            >
              <span className="flex flex-wrap items-center gap-1.5">
                {g.roles.length ? (
                  g.roles.map((r) => (
                    <Badge key={r} tone="accent" size="sm">
                      {ROLE_LABEL[r] ?? r}
                    </Badge>
                  ))
                ) : (
                  <span className="text-caption text-subtle">Employee only</span>
                )}
                {/* A bar scaled to the largest group: who actually holds the people, at a glance. */}
                <span aria-hidden className="ml-auto hidden h-1.5 w-20 overflow-hidden rounded-full bg-sunken shadow-inset sm:block">
                  <span className="block h-full origin-left rounded-full bg-cat-blue" style={{ transform: `scaleX(${g.members / maxMembers})` }} />
                </span>
              </span>
            </RowCell>
          ))}
        </CellList>
      ) : (
        <EmptyState
          variant="filtered"
          compact
          icon={<Search />}
          title={q ? `No group matches "${q}"` : grant === "roles" ? "No group grants a role yet" : "Every group grants a role"}
          description={q ? "Check the spelling, or search by the group's name in your identity provider." : "Map a group to a role on Identity & roles."}
        />
      )}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{open?.displayName}</SheetTitle>
            <SheetDescription>
              <span className="font-mono">{open?.name}</span> · {open?.members} {open?.members === 1 ? "member" : "members"}
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-5">
            {/* What membership means, before who the members are. */}
            {open?.roles.length ? (
              <CategoryBlock
                tone="blue"
                icon={open.roles.includes("admin") ? <ShieldCheck /> : <KeyRound />}
                title={`Grants ${open.roles.map((r) => ROLE_LABEL[r] ?? r).join(" and ")}`}
                subtitle="Every member gets it at their next sign-in"
              />
            ) : (
              <div className="flex min-h-16 items-center gap-3 rounded-card bg-sunken/70 px-4 py-3 shadow-inset">
                <Users className="size-5 shrink-0 stroke-[1.75] text-muted" aria-hidden />
                <span className="flex flex-col">
                  <span className="text-row font-medium text-fg">Employee only</span>
                  <span className="text-caption text-muted">Use it to choose who sees apps and pages</span>
                </span>
              </div>
            )}
            {members === null ? (
              <ul className="flex flex-col gap-2" aria-busy>
                {Array.from({ length: Math.min(open?.members ?? 4, 6) }).map((_, i) => (
                  <li key={i} className="flex h-[52px] items-center gap-3 px-3">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                  </li>
                ))}
              </ul>
            ) : members.length ? (
              // The sheet's one moment: the member cells build top to bottom once they arrive.
              <Reveal stagger={0.04} className="flex flex-col gap-2">
                {members.map((m) => (
                  <RevealItem key={m.id} duration={0.4}>
                    <RowCell
                      density="compact"
                      href={`/people/${m.id}`}
                      leading={<Avatar name={m.displayName} seed={m.id} src={m.avatarUrl ?? undefined} size="md" />}
                      title={m.displayName}
                      meta={m.title ?? m.email}
                      trailing={m.status === "deactivated" ? <Badge size="sm">Deactivated</Badge> : null}
                    />
                  </RevealItem>
                ))}
              </Reveal>
            ) : (
              <EmptyState compact icon={<Users />} title="Nobody in this group yet" description="Members appear when they sign in or are provisioned." />
            )}
            <p className="text-small text-muted">Membership is managed in your identity provider. Lobby reads it at sign-in and over SCIM.</p>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
