import type { Role } from "@lobby/db/schema";

export type NavIcon =
  | "home" | "apps" | "people" | "knowledge" | "help" | "journeys" | "queue" | "approvals" | "admin";

export interface NavItem {
  href: string;
  label: string;
  /** A shorter label for tight pill rows ("Queue" for "Help queue"). */
  short?: string;
  icon: NavIcon;
  /** Key into NavCounts, rendered as a count badge. */
  count?: keyof NavCounts;
  role?: Role;
  /** Extra path prefixes that keep this item highlighted. */
  match?: string[];
}

export interface NavCounts {
  myTasks: number;
  myOpenTickets: number;
  myApprovals: number;
  queueUnassigned: number;
}

/** The single navigation model. Every module's route appears here and nowhere else. */
export const NAV_SECTIONS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Home", icon: "home" },
      { href: "/apps", label: "Apps", icon: "apps" },
      { href: "/people", label: "People", icon: "people", match: ["/people", "/org-chart"] },
      { href: "/knowledge", label: "Knowledge", icon: "knowledge" },
      { href: "/help", label: "Help", icon: "help", count: "myOpenTickets" },
      { href: "/journeys", label: "Onboarding", icon: "journeys", count: "myTasks", match: ["/admin/journeys"] },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/approvals", label: "Approvals", icon: "approvals", count: "myApprovals" },
      { href: "/queue", label: "Help queue", short: "Queue", icon: "queue", role: "agent", count: "queueUnassigned" },
    ],
  },
  {
    label: "Manage",
    items: [{ href: "/admin", label: "Admin", icon: "admin", role: "admin", match: ["/admin/journeys"] }],
  },
];

export function isActive(pathname: string, item: NavItem): boolean {
  return matchLength(pathname, item) > 0;
}

/** Length of the longest prefix of `item` that matches the path (0 when none does). */
function matchLength(pathname: string, item: NavItem): number {
  const prefixes = [item.href, ...(item.match ?? [])];
  return Math.max(0, ...prefixes.map((p) => (p === "/" ? (pathname === "/" ? 1 : 0) : pathname === p || pathname.startsWith(`${p}/`) ? p.length : 0)));
}

/**
 * The ONE active destination among the items a person can see: the longest matching prefix wins,
 * and a tie goes to the later item. So /admin/journeys is Admin for an admin, and Onboarding for a
 * journey manager who has no Admin item. Use this, not isActive, to light a single pill.
 */
export function activeHref(pathname: string, items: NavItem[]): string | null {
  let best: NavItem | null = null;
  let len = 0;
  for (const item of items) {
    const n = matchLength(pathname, item);
    if (n > 0 && n >= len) {
      best = item;
      len = n;
    }
  }
  return best?.href ?? null;
}
