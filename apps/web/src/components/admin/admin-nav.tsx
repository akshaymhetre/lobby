"use client";

import { usePathname } from "next/navigation";
import { PillNav, PillNavDivider, PillNavLink } from "@/components/ui/pill-nav";

type Item = { href: string; label: string; exact?: boolean };

const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Admin",
    items: [
      { href: "/admin", label: "Overview", exact: true },
      { href: "/admin/audit", label: "Audit log" },
    ],
  },
  {
    label: "Company",
    items: [
      { href: "/admin/branding", label: "Branding" },
      { href: "/admin/home", label: "Home page" },
      { href: "/admin/configuration", label: "Configuration" },
    ],
  },
  {
    label: "Access",
    items: [
      { href: "/admin/identity", label: "Identity & roles" },
      { href: "/admin/people", label: "People" },
      { href: "/admin/groups", label: "Groups" },
    ],
  },
  {
    label: "Modules",
    items: [
      { href: "/admin/apps", label: "Apps" },
      { href: "/admin/knowledge", label: "Knowledge" },
      { href: "/admin/helpdesk", label: "Helpdesk" },
      { href: "/admin/journeys", label: "Journeys" },
      { href: "/admin/ai", label: "AI assistant" },
    ],
  },
];

/**
 * Secondary admin navigation (wave 3): the same pill track as the top bar, as a second row under
 * it, so admin reads as a mode of the one slab rather than a second app with its own sidebar.
 * Groups are separated by a divider and named for assistive tech. `only` limits the items (journey
 * managers see one), `heading` names that single group, `badges` adds a count to an item.
 */
export function AdminNav({ only, heading, badges }: { only?: string[]; heading?: string; badges?: Record<string, { count: number; label: string }> }) {
  const pathname = usePathname();
  const active = (i: Item) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`));
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !only || only.includes(i.href)) })).filter((g) => g.items.length);

  return (
    <PillNav label="Admin" id="admin-nav" size="sm" level="secondary" trackClassName="w-fit max-w-full">
      {groups.map((g, gi) => (
        <span key={g.label} role="group" aria-label={groups.length === 1 && heading ? heading : g.label} className="contents">
          {gi > 0 ? <PillNavDivider /> : null}
          {g.items.map((i) => {
            const badge = badges?.[i.href];
            return (
              <PillNavLink key={i.href} href={i.href} active={active(i)} count={badge?.count} countTone="warning" countLabel={badge?.label} title={badge ? `${badge.count} ${badge.label}` : undefined}>
                {i.label}
              </PillNavLink>
            );
          })}
        </span>
      ))}
    </PillNav>
  );
}
