"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar } from "@/components/ui/avatar";
import { controlBase } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export interface PersonOption {
  id: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
}

export interface AppOption {
  id: string;
  name: string;
  category: string;
  hasAccess: boolean;
}

function TriggerButton({
  id,
  open,
  invalid,
  children,
  onClear,
  hasValue,
  ...props
}: React.ComponentProps<"button"> & {
  open: boolean;
  invalid?: boolean;
  onClear?: () => void;
  hasValue: boolean;
}) {
  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        className={cn(
          controlBase,
          "flex h-10 items-center justify-between gap-2 px-3 text-left md:h-9",
          !hasValue && "text-subtle",
          hasValue && onClear && "pr-16",
        )}
        {...props}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">{children}</span>
        <ChevronsUpDown className="size-4 shrink-0 stroke-[1.5] text-subtle" aria-hidden />
      </button>
      {hasValue && onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear"
          className="focus-ring absolute right-8 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-[4px] text-subtle hover:bg-hover hover:text-fg"
        >
          <X className="size-3.5 stroke-[1.5]" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Searches people on the server as you type. */
export function PersonPicker({
  id,
  value,
  onChange,
  search,
  invalid,
  initial,
  placeholder = "Choose a person",
}: {
  id?: string;
  value: string | null;
  onChange: (id: string | null, person: PersonOption | null) => void;
  search: (q: string) => Promise<PersonOption[]>;
  invalid?: boolean;
  initial?: PersonOption | null;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PersonOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<PersonOption | null>(initial ?? null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await search(query);
        if (!cancelled) setResults(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, open, search]);

  const current = value && selected?.id === value ? selected : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TriggerButton
          id={id}
          open={open}
          invalid={invalid}
          hasValue={!!current}
          onClear={() => {
            setSelected(null);
            onChange(null, null);
          }}
        >
          {current ? (
            <>
              <Avatar name={current.name} src={current.avatarUrl} seed={current.id} size="xs" />
              <span className="truncate text-fg">{current.name}</span>
            </>
          ) : (
            placeholder
          )}
        </TriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0">
        <Command shouldFilter={false} className="bg-transparent">
          <CommandInput placeholder="Search by name" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{loading ? "Searching..." : "No one by that name."}</CommandEmpty>
            {results.map((p) => (
              <CommandItem
                key={p.id}
                value={p.id}
                onSelect={() => {
                  setSelected(p);
                  onChange(p.id, p);
                  setOpen(false);
                }}
                className="h-auto py-1.5 md:h-auto"
              >
                <Avatar name={p.name} src={p.avatarUrl} seed={p.id} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-fg">{p.name}</span>
                  {p.title ? (
                    <span className="truncate text-caption text-muted">{p.title}</span>
                  ) : null}
                </span>
                {value === p.id ? (
                  <Check className="ml-auto !text-accent-text" aria-hidden />
                ) : null}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Pick an app; apps you can't open yet are listed first, since that's usually why you're here. */
export function AppPicker({
  id,
  value,
  onChange,
  apps,
  invalid,
}: {
  id?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  apps: AppOption[];
  invalid?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const current = apps.find((a) => a.id === value) ?? null;
  const groups: [string, AppOption[]][] = [
    ["Apps you can ask for", apps.filter((a) => !a.hasAccess)],
    ["Apps you already use", apps.filter((a) => a.hasAccess)],
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TriggerButton
          id={id}
          open={open}
          invalid={invalid}
          hasValue={!!current}
          onClear={() => onChange(null)}
        >
          {current ? <span className="truncate text-fg">{current.name}</span> : "Choose an app"}
        </TriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0">
        <Command className="bg-transparent">
          <CommandInput placeholder="Search apps" />
          <CommandList>
            <CommandEmpty>No app by that name.</CommandEmpty>
            {groups.map(([heading, list]) =>
              list.length ? (
                <CommandGroup key={heading} heading={heading}>
                  {list.map((a) => (
                    <CommandItem
                      key={a.id}
                      value={`${a.name} ${a.category}`}
                      onSelect={() => {
                        onChange(a.id);
                        setOpen(false);
                      }}
                    >
                      <span className="truncate text-fg">{a.name}</span>
                      <span className="truncate text-caption text-subtle">{a.category}</span>
                      {value === a.id ? (
                        <Check className="ml-auto !text-accent-text" aria-hidden />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null,
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
