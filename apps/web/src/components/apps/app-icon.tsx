import { onColor } from "@lobby/core/apps/logic";
import { cn } from "@/lib/cn";

export type AppIconData =
  | { kind: "glyph"; path: string; /** null = follow the text colour */ color: string | null }
  | { kind: "monogram"; letters: string; color: string | null }
  | { kind: "image"; url: string };

const box = { sm: "size-7 rounded-[7px]", md: "size-10 rounded-cell", lg: "size-12 rounded-cell" } as const;
/* Brand glyphs sit bare (no tinted tile behind them), a touch larger than the monogram letters. */
const glyph = { sm: "size-[18px]", md: "size-6", lg: "size-7" } as const;
const text = { sm: "text-caption", md: "text-body", lg: "text-body-lg" } as const;

/**
 * A launcher app's icon: the real brand glyph, bare, or a monogram on a disc in the brand colour.
 * `onPlate` draws it for a coloured tile plate: the glyph and letters in the current text colour
 * (the plate's measured ink), with no disc of their own.
 */
export function AppIcon({
  icon,
  size = "md",
  onPlate = false,
  className,
}: {
  icon: AppIconData;
  size?: keyof typeof box;
  onPlate?: boolean;
  className?: string;
}) {
  if (onPlate && icon.kind !== "image") {
    return icon.kind === "glyph" ? (
      <svg viewBox="0 0 24 24" aria-hidden className={cn(glyph[size], className)} fill="currentColor" role="presentation">
        <path d={icon.path} />
      </svg>
    ) : (
      // On a plate the initial is set like a wordmark, a size up, so it reads as the app's mark and not a placeholder.
      <span aria-hidden className={cn("select-none font-semibold tracking-[-0.03em]", size === "sm" ? "text-body-lg" : size === "md" ? "text-h3" : "text-h2", className)}>
        {icon.letters}
      </span>
    );
  }
  if (icon.kind === "monogram") {
    const fill = icon.color;
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 select-none items-center justify-center font-semibold tracking-[-0.01em]",
          !fill && "bg-accent text-accent-fg",
          box[size],
          text[size],
          className,
        )}
        style={fill ? { backgroundColor: fill, color: onColor(fill) } : undefined}
      >
        {icon.letters}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        box[size],
        className,
      )}
    >
      {icon.kind === "glyph" ? (
        <svg
          viewBox="0 0 24 24"
          className={cn(glyph[size], !icon.color && "text-fg")}
          fill={icon.color ?? "currentColor"}
          role="presentation"
        >
          <path d={icon.path} />
        </svg>
      ) : (
        <img src={icon.url} alt="" className={cn(glyph[size], "object-contain")} />
      )}
    </span>
  );
}
