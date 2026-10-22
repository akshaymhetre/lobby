import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function Table({ className, wrapperClassName, ...props }: React.ComponentProps<"table"> & { wrapperClassName?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-card bg-surface shadow-panel", wrapperClassName)}>
      <table className={cn("w-full border-collapse text-body", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-sunken/60 dark:bg-raised/50", className)} {...props} />;
}

export function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&>tr:last-child]:border-b-0", className)} {...props} />;
}

export function TRow({
  className,
  interactive,
  selected,
  ...props
}: React.ComponentProps<"tr"> & { interactive?: boolean; selected?: boolean }) {
  return (
    <tr
      data-selected={selected || undefined}
      className={cn(
        "border-b border-border transition-colors duration-120 ease-standard",
        interactive && "cursor-pointer hover:bg-hover",
        "data-[selected]:bg-selected",
        className,
      )}
      {...props}
    />
  );
}

export type SortDirection = "asc" | "desc" | false;

export function TH({
  className,
  children,
  sortable,
  sorted = false,
  onSort,
  align = "left",
  ...props
}: React.ComponentProps<"th"> & {
  sortable?: boolean;
  sorted?: SortDirection;
  onSort?: () => void;
  align?: "left" | "right" | "center";
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const ariaSort = sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : sortable ? "none" : undefined;
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        "h-9 whitespace-nowrap border-b border-border px-3 text-caption font-medium text-muted first:pl-4 last:pr-4",
        alignClass,
        className,
      )}
      {...props}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            "focus-ring group -mx-1.5 inline-flex h-7 items-center gap-1 rounded-[4px] px-1.5 hover:bg-hover hover:text-fg",
            sorted && "text-fg",
            align === "right" && "flex-row-reverse",
          )}
        >
          {children}
          {sorted === "asc" ? (
            <ArrowUp className="size-3.5 stroke-[1.5]" aria-hidden />
          ) : sorted === "desc" ? (
            <ArrowDown className="size-3.5 stroke-[1.5]" aria-hidden />
          ) : (
            <ChevronsUpDown className="size-3.5 stroke-[1.5] opacity-50 group-hover:opacity-100" aria-hidden />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function TD({
  className,
  align = "left",
  numeric,
  ...props
}: React.ComponentProps<"td"> & { align?: "left" | "right" | "center"; numeric?: boolean }) {
  return (
    <td
      className={cn(
        "h-11 px-3 py-1.5 align-middle text-fg first:pl-4 last:pr-4",
        align === "right" || numeric ? "text-right" : align === "center" ? "text-center" : "text-left",
        numeric && "tabular whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}
