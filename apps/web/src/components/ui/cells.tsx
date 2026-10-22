"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * CellList and RowCell (wave 3, problem 1): a list of like things as SEPARATE raised cells, the
 * reference's tactile row, instead of hairline-divided rows inside one flat card.
 * Each cell is a white (dark: lit teal) surface with a 1px top highlight and a soft shadow, 12px
 * apart. Hairline tables stay only for true data grids (Queue, Audit, Content health).
 *
 *   <CellList>
 *     <RowCell
 *       href={`/people/${p.id}`}
 *       leading={<Avatar seed={p.id} name={p.name} size="lg" />}
 *       title={p.name}
 *       meta={p.title}
 *       trailing={<Badge tone="cat-green">Starts Monday</Badge>}
 *     />
 *   </CellList>
 *
 * - `density`: `comfortable` (default, 64px cells, 12px gap) or `compact` (52px cells, 8px gap) for
 *   a rail or a dense group. Set it on CellList; a RowCell can override.
 * - A RowCell with `href` or `onClick` is interactive: hover lift with a deeper shadow, the press
 *   response, a visible focus ring. Without either it is static.
 * - `title` is primary row text (15px, `text-row`); `meta` is 13px muted. Pass a node to `meta` to
 *   break a long dotted string into an avatar, a time and a chip rather than "A · B · C".
 * - `selected` marks the current row (an accent ring), for master-detail lists.
 * - Inside a CellList a RowCell is an <li>; outside one it is a <div>.
 */
type Density = "comfortable" | "compact";
const ListCtx = React.createContext<{ inList: boolean; density: Density }>({ inList: false, density: "comfortable" });

export interface CellListProps extends React.ComponentProps<"ul"> {
  density?: Density;
  /** `list` stacks cells (default); `grid` lays them out in auto-fill columns of at least `min`. */
  layout?: "list" | "grid";
  /** Minimum column width for `layout="grid"`. */
  min?: string;
}

export function CellList({ density = "comfortable", layout = "list", min = "280px", className, style, children, ...props }: CellListProps) {
  return (
    <ListCtx.Provider value={{ inList: true, density }}>
      <ul
        className={cn(
          layout === "grid" ? "grid" : "flex flex-col",
          density === "compact" ? "gap-2" : "gap-3",
          className,
        )}
        style={layout === "grid" ? { gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))`, ...style } : style}
        {...props}
      >
        {children}
      </ul>
    </ListCtx.Provider>
  );
}

export interface RowCellProps {
  title: React.ReactNode;
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Extra content under the title row (chips, a progress bar). */
  children?: React.ReactNode;
  href?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  selected?: boolean;
  density?: Density;
  /** Show a chevron at the end of an interactive cell. Default true when `href` is set. */
  chevron?: boolean;
  /** Accessible name override for the link or button (defaults to its text). */
  "aria-label"?: string;
  className?: string;
  /** Classes for the outer <li>/<div> (grid placement and the like). */
  wrapperClassName?: string;
}

export function RowCell({
  title,
  meta,
  leading,
  trailing,
  children,
  href,
  onClick,
  selected = false,
  density,
  chevron,
  className,
  wrapperClassName,
  ...aria
}: RowCellProps) {
  const ctx = React.useContext(ListCtx);
  const d = density ?? ctx.density;
  const interactive = !!(href || onClick);
  const showChevron = chevron ?? !!href;
  const cls = cn(
    "cell group/cell relative flex w-full items-center rounded-card text-left",
    d === "compact" ? "min-h-[52px] gap-3 px-3.5 py-2" : "min-h-16 gap-3.5 px-4 py-3",
    interactive && "focus-ring press hover:shadow-cell-hover",
    selected && "shadow-[var(--lb-shadow-cell),0_0_0_2px_var(--lb-accent-ring)]",
    className,
  );
  const inner = (
    <>
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-row font-medium text-fg">{title}</span>
        {meta ? <span className="flex min-w-0 items-center gap-2 text-caption text-muted">{meta}</span> : null}
        {children ? <span className="mt-1.5 block min-w-0">{children}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
      {interactive && showChevron ? (
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-subtle transition-[color,transform] duration-160 group-hover/cell:translate-x-0.5 group-hover/cell:text-fg">
          <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </>
  );
  const body = href ? (
    <Link href={href} className={cls} aria-current={selected ? "true" : undefined} {...aria}>
      {inner}
    </Link>
  ) : onClick ? (
    <button type="button" onClick={onClick} className={cls} aria-pressed={selected || undefined} {...aria}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
  return ctx.inList ? <li className={cn("min-w-0 list-none", wrapperClassName)}>{body}</li> : <div className={cn("min-w-0", wrapperClassName)}>{body}</div>;
}

/**
 * A meta line that separates real values with space and a little weight instead of middle dots:
 * <CellMeta items={[<Avatar .../>, "Fatima Zahra", <time>3 days ago</time>]} />
 */
export function CellMeta({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {items.filter(Boolean).map((it, i) => (
        <span key={i} className="inline-flex min-w-0 items-center gap-1.5 truncate">
          {it}
        </span>
      ))}
    </span>
  );
}
