"use client";

import * as React from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";
import { AvatarArt } from "./avatar-art";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizes: Record<AvatarSize, string> = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-caption",
  lg: "size-10 text-small",
  xl: "size-16 text-h4",
};

/** Two-letter initials: first and last word, ignoring punctuation. Kept for callers that label things by initials. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Stable tint 1..6 from the name, so a person keeps their colour everywhere (chips, tags). */
export function tintFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}

export interface AvatarProps extends React.ComponentProps<typeof AvatarPrimitive.Root> {
  name: string;
  src?: string | null;
  /** Seed for the generated art. Pass the person's id so a rename keeps their face; defaults to the name. */
  seed?: string | null;
  size?: AvatarSize;
  /** Optional presence dot. */
  status?: "online" | "away" | "busy" | null;
}

const statusClass = { online: "bg-success", away: "bg-warning", busy: "bg-danger" } as const;

/**
 * A person. With an uploaded photo it shows the photo; otherwise a generated, deterministic
 * illustrated avatar (see avatar-art.tsx), never grey initials.
 */
export function Avatar({ name, src, seed, size = "md", status, className, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn("relative inline-flex shrink-0 select-none", sizes[size], className)}
      {...props}
    >
      <span className="block size-full overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]">
        {src ? (
          <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />
        ) : null}
        <AvatarPrimitive.Fallback delayMs={src ? 300 : 0} className="flex size-full items-center justify-center">
          <AvatarArt seed={seed || name} className="size-full" />
          <span className="sr-only">{name}</span>
        </AvatarPrimitive.Fallback>
      </span>
      {status ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-surface",
            size === "xl" ? "size-3.5" : size === "lg" ? "size-2.5" : "size-2",
            statusClass[status],
          )}
          role="img"
          aria-label={status}
        />
      ) : null}
    </AvatarPrimitive.Root>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: { name: string; src?: string | null; seed?: string | null }[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className={cn("flex items-center -space-x-1.5", className)} aria-label={`${people.length} people`} role="group">
      {shown.map((p) => (
        <Avatar key={p.seed ?? p.name} name={p.name} seed={p.seed} src={p.src} size={size} className="rounded-full ring-2 ring-surface" />
      ))}
      {rest > 0 ? (
        <span
          className={cn(
            "relative inline-flex items-center justify-center rounded-full bg-raised font-medium text-muted shadow-cell ring-2 ring-surface",
            sizes[size],
          )}
        >
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
