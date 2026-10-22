import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * One toolbar composition for every admin table (audit G10): search on the left, filters in the
 * middle, the one primary action on the right.
 *
 *   <TableToolbar
 *     search={<Input type="search" leading={<Search />} aria-label="Filter groups" placeholder="Filter groups" />}
 *     filters={<SegmentedControl aria-label="Status" size="sm" ... />}
 *     action={<Button><Plus aria-hidden />Add app</Button>}
 *   />
 *
 * Below `sm` it stacks: search full width, then filters and the action on one row. The search slot is
 * capped at 360px so the three slots keep their places as the table gets wider. Lives in the kit so every admin table
 * uses the same composition.
 */
export interface TableToolbarProps {
  /** The search or filter input. Rendered full width below `sm`, 360px max above. */
  search?: React.ReactNode;
  /** Segmented controls, facet menus, date fields. */
  filters?: React.ReactNode;
  /** The one primary action for the table. */
  action?: React.ReactNode;
  /** A short count or status line under the row, e.g. "41 people". */
  summary?: React.ReactNode;
  className?: string;
}

export function TableToolbar({ search, filters, action, summary, className }: TableToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} data-table-toolbar>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {search ? <div className="min-w-0 flex-1 sm:max-w-[360px]">{search}</div> : null}
        {filters || action ? (
          <div className="flex min-w-0 items-center gap-2 sm:flex-1">
            {filters ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{filters}</div> : null}
            {action ? <div className="ml-auto flex shrink-0 items-center gap-2">{action}</div> : null}
          </div>
        ) : null}
      </div>
      {summary ? <p className="tabular text-small text-muted">{summary}</p> : null}
    </div>
  );
}
