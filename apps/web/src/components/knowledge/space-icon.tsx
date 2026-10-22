import { BookOpen, Building2, Code, Laptop, Lock, MapPin, Users, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = {
  "building-2": Building2,
  users: Users,
  laptop: Laptop,
  code: Code,
  wallet: Wallet,
  "map-pin": MapPin,
  lock: Lock,
  "book-open": BookOpen,
};

export const SPACE_ICON_KEYS = Object.keys(ICONS);

/**
 * A space's icon: a bare Lucide glyph in a quiet tone, never a tinted tile (the kernel's
 * composition rules). Unknown icon names fall back to a book.
 */
export function SpaceIcon({ name, size = "md", className }: { name: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = (name && ICONS[name]) || BookOpen;
  return (
    <Icon
      aria-hidden
      className={cn(
        "shrink-0 stroke-[1.5] text-muted",
        size === "sm" && "size-4",
        size === "md" && "size-[18px]",
        size === "lg" && "size-5",
        className,
      )}
    />
  );
}
