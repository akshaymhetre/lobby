"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import {
  listNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem,
} from "@/app/(app)/_actions/notifications";

const PREVIEW = 5;

/**
 * The bell in the top bar. The popover shows the five newest notifications; "All notifications"
 * opens a sheet with the whole list. The unread count is a neutral pill (ink on page), so the only
 * accent on the top bar stays the unread dots inside the list.
 */
export function NotificationsBell({ initialUnread }: { initialUnread: number }) {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      const list = await listNotifications();
      setItems(list);
      setUnread(list.filter((n) => !n.read).length);
    });

  const markAll = () =>
    startTransition(async () => {
      await markAllNotificationsRead();
      setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
      setUnread(0);
    });

  const markOne = (n: NotificationItem) => {
    if (n.read) return;
    setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
    setUnread((u) => Math.max(0, u - 1));
    void markNotificationRead(n.id);
  };

  const showAll = () => {
    setOpen(false);
    setAllOpen(true);
    if (items === null) load();
  };

  const more = items ? Math.max(0, items.length - PREVIEW) : 0;

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) load();
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="secondary" size="icon" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative">
            <Bell />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-caption font-semibold leading-none text-accent-fg tabular-nums ring-2 ring-page">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(380px,calc(100vw-24px))] p-0">
          <div className="flex h-12 items-center justify-between border-b border-border pl-4 pr-2">
            <p className="text-body font-medium">Notifications</p>
            <Button variant="ghost" size="sm" onClick={markAll} disabled={!unread}>
              <CheckCheck aria-hidden />
              Mark all read
            </Button>
          </div>
          <NotificationList items={items === null ? null : items.slice(0, PREVIEW)} onOpen={markOne} compact />
          {items && items.length ? (
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={showAll}
                className="focus-ring flex h-10 w-full items-center justify-between rounded-control px-3 text-small font-medium text-fg transition-colors duration-120 hover:bg-hover"
              >
                All notifications
                {more > 0 ? <span className="tabular text-caption font-normal text-subtle">{more} more</span> : null}
              </button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      <Sheet open={allOpen} onOpenChange={setAllOpen}>
        <SheetContent side="right" className="w-full max-w-[400px] sm:max-w-[440px]">
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              {unread ? `${unread} unread. ` : "Everything is read. "}
              Approvals, replies and onboarding tasks land here.
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="px-0 py-0">
            <NotificationList items={items} onOpen={markOne} />
          </SheetBody>
          {unread ? (
            <div className="border-t border-border px-5 py-3">
              <Button variant="secondary" size="sm" onClick={markAll}>
                <CheckCheck aria-hidden />
                Mark all read
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function NotificationList({
  items,
  onOpen,
  compact = false,
}: {
  items: NotificationItem[] | null;
  onOpen: (n: NotificationItem) => void;
  compact?: boolean;
}) {
  if (items === null) {
    return (
      <div className="space-y-3 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <BellOff className="size-5 stroke-[1.5] text-subtle" aria-hidden />
        <p className="text-body font-medium text-fg">You are all caught up</p>
        <p className="text-small text-muted">Approvals, ticket replies and onboarding tasks will show up here.</p>
      </div>
    );
  }
  return (
    <ul className={cn("divide-y divide-border", compact && "max-h-[420px] overflow-y-auto")}>
      {items.map((n) => {
        const content = (
          <>
            <span className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-accent")} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className={cn("block text-small", n.read ? "text-muted" : "font-medium text-fg")}>{n.title}</span>
              {n.body && <span className="mt-0.5 line-clamp-2 block text-caption text-muted">{n.body}</span>}
              <span className="mt-1 block text-caption text-subtle">{timeAgo(n.createdAt)}</span>
            </span>
          </>
        );
        const cls =
          "flex min-h-11 gap-3 px-4 py-3 text-left transition-colors duration-120 hover:bg-hover active:bg-selected focus-visible:bg-hover focus-visible:outline-none";
        return (
          <li key={n.id}>
            {n.href ? (
              <Link href={n.href} className={cls} onClick={() => onOpen(n)}>
                {content}
              </Link>
            ) : (
              <div className={cn(cls, "hover:bg-transparent active:bg-transparent")}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
