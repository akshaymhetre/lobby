"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useTheme } from "@/components/theme";
import { Briefcase, ChevronDown, Keyboard, LogOut, Menu, Moon, Search, Sparkles, Sun, UserRound } from "lucide-react";
import type { Role } from "@lobby/db/schema";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdCombo } from "@/components/ui/kbd";
import { PillCount, PillNav, PillNavButton, PillNavDivider, PillNavLink } from "@/components/ui/pill-nav";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/cn";
import { activeHref, NAV_SECTIONS, type NavCounts, type NavItem } from "@/lib/nav";
import { NavIcon } from "./nav-icon";
import { NotificationsBell } from "./notifications";
import { openAssistant, openCommandPalette } from "./shell-events";

export interface ShellProps {
  org: { companyName: string; productName: string; logoUrl: string | null };
  user: { id: string; name: string; email: string; title: string | null; avatarUrl: string | null };
  roles: Role[];
  counts: NavCounts;
  unread: number;
  aiEnabled: boolean;
  children: React.ReactNode;
}

/** The six primary destinations ride the top bar as pills; the work and manage items follow after a divider. */
const PRIMARY = NAV_SECTIONS[0]!.items;
const WORK = NAV_SECTIONS.slice(1).flatMap((s) => s.items);
/** The phone dock: five destinations within thumb reach. Everything else is in the menu sheet. */
const DOCK = ["/", "/apps", "/people", "/help", "/journeys"];

/**
 * The application shell, v2: one floating rounded slab on a cool canvas. Inside it, a top bar with
 * the brand mark, pill navigation (the active pill is raised and slides), the search disc, the
 * assistant pill, the bell and the account menu. On phones the pills fold into a menu sheet and a
 * floating bottom dock.
 */
export function AppShell({ org, user, roles, counts, unread, aiEnabled, children }: ShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  const visible = (items: NavItem[]) => items.filter((item) => !item.role || roles.includes(item.role));
  const primary = visible(PRIMARY);
  const work = visible(WORK);
  const countOf = (item: NavItem) => (item.count ? counts[item.count] : 0);
  // Exactly one destination is lit, wherever it lives (the main pills, the Work pill, the dock).
  const current = activeHref(pathname, [...primary, ...work]);
  const isActive = (_p: string, item: NavItem) => item.href === current;

  return (
    <div className="min-h-dvh md:p-3 lg:p-4">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-raised focus:px-4 focus:py-2 focus:shadow-popover">
        Skip to content
      </a>

      <div className="slab relative mx-auto flex min-h-dvh w-full max-w-[1680px] bg-page md:min-h-[calc(100dvh-1.5rem)] md:rounded-slab md:shadow-slab lg:min-h-[calc(100dvh-2rem)]">
        {/* Mobile menu: every destination as rows, the account menu at its foot so sign-out is reachable on a phone. */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[300px] p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="flex h-16 items-center gap-3 px-5">
              <BrandMark name={org.companyName} logoUrl={org.logoUrl} size={28} />
              <span className="truncate text-body font-medium">{org.companyName}</span>
            </div>
            <nav aria-label="Menu" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              <ul className="flex flex-col gap-0.5">
                {[...primary, ...work].map((item, i) => {
                  const active = isActive(pathname, item);
                  const n = countOf(item);
                  return (
                    <li key={item.href}>
                      {i === primary.length ? <p className="px-4 pb-1 pt-4 text-small font-medium text-subtle">Your work</p> : null}
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "focus-ring flex h-11 items-center gap-3 rounded-full px-4 text-row transition-colors duration-160",
                          active ? "pill-active font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
                        )}
                      >
                        <NavIcon name={item.icon} className={cn("size-[18px] shrink-0", active && "text-accent-text")} />
                        <span className="truncate">{item.label}</span>
                        {n > 0 ? <PillCount n={n} className="ml-auto" /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <UserMenu user={user} showName onShortcuts={() => setShortcutsOpen(true)} />
              <ThemeToggle />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-2 px-3 sm:px-4 md:gap-3 md:px-5">
            <Button variant="secondary" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
              <Menu />
            </Button>
            <Link
              href="/"
              className="focus-ring press inline-flex size-10 shrink-0 items-center justify-center rounded-full md:bg-raised md:shadow-cell"
              aria-label={`${org.companyName} home`}
            >
              <BrandMark name={org.companyName} logoUrl={org.logoUrl} size={28} />
            </Link>

            {/* One navigation model: the six destinations and the "Work" group share one pill track.
                The active destination is the raised pill, wherever it lives. */}
            <PillNav label="Main" id="main-nav" className="hidden md:block">
              {primary.map((item) => (
                <PillNavLink
                  key={item.href}
                  href={item.href}
                  active={isActive(pathname, item)}
                  icon={<NavIcon name={item.icon} />}
                  count={countOf(item)}
                  labelFrom="lg"
                >
                  {item.label}
                </PillNavLink>
              ))}
              {work.length ? <PillNavDivider /> : null}
              {/* Approvals, the Help queue and Admin live behind ONE labelled "Work" pill for every
                  role, with their total as its count. One destination: the pill links straight to it. */}
              {work.length ? <WorkMenu items={work} current={current} countOf={countOf} /> : null}
            </PillNav>

            <Tooltip label="Search" shortcut="⌘K">
              <button
                type="button"
                onClick={() => openCommandPalette()}
                aria-label="Search people, pages and apps"
                className="focus-ring touch-target press inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-raised text-fg shadow-cell hover:shadow-cell-hover"
              >
                <Search aria-hidden className="size-[18px]" strokeWidth={1.75} />
              </button>
            </Tooltip>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {aiEnabled && (
                <Button variant="primary" size="md" onClick={() => openAssistant()} className="gap-2" aria-label="Ask the assistant">
                  <Sparkles aria-hidden />
                  <span className="hidden sm:inline">Ask</span>
                </Button>
              )}
              <NotificationsBell initialUnread={unread} />
              <UserMenu user={user} onShortcuts={() => setShortcutsOpen(true)} />
            </div>
          </header>
          <main id="main" className="flex-1 pb-24 md:pb-0">
            {children}
          </main>
        </div>
      </div>

      {/* Phone dock: five destinations plus Work within thumb reach, floating over the page. */}
      <nav
        aria-label="Quick navigation"
        className="fixed inset-x-3 bottom-3 z-30 flex h-16 items-center justify-around rounded-full glass px-2 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {DOCK.map((href) => primary.find((i) => i.href === href))
          .filter((i): i is NavItem => !!i)
          .map((item) => {
            const active = isActive(pathname, item);
            const n = countOf(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={n > 0 ? `${item.label} (${n})` : item.label}
                className={cn(
                  "focus-ring relative inline-flex size-12 items-center justify-center rounded-full transition-colors duration-160",
                  active ? "cell text-accent-text" : "text-muted",
                )}
              >
                <NavIcon name={item.icon} className="size-[22px]" />
                {n > 0 ? <span className="absolute right-2 top-2 size-2 rounded-full bg-accent ring-2 ring-raised" aria-hidden /> : null}
              </Link>
            );
          })}
        {/* Work: the same "Your work" group as the desktop pill. It opens the menu sheet, and it is
            the lit slot whenever you are on a work page, so the dock always says where you are. */}
        {work.length ? (
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={`Work${work.reduce((n, i) => n + countOf(i), 0) ? ` (${work.reduce((n, i) => n + countOf(i), 0)})` : ""}`}
            aria-current={work.some((i) => i.href === current) ? "page" : undefined}
            className={cn(
              "focus-ring relative inline-flex size-12 items-center justify-center rounded-full transition-colors duration-160",
              work.some((i) => i.href === current) ? "cell text-accent-text" : "text-muted",
            )}
          >
            <Briefcase aria-hidden className="size-[22px] stroke-[1.75]" />
            {work.some((i) => countOf(i) > 0) ? <span className="absolute right-2 top-2 size-2 rounded-full bg-accent ring-2 ring-raised" aria-hidden /> : null}
          </button>
        ) : null}
      </nav>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} aiEnabled={aiEnabled} />
    </div>
  );
}

/**
 * The "Work" pill (always a menu, for every role, so the same control behaves the same everywhere): one labelled pill holding Approvals, the Help queue and Admin, with
 * their total as its count. When a work page is open the pill is the active one and names it.
 */
function WorkMenu({ items, current, countOf }: { items: NavItem[]; current: string | null; countOf: (i: NavItem) => number }) {
  const here = items.find((i) => i.href === current);
  const total = items.reduce((n, i) => n + countOf(i), 0);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PillNavButton
          active={!!here}
          icon={<Briefcase />}
          count={total}
          countLabel="waiting on you"
          aria-label={here ? `Work, now on ${here.label}` : "Work"}
        >
          <span className="inline-flex items-center gap-1">
            <span className="hidden lg:inline">Work</span>
            <span className="sr-only lg:hidden">Work</span>
            <ChevronDown aria-hidden className="size-3.5 stroke-[2] text-subtle" />
          </span>
        </PillNavButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your work</DropdownMenuLabel>
        {items.map((item) => {
          const n = countOf(item);
          const on = item.href === current;
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href} aria-current={on ? "page" : undefined} className={cn(on && "font-medium text-fg")}>
                <NavIcon name={item.icon} className={cn(on && "text-accent-text")} />
                <span className="flex-1">{item.label}</span>
                {n > 0 ? <PillCount n={n} /> : null}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Resolved theme, false until mounted so the server and first client paint agree. */
function useDarkTheme() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return { dark, toggle: () => setTheme(dark ? "light" : "dark") };
}

function UserMenu({
  user,
  showName = false,
  onShortcuts,
}: {
  user: ShellProps["user"];
  showName?: boolean;
  onShortcuts: () => void;
}) {
  const { dark, toggle } = useDarkTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "focus-ring press flex min-w-0 items-center gap-2.5 rounded-full bg-raised text-left shadow-cell transition-[box-shadow,transform] duration-160 hover:shadow-cell-hover data-[state=open]:shadow-cell-hover",
            showName ? "h-11 flex-1 pl-1 pr-4" : "h-10 pl-1 pr-1 xl:pr-3.5",
          )}
          aria-label="Account menu"
        >
          <Avatar name={user.name} seed={user.id} src={user.avatarUrl ?? undefined} size="md" />
          <span className={cn("min-w-0", showName ? "flex flex-col" : "hidden xl:flex xl:flex-col")}>
            <span className="block truncate text-small font-medium text-fg">{user.name}</span>
            {showName ? <span className="block truncate text-caption text-subtle">{user.title ?? user.email}</span> : null}
          </span>
          {!showName ? <span className="sr-only xl:hidden">{user.name}</span> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={showName ? "top" : "bottom"} className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2">
          <Avatar name={user.name} seed={user.id} src={user.avatarUrl ?? undefined} size="lg" />
          <span className="min-w-0">
            <span className="block truncate text-small font-medium text-fg">{user.name}</span>
            <span className="block truncate text-caption font-normal text-subtle">{user.title ?? user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/people/${user.id}`}>
            <UserRound aria-hidden />
            Your profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggle}>
          {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
          {dark ? "Switch to light theme" : "Switch to dark theme"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onShortcuts} shortcut="?">
          <Keyboard aria-hidden />
          Keyboard shortcuts
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/auth/logout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const { dark, toggle } = useDarkTheme();
  return (
    <Tooltip label={dark ? "Light theme" : "Dark theme"} side="right">
      <button
        type="button"
        aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
        onClick={toggle}
        className="focus-ring press inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors duration-160 hover:bg-hover hover:text-fg"
      >
        {dark ? <Sun className="size-5" strokeWidth={1.75} aria-hidden /> : <Moon className="size-5" strokeWidth={1.75} aria-hidden />}
      </button>
    </Tooltip>
  );
}

const SHORTCUTS: { keys: string[]; label: string; where: string; ai?: boolean }[] = [
  { keys: ["⌘", "K"], label: "Search people, pages and apps", where: "Anywhere" },
  { keys: ["?"], label: "Show these shortcuts", where: "Anywhere" },
  { keys: ["/"], label: "Jump to the app search", where: "Apps" },
  { keys: ["Enter"], label: "Open the first matching app", where: "Apps search" },
  { keys: ["Alt", "←"], label: "Move a pinned app earlier or later", where: "Your apps" },
  { keys: ["⌘", "Enter"], label: "Post a comment", where: "A news post" },
  { keys: ["Esc"], label: "Close a menu, dialog or panel", where: "Anywhere" },
];

/** The shortcut list behind the account menu's "Keyboard shortcuts" row (and the ? key). */
function ShortcutsDialog({ open, onOpenChange, aiEnabled }: { open: boolean; onOpenChange: (open: boolean) => void; aiEnabled: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      e.preventDefault();
      onOpenChange(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);
  const rows = SHORTCUTS.filter((s) => !s.ai || aiEnabled);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>On Windows and Linux, Ctrl stands in for ⌘.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="divide-y divide-border">
            {rows.map((s) => (
              <li key={s.label} className="flex min-h-11 items-center gap-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body text-fg">{s.label}</span>
                  <span className="text-caption text-subtle">{s.where}</span>
                </span>
                <KbdCombo keys={s.keys} className="shrink-0" />
              </li>
            ))}
          </ul>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** Kept for callers that referenced it: the search shortcut hint. */
export function SearchHint() {
  return <Kbd className="hidden sm:inline-flex">⌘K</Kbd>;
}
