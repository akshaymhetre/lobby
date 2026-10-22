"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { LayoutGroup, SlidingPill } from "./motion";

/**
 * PillNav: the ONE navigation material in Lobby (wave 3). The main top bar, the admin sub-row, the
 * setup steps and the in-page section switcher all use it, so "where am I" always looks the same:
 * a sunken track, and the active destination as a raised white pill (dark: a lit glass pill) that
 * slides between items.
 *
 *   <PillNav label="Admin" id="admin-nav">
 *     <PillNavLink href="/admin" active>Overview</PillNavLink>
 *     <PillNavDivider />
 *     <PillNavLink href="/admin/knowledge" count={2} countTone="warning" countLabel="stale pages">Knowledge</PillNavLink>
 *   </PillNav>
 *
 * - `label` is the nav's accessible name (rendered as <nav aria-label>). Pass `as="div"` to render
 *   the track inside a nav you already own.
 * - `size`: `md` (40px pills, the top bar) or `sm` (36px, sub-rows and switchers).
 * - The track scrolls horizontally when it overflows, keeps the active pill in view, and fades
 *   its edges only while there is more to scroll.
 */
type Ctx = { id: string; size: "sm" | "md"; level: "primary" | "secondary" };
const PillNavContext = React.createContext<Ctx>({ id: "pill-nav", size: "md", level: "primary" });

export interface PillNavProps extends Omit<React.ComponentPropsWithoutRef<"nav">, "children"> {
  /** Accessible name of the navigation landmark. */
  label: string;
  /** Unique id for the sliding pill (one per nav on the page). */
  id: string;
  size?: "sm" | "md";
  /**
   * `primary` (default): sunken track, raised white active pill. `secondary`: a row that belongs to
   * a lit parent (the admin row under "Work"): no track, and the active item is a tinted accent pill
   * with no shadow, so parent and child never read at the same weight.
   */
  level?: "primary" | "secondary";
  /** Render as a plain div (no landmark), e.g. inside a nav you already own. */
  as?: "nav" | "div";
  /** Classes for the inner track (the sunken pill row). */
  trackClassName?: string;
  children: React.ReactNode;
}

export function PillNav({ label, id, size = "md", level = "primary", as = "nav", className, trackClassName, children, ...props }: PillNavProps) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: false, end: false });
  const lastActive = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const sync = () => {
      const start = el.scrollLeft > 2;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      // Bail out when nothing changed: this effect runs after every render, so a fresh object here loops.
      setEdges((p) => (p.start === start && p.end === end ? p : { start, end }));
    };
    sync();
    // Keep the active item in view on load and on route change.
    const active = el.querySelector<HTMLElement>('[aria-current="page"], [aria-current="step"], [aria-current="location"], [data-active="true"]');
    if (active && active !== lastActive.current && el.scrollWidth > el.clientWidth) {
      lastActive.current = active;
      // Measure against the scroller itself (offsetLeft is relative to the nearest positioned ancestor, not the track).
      const a = active.getBoundingClientRect();
      const t = el.getBoundingClientRect();
      const left = el.scrollLeft + (a.left - t.left) - el.clientWidth / 2 + a.width / 2;
      el.scrollTo({ left: Math.max(0, left) });
    }
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  });

  const mask =
    edges.start || edges.end
      ? `linear-gradient(90deg, ${edges.start ? "transparent 0, #000 28px" : "#000 0"}, ${edges.end ? "#000 calc(100% - 28px), transparent 100%" : "#000 100%"})`
      : undefined;

  const Root = as;
  return (
    <Root {...(as === "nav" ? { "aria-label": label } : {})} className={cn("min-w-0", className)} {...props}>
      <PillNavContext.Provider value={{ id, size, level }}>
        <LayoutGroup id={id}>
          <div
            ref={scroller}
            className={cn(
              "flex min-w-0 items-center gap-1 overflow-x-auto rounded-full [scrollbar-width:none]",
              level === "primary"
                ? "bg-sunken/70 p-1 shadow-[inset_0_1px_2px_rgb(20_30_50/0.06)] dark:bg-sunken/80 dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.4)]"
                : "py-1",
              trackClassName,
            )}
            style={mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined}
          >
            {children}
          </div>
        </LayoutGroup>
      </PillNavContext.Provider>
    </Root>
  );
}

export interface PillNavLinkProps extends Omit<React.ComponentProps<typeof Link>, "children"> {
  active?: boolean;
  /** A Lucide icon element, rendered at 18px (16px in `sm`). */
  icon?: React.ReactNode;
  /** A count badge after the label. 0 or undefined hides it. */
  count?: number;
  /** `accent` (default) for "for you", `warning` for something going stale, `quiet` for a plain total. */
  countTone?: "accent" | "warning" | "quiet";
  /** Spoken after the count ("2 stale pages"); defaults to "items". */
  countLabel?: string;
  /** Hide the visible label below this breakpoint (the label stays for screen readers). */
  labelFrom?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** aria-current value when active. */
  current?: "page" | "step" | "location";
  children: React.ReactNode;
}

const LABEL_FROM = {
  sm: ["hidden sm:inline", "sr-only sm:hidden"],
  md: ["hidden md:inline", "sr-only md:hidden"],
  lg: ["hidden lg:inline", "sr-only lg:hidden"],
  xl: ["hidden xl:inline", "sr-only xl:hidden"],
  "2xl": ["hidden 2xl:inline", "sr-only 2xl:hidden"],
} as const;

/** One destination in a PillNav. */
export const PillNavLink = React.forwardRef<HTMLAnchorElement, PillNavLinkProps>(function PillNavLink(
  { active = false, icon, count, countTone = "accent", countLabel = "items", labelFrom, current = "page", className, children, ...props },
  ref,
) {
  const { id, size, level } = React.useContext(PillNavContext);
  return (
    <Link
      ref={ref}
      aria-current={active ? current : undefined}
      data-active={active || undefined}
      className={cn(pillItemClass(size, active, level), className)}
      {...props}
    >
      <PillInner id={id} size={size} level={level} active={active} icon={icon} count={count} countTone={countTone} countLabel={countLabel} labelFrom={labelFrom}>
        {children}
      </PillInner>
    </Link>
  );
});

export interface PillNavButtonProps extends React.ComponentProps<"button"> {
  active?: boolean;
  icon?: React.ReactNode;
  count?: number;
  countTone?: "accent" | "warning" | "quiet";
  countLabel?: string;
  labelFrom?: PillNavLinkProps["labelFrom"];
}

/** A pill that opens something (a menu of more destinations) rather than navigating. */
export const PillNavButton = React.forwardRef<HTMLButtonElement, PillNavButtonProps>(function PillNavButton(
  { active = false, icon, count, countTone = "accent", countLabel = "items", labelFrom, className, children, type = "button", ...props },
  ref,
) {
  const { id, size, level } = React.useContext(PillNavContext);
  return (
    <button ref={ref} type={type} data-active={active || undefined} className={cn(pillItemClass(size, active, level), "data-[state=open]:text-fg", className)} {...props}>
      <PillInner id={id} size={size} level={level} active={active} icon={icon} count={count} countTone={countTone} countLabel={countLabel} labelFrom={labelFrom}>
        {children}
      </PillInner>
    </button>
  );
});

function pillItemClass(size: "sm" | "md", active: boolean, level: "primary" | "secondary" = "primary") {
  return cn(
    "focus-ring touch-target relative isolate inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-medium transition-colors duration-160",
    size === "md" ? "h-10 gap-2 px-3.5 text-body" : "h-9 gap-1.5 px-3 text-small",
    active ? (level === "primary" ? "text-fg" : "text-accent-text") : "text-muted hover:bg-hover hover:text-fg",
  );
}

function PillInner({
  id,
  size,
  level,
  active,
  icon,
  count,
  countTone,
  countLabel,
  labelFrom,
  children,
}: {
  id: string;
  size: "sm" | "md";
  level: "primary" | "secondary";
  active: boolean;
  icon?: React.ReactNode;
  count?: number;
  countTone: "accent" | "warning" | "quiet";
  countLabel: string;
  labelFrom?: PillNavLinkProps["labelFrom"];
  children: React.ReactNode;
}) {
  const [shown, hidden] = labelFrom ? LABEL_FROM[labelFrom] : [undefined, undefined];
  return (
    <>
      {active ? <SlidingPill layoutId={`${id}-pill`} className={level === "primary" ? "pill-active rounded-full" : "rounded-full bg-accent-soft"} /> : null}
      {icon ? (
        <span aria-hidden className={cn("inline-flex shrink-0 [&>svg]:stroke-[1.75]", size === "md" ? "[&>svg]:size-[18px]" : "[&>svg]:size-4", active ? "text-accent-text" : "text-subtle")}>
          {icon}
        </span>
      ) : null}
      {labelFrom ? (
        <>
          <span className={shown}>{children}</span>
          <span className={hidden}>{children}</span>
        </>
      ) : (
        <span>{children}</span>
      )}
      {count ? <PillCount n={count} tone={countTone} label={countLabel} /> : null}
    </>
  );
}

/** The count badge used in every pill: 20px tall, 13px tabular figures. */
export function PillCount({ n, tone = "accent", label = "items", className }: { n: number; tone?: "accent" | "warning" | "quiet"; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption font-semibold leading-none tabular-nums",
        tone === "accent" && "bg-accent text-accent-fg",
        tone === "warning" && "bg-warning-soft text-warning-text",
        tone === "quiet" && "bg-raised text-muted shadow-highlight",
        className,
      )}
    >
      {n > 99 ? "99+" : n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

/** A thin divider between groups in a PillNav. */
export function PillNavDivider({ className }: { className?: string }) {
  return <span aria-hidden className={cn("mx-1 h-5 w-px shrink-0 bg-border-strong", className)} />;
}
