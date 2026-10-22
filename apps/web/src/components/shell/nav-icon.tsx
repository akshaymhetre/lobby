import {
  AppWindow, BookOpen, CheckCheck, Compass, House, Inbox, LifeBuoy, Settings2, Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon as NavIconName } from "@/lib/nav";

const ICONS: Record<NavIconName, LucideIcon> = {
  home: House,
  apps: AppWindow,
  people: Users,
  knowledge: BookOpen,
  help: LifeBuoy,
  journeys: Compass,
  approvals: CheckCheck,
  queue: Inbox,
  admin: Settings2,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden className={className} strokeWidth={1.75} />;
}
