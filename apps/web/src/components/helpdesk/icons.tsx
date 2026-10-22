import {
  Armchair,
  Banknote,
  Building2,
  CalendarDays,
  DoorOpen,
  HeartHandshake,
  IdCard,
  KeyRound,
  Laptop,
  LifeBuoy,
  LockKeyhole,
  MessageCircleQuestion,
  Monitor,
  Package,
  PackageOpen,
  Receipt,
  Shield,
  UserPlus,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/** The icons admins can pick for teams and request types. Names are stored in the database. */
export const HELPDESK_ICONS: Record<string, LucideIcon> = {
  "life-buoy": LifeBuoy,
  monitor: Monitor,
  laptop: Laptop,
  "key-round": KeyRound,
  "lock-keyhole": LockKeyhole,
  shield: Shield,
  wrench: Wrench,
  package: Package,
  "package-open": PackageOpen,
  "user-plus": UserPlus,
  "heart-handshake": HeartHandshake,
  banknote: Banknote,
  "calendar-days": CalendarDays,
  "id-card": IdCard,
  "building-2": Building2,
  "door-open": DoorOpen,
  armchair: Armchair,
  receipt: Receipt,
  "message-circle-question": MessageCircleQuestion,
};

export const ICON_NAMES = Object.keys(HELPDESK_ICONS);

/**
 * A bare Lucide icon for a team or request type: 16px, 1.5px stroke, muted.
 * No tinted tile behind it (audit E1, kernel composition rules): the tile was the one element that read "template".
 */
export function HelpIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const Icon = (name && HELPDESK_ICONS[name]) || LifeBuoy;
  return <Icon className={cn("size-4 shrink-0 stroke-[1.5] text-muted", className)} aria-hidden />;
}

const DISC: Record<string, string> = {
  violet: "cat-violet",
  green: "cat-green",
  blue: "cat-blue",
  amber: "cat-amber",
  coral: "cat-coral",
  teal: "cat-teal",
};

/**
 * A team's icon on a filled disc in the team's category colour: the leading mark of a request
 * row, so a list of requests reads by team at a glance.
 */
export function ToneDisc({
  tone,
  name,
  size = "md",
  className,
}: {
  tone: "violet" | "green" | "blue" | "amber" | "coral" | "teal";
  name: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = (name && HELPDESK_ICONS[name]) || LifeBuoy;
  return (
    <span
      aria-hidden
      className={cn(
        DISC[tone],
        "inline-flex shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]",
        size === "sm" ? "size-8" : "size-10",
        className,
      )}
    >
      <Icon className={cn("stroke-[1.75]", size === "sm" ? "size-4" : "size-[18px]")} />
    </span>
  );
}
