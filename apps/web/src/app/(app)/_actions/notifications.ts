"use server";

import { and, db, desc, eq, isNull, s } from "@lobby/db";
import { requireUser } from "@/server/auth";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  kind: string;
  read: boolean;
  createdAt: string;
}

export async function listNotifications(): Promise<NotificationItem[]> {
  const ctx = await requireUser();
  const rows = await db
    .select()
    .from(s.notifications)
    .where(eq(s.notifications.userId, ctx.user.id))
    .orderBy(desc(s.notifications.createdAt))
    .limit(30);
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    href: n.href,
    kind: n.kind,
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function markNotificationRead(id: string) {
  const ctx = await requireUser();
  await db
    .update(s.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(s.notifications.id, id), eq(s.notifications.userId, ctx.user.id)));
}

export async function markAllNotificationsRead() {
  const ctx = await requireUser();
  await db
    .update(s.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(s.notifications.userId, ctx.user.id), isNull(s.notifications.readAt)));
}
