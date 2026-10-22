"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { ComboSelect, type ComboOption } from "./combo-select";

type Option = { value: string; label: string; count?: number };
type Values = { action: string; actor: string; from: string; to: string };
const ALL = "__all";
const EMPTY: Values = { action: "", actor: "", from: "", to: "" };

/**
 * Audit log filters (audit G2). Every change applies at once, so there is no Filter button: the URL is
 * the state, which also means back and reload keep the view. "Who" is a searchable combobox.
 */
export function AuditFilters({ values, actions, actors }: { values: Values; actions: Option[]; actors: ComboOption[] }) {
  const router = useRouter();
  const [v, setV] = useState(values);
  const [pending, start] = useTransition();
  // A server-side change (back button, a link) wins over what is on screen.
  useEffect(() => setV(values), [values]);

  const apply = (next: Values) => {
    setV(next);
    const q = new URLSearchParams();
    (Object.entries(next) as [keyof Values, string][]).forEach(([k, val]) => val && q.set(k, val));
    const s = q.toString();
    start(() => router.push(s ? `/admin/audit?${s}` : "/admin/audit"));
  };
  const any = Object.values(values).some(Boolean);

  return (
    <div
      role="search"
      aria-label="Filter the audit log"
      aria-busy={pending || undefined}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(150px,auto)_minmax(150px,auto)_auto] lg:items-end"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-small font-medium text-fg">Action</span>
        <Select value={v.action || ALL} onValueChange={(x) => apply({ ...v, action: x === ALL ? "" : x })}>
          <SelectTrigger aria-label="Action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
                {typeof a.count === "number" ? <span className="tabular ml-1.5 text-subtle">{a.count}</span> : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="audit-who" className="text-small font-medium text-fg">
          Who
        </label>
        <ComboSelect id="audit-who" aria-label="Who" value={v.actor} onValueChange={(x) => apply({ ...v, actor: x })} options={actors} allLabel="Anyone" placeholder="Search people" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="audit-from" className="text-small font-medium text-fg">
          From
        </label>
        <DateField id="audit-from" name="from" value={v.from} max={v.to || undefined} placeholder="Any time" onValueChange={(from) => apply({ ...v, from })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="audit-to" className="text-small font-medium text-fg">
          To
        </label>
        <DateField id="audit-to" name="to" value={v.to} min={v.from || undefined} placeholder="Now" onValueChange={(to) => apply({ ...v, to })} />
      </div>
      <div className={cn("flex h-10 items-center gap-2 sm:col-span-2 lg:col-span-1 md:h-9", !any && !pending && "max-lg:hidden")}>
        {any ? (
          <Button type="button" variant="ghost" onClick={() => apply(EMPTY)}>
            Clear
          </Button>
        ) : null}
        {pending ? <Loader2 className="size-4 animate-spin-slow text-subtle" aria-label="Updating" /> : null}
      </div>
    </div>
  );
}
