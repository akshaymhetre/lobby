"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, ChevronDown, LayoutGrid, List, Loader2, MapPin, Search, X } from "lucide-react";
import type { Facet } from "@lobby/core/people";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";

/** Search box, department and location filters, and the grid/list toggle, all kept in the URL. */
export function DirectoryToolbar({
  departments,
  locations,
  total,
  everyone,
}: {
  departments: Facet[];
  locations: Facet[];
  total: number;
  everyone: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedDepts = params.getAll("department");
  const selectedLocs = params.getAll("location");
  const view = params.get("view") === "grid" ? "grid" : "list";

  const push = React.useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete("page");
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  // Debounce typing into the URL.
  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (q.trim() === current) return;
    const t = setTimeout(() => push((p) => (q.trim() ? p.set("q", q.trim()) : p.delete("q"))), 220);
    return () => clearTimeout(t);
  }, [q, params, push]);

  // "/" focuses the search box, like most directories.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = (key: "department" | "location", value: string) =>
    push((p) => {
      const list = p.getAll(key);
      p.delete(key);
      const nextList = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      for (const v of nextList) p.append(key, v);
    });

  const clearAll = () => {
    setQ("");
    push((p) => {
      p.delete("q");
      p.delete("department");
      p.delete("location");
    });
  };

  const filtered = !!(params.get("q") || selectedDepts.length || selectedLocs.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && q) {
              e.preventDefault();
              setQ("");
            }
          }}
          placeholder="Search by name, title, team or skill"
          aria-label="Search people"
          leading={pending ? <Loader2 className="animate-spin-slow" /> : <Search />}
          trailing={<Kbd className={cn("hidden sm:inline-flex", q && "sm:invisible")}>/</Kbd>}
          className="sm:max-w-[420px]"
        />
        <div className="flex items-center gap-2">
          <FacetMenu
            label="Department"
            icon={<Building2 />}
            facets={departments}
            selected={selectedDepts}
            onToggle={(v) => toggle("department", v)}
            onClear={() => push((p) => p.delete("department"))}
          />
          <FacetMenu
            label="Location"
            icon={<MapPin />}
            facets={locations}
            selected={selectedLocs}
            onToggle={(v) => toggle("location", v)}
            onClear={() => push((p) => p.delete("location"))}
          />
          <SegmentedControl
            aria-label="Layout"
            size="sm"
            className="ml-auto hidden md:inline-flex"
            value={view}
            onValueChange={(v) => push((p) => (v === "grid" ? p.set("view", "grid") : p.delete("view")))}
            options={[
              { value: "list", label: <span className="sr-only">List</span>, icon: <List aria-hidden /> },
              { value: "grid", label: <span className="sr-only">Grid</span>, icon: <LayoutGrid aria-hidden /> },
            ]}
          />
        </div>
      </div>

      {/* The count only needs a line when a filter is on; the masthead already says how many people there are. */}
      <div className={cn("flex flex-wrap items-center gap-2", filtered ? "min-h-7" : "sr-only")} aria-live="polite">
        <p className="tabular text-small text-muted">
          {filtered ? (
            <>
              <span className="font-medium text-fg">{total}</span> of {everyone} {everyone === 1 ? "person" : "people"}
            </>
          ) : (
            <>
              <span className="font-medium text-fg">{everyone}</span> {everyone === 1 ? "person" : "people"}
            </>
          )}
        </p>
        {selectedDepts.map((d) => (
          <Chip key={`d-${d}`} selected onClick={() => toggle("department", d)} onRemove={() => toggle("department", d)}>
            {d}
          </Chip>
        ))}
        {selectedLocs.map((l) => (
          <Chip key={`l-${l}`} selected onClick={() => toggle("location", l)} onRemove={() => toggle("location", l)}>
            {l}
          </Chip>
        ))}
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted">
            <X aria-hidden />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FacetMenu({
  label,
  icon,
  facets,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  icon: React.ReactNode;
  facets: Facet[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  // Keep selected values visible even when the other filters leave them with zero matches.
  const merged = [...facets, ...selected.filter((s) => !facets.some((f) => f.value === s)).map((value) => ({ value, count: 0 }))];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className={cn(selected.length && "text-accent-text")}>
          {icon}
          {label}
          {selected.length ? (
            <span className="tabular rounded-full bg-accent-soft px-1.5 text-caption font-medium text-accent-text">{selected.length}</span>
          ) : null}
          <ChevronDown className="text-subtle" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {merged.length === 0 ? <p className="px-2 py-2 text-small text-muted">Nothing to filter by yet.</p> : null}
        {merged.map((f) => (
          <DropdownMenuCheckboxItem
            key={f.value}
            checked={selected.includes(f.value)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => onToggle(f.value)}
          >
            <span className="truncate">{f.value}</span>
            <span className="tabular ml-auto pl-4 text-caption text-subtle">{f.count}</span>
          </DropdownMenuCheckboxItem>
        ))}
        {selected.length ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onClear}>Clear {label.toLowerCase()}</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
