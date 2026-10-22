import { and, db, eq, gt, lt, s } from "@lobby/db";
import { randomToken, sha256 } from "../crypto";

export const SESSION_COOKIE = "lobby_session";
const IDLE_MS = 24 * 60 * 60 * 1000;
const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_MS = 5 * 60 * 1000;

export async function createSession(userId: string, meta: { userAgent?: string; ip?: string; idTokenHint?: string } = {}) {
  const token = randomToken();
  const now = Date.now();
  await db.insert(s.sessions).values({
    id: sha256(token),
    userId,
    expiresAt: new Date(now + ABSOLUTE_MS),
    userAgent: meta.userAgent?.slice(0, 300),
    ip: meta.ip,
    idTokenHint: meta.idTokenHint,
  });
  await db.update(s.users).set({ lastLoginAt: new Date() }).where(eq(s.users.id, userId));
  return { token, maxAgeSeconds: ABSOLUTE_MS / 1000 };
}

/** Returns the session for a raw cookie token, or null if missing, expired or idle too long. */
export async function readSession(token: string | undefined) {
  if (!token) return null;
  const id = sha256(token);
  const now = new Date();
  const row = await db.query.sessions.findFirst({
    where: and(eq(s.sessions.id, id), gt(s.sessions.expiresAt, now), gt(s.sessions.lastSeenAt, new Date(now.getTime() - IDLE_MS))),
  });
  if (!row) return null;
  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_MS) {
    await db.update(s.sessions).set({ lastSeenAt: now }).where(eq(s.sessions.id, id));
  }
  return row;
}

export async function destroySession(token: string | undefined) {
  if (!token) return null;
  const [row] = await db.delete(s.sessions).where(eq(s.sessions.id, sha256(token))).returning();
  return row ?? null;
}

export async function destroyUserSessions(userId: string) {
  await db.delete(s.sessions).where(eq(s.sessions.userId, userId));
}

export async function pruneSessions() {
  await db.delete(s.sessions).where(lt(s.sessions.expiresAt, new Date()));
}
