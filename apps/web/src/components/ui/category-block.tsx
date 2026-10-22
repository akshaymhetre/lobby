import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * CategoryBlock (wave 3, problem 6): an item WITH a category shown as a filled category block, the
 * Home planner's gradient language, instead of a 6px dot or a pastel chip. A vertical gradient in
 * the category colour, a frosted icon disc on the left, a title, and a white status pill.
 *
 *   <CategoryBlock tone="blue" icon={<LifeBuoy />} title="New laptop" status="In approval" />
 *   <CategoryBlock tone="violet" size="lg" icon={<Compass />} title="Your first week" subtitle="4 of 10 steps"
 *     status={{ label: "Up next", dot: true }}><CategoryChip tone="violet" href="…">…</CategoryChip></CategoryBlock>
 *
 * A block with `href` must not hold linked chips (no link inside a link): link the chips and leave the block static, or the reverse.
 *
 * Tones are the category colours, so they mean something: violet onboarding step, green first day
 * or done, blue request or approval under SLA, amber deadline / due, coral payday or breaching,
 * teal working / in progress. Every tone's text clears AA on both gradient stops in both themes
 * (white on violet, green, blue, coral and teal; dark ink on amber), and the status pill's text
 * is the tone's deep stop on white.
 *
 * Sizes: `sm` 44px, one line (a planner cell, a due cell in a row); `md` (default) 64px with a
 * subtitle; `lg` a tile of 132px and up with room for children (a catalogue category with its top
 * requests as chips). Interactive with `href` or `onClick`: press depth and a deeper coloured shadow.
 */
export type CategoryTone = "violet" | "green" | "blue" | "amber" | "coral" | "teal";

export interface CategoryBlockProps {
  tone: CategoryTone;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** A string, or { label, dot } for the reference's "• Approved" pill. */
  status?: React.ReactNode | { label: React.ReactNode; dot?: boolean };
  size?: "sm" | "md" | "lg";
  href?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  "aria-label"?: string;
  className?: string;
  children?: React.ReactNode;
}

/** The deep stop of each tone: status pill text on white, and the coloured shadow. */
const INK: Record<CategoryTone, string> = {
  violet: "var(--lb-cat-violet-to)",
  green: "var(--lb-cat-green-to)",
  blue: "var(--lb-cat-blue-to)",
  amber: "var(--lb-cat-amber-on)",
  coral: "var(--lb-cat-coral-to)",
  teal: "var(--lb-cat-teal-to)",
};
/* Literal class names: Tailwind only generates utilities it can see written out in full. */
const FILL: Record<CategoryTone, string> = {
  violet: "cat-violet",
  green: "cat-green",
  blue: "cat-blue",
  amber: "cat-amber",
  coral: "cat-coral",
  teal: "cat-teal",
};
const GLOW: Record<CategoryTone, string> = {
  violet: "var(--lb-cat-violet-from)",
  green: "var(--lb-cat-green-from)",
  blue: "var(--lb-cat-blue-from)",
  amber: "var(--lb-cat-amber-to)",
  coral: "var(--lb-cat-coral-from)",
  teal: "var(--lb-cat-teal-from)",
};

function isStatusObject(s: CategoryBlockProps["status"]): s is { label: React.ReactNode; dot?: boolean } {
  return typeof s === "object" && s !== null && !React.isValidElement(s) && "label" in (s as object);
}

export function CategoryBlock({ tone, title, subtitle, icon, status, size = "md", href, onClick, className, children, ...aria }: CategoryBlockProps) {
  const amber = tone === "amber";
  const interactive = !!(href || onClick);
  const st = status == null ? null : isStatusObject(status) ? status : { label: status, dot: false };
  const style = { "--cb-ink": INK[tone], "--cb-glow": GLOW[tone] } as React.CSSProperties;
  const cls = cn(
    FILL[tone],
    "group/cb relative isolate flex w-full overflow-hidden text-left",
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.32),0_10px_22px_-12px_var(--cb-glow)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_12px_32px_-12px_var(--cb-glow),0_0_28px_-10px_var(--cb-glow)]",
    size === "sm" && "min-h-11 items-center gap-2.5 rounded-cell py-1.5 pl-1.5 pr-2",
    size === "md" && "min-h-16 min-w-[200px] items-center gap-3 rounded-card p-2.5 pr-3",
    size === "lg" && "min-h-[132px] flex-col gap-4 rounded-panel p-5",
    interactive && "focus-ring press transition-[transform,box-shadow,filter] duration-160 hover:brightness-[1.04] active:brightness-[0.97]",
    className,
  );
  const disc = icon ? (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full ring-1 backdrop-blur-sm [&>svg]:stroke-[1.75]",
        amber ? "bg-white/45 ring-white/60" : "bg-white/20 ring-white/30",
        size === "sm" ? "size-8 [&>svg]:size-4" : size === "md" ? "size-11 [&>svg]:size-5" : "size-12 [&>svg]:size-6",
      )}
    >
      {icon}
    </span>
  ) : null;
  const pill = st ? (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-2.5 text-caption font-medium shadow-[0_1px_2px_rgb(0_0_0/0.12)]" style={{ color: "var(--cb-ink)" }}>
      {st.dot ? <span aria-hidden className="size-1.5 rounded-full" style={{ background: "var(--cb-ink)" }} /> : null}
      {st.label}
    </span>
  ) : null;
  const text = (
    <span className="flex min-w-0 flex-1 flex-col">
      {/* md and lg titles wrap to two lines rather than truncate; sm is a one-line planner cell. */}
      <span className={cn("font-medium", size === "lg" ? "line-clamp-2 text-h3" : size === "md" ? "line-clamp-2 text-row leading-[20px]" : "truncate text-body")}>{title}</span>
      {subtitle && size !== "sm" ? <span className="line-clamp-1 text-caption">{subtitle}</span> : null}
    </span>
  );
  const inner =
    size === "lg" ? (
      <>
        {/* A soft sheen from the top-left: the reference's glossy block. */}
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_0%_0%,rgb(255_255_255/0.22),transparent_55%)]" />
        <span className="flex items-start justify-between gap-3">
          {disc}
          {pill}
        </span>
        {text}
        {children ? <span className="block min-w-0">{children}</span> : null}
      </>
    ) : (
      <>
        {disc}
        {text}
        {children}
        {pill}
      </>
    );
  if (href)
    return (
      <Link href={href} className={cls} style={style} {...aria}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls} style={style} {...aria}>
        {inner}
      </button>
    );
  return (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}

/** A chip that sits ON a category block (frosted, inherits the block's text colour). For a catalogue tile's top requests. */
export function CategoryChip({ children, href, tone, className }: { children: React.ReactNode; href?: string; tone?: CategoryTone; className?: string }) {
  // A DARKENING frost (not a white one) keeps white text above 4.5:1 on every gradient; amber's
  // dark ink needs the opposite, a lighter frost. Pass the block's tone so the chip knows which.
  const cls = cn(
    "inline-flex h-8 max-w-full items-center truncate rounded-full px-3 text-small font-medium ring-1 backdrop-blur-sm",
    tone === "amber" ? "bg-white/40 ring-white/55" : "bg-black/15 ring-white/25",
    href && "focus-ring press relative z-10",
    href && (tone === "amber" ? "hover:bg-white/55" : "hover:bg-black/25"),
    className,
  );
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}
