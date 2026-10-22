"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, PenLine, Plus, ShieldCheck, Trash2, User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CellList, RowCell } from "@/components/ui/cells";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { saveRoleMappingsAction } from "@/app/(app)/admin/_actions";
import { SaveBar } from "./save-bar";
import { SettingsGroup } from "./settings-group";

type RoleKey = "admin" | "agent" | "content-editor";
const ROLES: { key: RoleKey; label: string; description: string }[] = [
  { key: "admin", label: "Administrator", description: "Everything, including this page" },
  { key: "agent", label: "Helpdesk agent", description: "Works tickets in the help queue" },
  { key: "content-editor", label: "Content editor", description: "Creates and edits knowledge pages" },
];

interface Row {
  id: number;
  groupName: string;
  role: RoleKey;
}

let seq = 0;

/** Edits IdP group -> role mappings as a whole set; one save applies all changes. */
export function RoleMappingsEditor({ initial, knownGroups }: { initial: { groupName: string; role: string }[]; knownGroups: string[] }) {
  const start = useMemo(
    () => initial.filter((m) => ROLES.some((r) => r.key === m.role)).map((m) => ({ id: seq++, groupName: m.groupName, role: m.role as RoleKey })),
    [initial],
  );
  const [rows, setRows] = useState<Row[]>(start);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dirty = JSON.stringify(rows.map(({ groupName, role }) => [groupName, role])) !== JSON.stringify(start.map(({ groupName, role }) => [groupName, role]));
  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="section-stack">
      <datalist id="known-groups">
        {knownGroups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <SettingsGroup
        title="Group to role"
        description="A group name exactly as your identity provider sends it, and the role its members get. Changes apply the next time each person signs in."
        state={<Badge tone={rows.length ? "accent" : "neutral"} dot>{rows.length === 1 ? "1 mapping" : `${rows.length} mappings`}</Badge>}
      >
        {rows.length ? (
          <ul className="flex flex-col gap-2.5">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2 rounded-card bg-sunken/70 p-2.5 shadow-inset sm:grid-cols-[minmax(0,1fr)_auto_200px_44px] sm:gap-3">
                <Input
                  aria-label="Group name"
                  list="known-groups"
                  value={r.groupName}
                  onChange={(e) => update(r.id, { groupName: e.target.value })}
                  placeholder="for example it-team"
                  spellCheck={false}
                  className="col-start-1 font-mono"
                />
                {/* The wire from group to role, in the system map's connector language. */}
                <span aria-hidden className="relative hidden h-0.5 w-12 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--lb-accent-ring)] sm:block">
                  <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-accent" />
                  <span className="absolute -right-1 -top-[3px] size-2 rounded-full bg-accent" />
                </span>
                <div className="col-span-1 col-start-1 row-start-2 sm:col-start-3 sm:row-start-1">
                  <Select value={r.role} onValueChange={(v) => update(r.id, { role: v as RoleKey })}>
                    <SelectTrigger aria-label="Role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove mapping for ${r.groupName || "this group"}`}
                  onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                  className="col-start-2 row-start-1 justify-self-end sm:col-start-4"
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={<Plus />}
            title="No group grants a role yet"
            description="Only the break-glass administrator has admin rights. Map a group from your identity provider to share the work."
          />
        )}
        <div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, { id: seq++, groupName: "", role: "agent" }])}>
            <Plus aria-hidden />
            Add mapping
          </Button>
        </div>
      </SettingsGroup>

      <SettingsGroup title="What each role can do" description="Employee and Manager need no mapping: everyone is an employee, and anyone with direct reports is a manager." flush cellClassName="bg-transparent shadow-none dark:bg-transparent">
        <CellList density="compact">
          {[
            { label: "Employee", description: "Everyone who signs in. No mapping needed.", icon: <User />, mapped: 0 },
            { label: "Manager", description: "Anyone with direct reports in the org chart. Derived, never mapped.", icon: <Users />, mapped: 0 },
            ...ROLES.map((r) => ({ ...r, icon: r.key === "admin" ? <ShieldCheck /> : r.key === "agent" ? <LifeBuoy /> : <PenLine />, mapped: rows.filter((x) => x.role === r.key).length })),
          ].map((r) => (
            <RowCell
              key={r.label}
              leading={<span aria-hidden className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent-text [&>svg]:size-4 [&>svg]:stroke-[1.75]">{r.icon}</span>}
              title={r.label}
              meta={r.description}
              trailing={r.mapped ? <Badge tone="accent" size="sm">{r.mapped === 1 ? "1 group" : `${r.mapped} groups`}</Badge> : null}
            />
          ))}
        </CellList>
      </SettingsGroup>

      <SaveBar dirty={dirty}>
        <Button
          type="button"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveRoleMappingsAction(rows.map(({ groupName, role }) => ({ groupName, role })));
              if (r.ok) {
                toast.success(r.message ?? "Saved.");
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          Save role mappings
        </Button>
      </SaveBar>
    </div>
  );
}
