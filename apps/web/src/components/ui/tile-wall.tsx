import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * TileWall and Tile (wave 3, problem 1): a wall of brand-coloured tiles with press depth, for the
 * app catalogue and the help catalogue, instead of grouped lists.
 *
 *   <TileWall label="Engineering" min="148px">
 *     <Tile href="/go/grafana" color="#F46800" icon={<AppIcon … />} label="Grafana" meta="Dashboards" />
 *   </TileWall>
 *
 *   <TileWall min="220px">                         // big filled tiles: the whole tile is the colour
 *     <Tile fill color="#0f7f86" icon={<Laptop />} label="IT" meta="12 request types" href="/help/it" />
 *   </TileWall>
 *
 * - `color` is the brand (or category) colour, any CSS hex. A plain tile is a raised cell with the
 *   colour as a glossy icon plate; `fill` paints the whole tile in it, with text set to white or a
 *   dark ink by measured luminance, so any brand colour stays AA.
 * - Press depth: the tile sinks 2px with an inner shadow while pressed, and lifts with a deeper
 *   coloured shadow on hover. Reduced motion keeps the shadow change and drops the travel.
 * - `badge` sits top-right (a count, "Pinned", "New"). `children` go under the label.
 * - Each Tile is an <li> in the wall's <ul>; give the wall a `label` to name the group for
 *   assistive tech (it renders as the list's aria-label, not visible text).
 */
export function TileWall({
  min = "148px",
  label,
  className,
  children,
}: {
  /** Minimum tile width; columns auto-fill. */
  min?: string;
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ul
      aria-label={label}
      className={cn("grid gap-3", className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))` }}
    >
      {children}
    </ul>
  );
}

export interface TileProps {
  label: React.ReactNode;
  meta?: React.ReactNode;
  /** Brand colour as a hex (#RRGGBB or #RGB). */
  color: string;
  /** The app's glyph or a Lucide icon. On a plain tile it sits on the colour plate. */
  icon?: React.ReactNode;
  /** Paint the whole tile in the colour (category tiles). */
  fill?: boolean;
  badge?: React.ReactNode;
  href?: string;
  /** Open in a new tab (an external app). */
  external?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  "aria-label"?: string;
  className?: string;
  children?: React.ReactNode;
}

/** Relative luminance of a hex colour (WCAG). */
function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

/** White or a dark ink, whichever reaches the higher contrast on the colour. */
export function inkOn(hex: string): string {
  const L = luminance(hex);
  if (L === null) return "#ffffff";
  const white = 1.05 / (L + 0.05);
  const ink = (L + 0.05) / (0.0102 + 0.05); // #141a26, L = 0.0102
  return white >= ink ? "#ffffff" : "#141a26";
}

export function Tile({ label, meta, color, icon, fill = false, badge, href, external, onClick, className, children, ...aria }: TileProps) {
  const ink = inkOn(color);
  const style = {
    "--tile": color,
    "--tile-ink": ink,
    // A darker stop under the colour for a gloss-free vertical gradient that keeps the ink's contrast.
    // White text: the lower stop darkens (contrast only rises). Dark ink: it lightens instead.
    "--tile-deep": ink === "#ffffff" ? `color-mix(in oklch, ${color} 86%, black)` : `color-mix(in oklch, ${color} 88%, white)`,
  } as React.CSSProperties;
  const interactive = !!(href || onClick);
  const cls = cn(
    "group/tile relative isolate flex h-full w-full flex-col text-left outline-none",
    "rounded-panel transition-[transform,box-shadow,filter] duration-160 ease-standard",
    fill
      ? "min-h-[148px] gap-3 p-5 text-[var(--tile-ink)] [background:linear-gradient(180deg,var(--tile),var(--tile-deep))] shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_12px_26px_-14px_var(--tile)]"
      : "cell min-h-[132px] items-start gap-3 p-4",
    interactive && "focus-ring cursor-pointer",
    interactive && (fill
      ? "hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_18px_34px_-14px_var(--tile)] active:translate-y-0.5 active:shadow-[inset_0_2px_6px_rgb(0_0_0/0.25)]"
      : "hover:-translate-y-0.5 hover:shadow-cell-hover active:translate-y-0.5 active:shadow-[var(--lb-shadow-inset)]"),
    "motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0",
    className,
  );
  const plate = icon ? (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center [&>svg]:stroke-[1.75]",
        fill
          ? cn("size-12 rounded-full ring-1 [&>svg]:size-6", ink === "#ffffff" ? "bg-black/15 ring-white/25" : "bg-white/45 ring-white/60")
          : "size-14 rounded-[18px] text-[var(--tile-ink)] [background:linear-gradient(180deg,var(--tile),var(--tile-deep))] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_16px_-8px_var(--tile)] transition-transform duration-160 group-active/tile:scale-95 [&>svg]:size-7",
      )}
    >
      {icon}
    </span>
  ) : null;
  const inner = (
    <>
      {badge ? <span className="absolute right-3 top-3">{badge}</span> : null}
      {plate}
      <span className="mt-auto flex min-w-0 flex-col gap-0.5">
        <span className={cn("truncate font-medium", fill ? "text-h4" : "text-row text-fg")}>{label}</span>
        {meta ? <span className={cn("line-clamp-2 text-caption", fill ? "" : "text-muted")}>{meta}</span> : null}
      </span>
      {children ? <span className="block min-w-0">{children}</span> : null}
    </>
  );
  return (
    <li className="min-w-0 list-none">
      {href ? (
        <Link href={href} className={cls} style={style} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} {...aria}>
          {inner}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls} style={style} {...aria}>
          {inner}
        </button>
      ) : (
        <div className={cls} style={style}>
          {inner}
        </div>
      )}
    </li>
  );
}
