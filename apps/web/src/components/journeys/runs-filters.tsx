"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all";

/** Filters for the People team's view of every journey. State lives in the URL. */
export function RunsFilters({ journeys, departments }: { journeys: { id: string; name: string }[]; departments: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");

  const update = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "" || v === ALL) next.delete(k);
        else next.set(k, v);
      }
      next.set("view", "all");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  React.useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => update({ q }), 250);
    return () => clearTimeout(t);
  }, [q, params, update]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <Input
        leading={<Search />}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people"
        aria-label="Search people"
        className="lg:max-w-[260px]"
      />
      <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-1">
        <Select value={params.get("journey") ?? ALL} onValueChange={(v) => update({ journey: v })}>
          <SelectTrigger aria-label="Journey" className="lg:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All journeys</SelectItem>
            {journeys.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.get("department") ?? ALL} onValueChange={(v) => update({ department: v })}>
          <SelectTrigger aria-label="Department" className="lg:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SegmentedControl
        aria-label="Status"
        value={params.get("status") ?? "active"}
        onValueChange={(v) => update({ status: v === "active" ? null : v })}
        options={[
          { value: "active", label: "In progress" },
          { value: "completed", label: "Completed" },
          { value: "all", label: "All" },
        ]}
        className="self-start"
      />
    </div>
  );
}
