import { count, db, desc, eq, isNull, ne, s, sql } from "@lobby/db";
import { env } from "../env";
import { getOrgSettings } from "../settings";
import { tallyAccounts } from "../counts";

export interface QueueHealth {
  available: boolean;
  /** Jobs ready to run that have waited more than five minutes. A growing number means the worker is down. */
  stuck: number;
  waiting: number;
  active: number;
  failed24h: number;
  completed24h: number;
  oldestWaitingMinutes: number | null;
  status: "healthy" | "degraded" | "down" | "unknown";
}

/** Reads pg-boss's own tables. Returns `available: false` when the worker has never created them. */
export async function queueHealth(): Promise<QueueHealth> {
  const unknown: QueueHealth = {
    available: false, stuck: 0, waiting: 0, active: 0, failed24h: 0, completed24h: 0, oldestWaitingMinutes: null, status: "unknown",
  };
  try {
    const exists = await db.execute<{ t: string | null }>(sql`select to_regclass('pgboss.job')::text as t`);
    if (!exists[0]?.t) return unknown;
    const rows = await db.execute<{
      stuck: number; waiting: number; active: number; failed: number; completed: number; oldest: number | null;
    }>(sql`
      select
        count(*) filter (where state in ('created','retry') and start_after < now() - interval '5 minutes')::int as stuck,
        count(*) filter (where state in ('created','retry') and start_after <= now())::int as waiting,
        count(*) filter (where state = 'active')::int as active,
        count(*) filter (where state = 'failed' and completed_on > now() - interval '24 hours')::int as failed,
        count(*) filter (where state = 'completed' and completed_on > now() - interval '24 hours')::int as completed,
        (extract(epoch from now() - min(start_after) filter (where state in ('created','retry') and start_after <= now())) / 60)::int as oldest
      from pgboss.job`);
    const r = rows[0]!;
    const status = r.stuck > 0 ? "down" : r.failed > 0 ? "degraded" : "healthy";
    return {
      available: true,
      stuck: r.stuck,
      waiting: r.waiting,
      active: r.active,
      failed24h: r.failed,
      completed24h: r.completed,
      oldestWaitingMinutes: r.oldest,
      status,
    };
  } catch {
    return unknown;
  }
}

/** Counts a table that another module owns, tolerating it not existing yet. */
async function safeCount(table: string): Promise<number | null> {
  try {
    const rows = await db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(table)}`);
    return rows[0]?.n ?? 0;
  } catch {
    return null;
  }
}

export async function adminHealth() {
  const org = await getOrgSettings();
  const [accounts, [scim], scimActive, apps, queue] = await Promise.all([
    tallyAccounts(),
    db
      .select({ lastUsedAt: s.scimTokens.lastUsedAt })
      .from(s.scimTokens)
      .where(isNull(s.scimTokens.revokedAt))
      .orderBy(sql`${s.scimTokens.lastUsedAt} desc nulls last`)
      .limit(1),
    db.select({ n: count() }).from(s.scimTokens).where(isNull(s.scimTokens.revokedAt)),
    safeCount("apps"),
    queueHealth(),
  ]);
  const ai = org.ai;
  return {
    identity: {
      configured: !!org.identity?.issuer,
      provider: org.identity?.provider ?? null,
      testedAt: org.identity?.testedAt ?? null,
    },
    scim: { activeTokens: scimActive[0]?.n ?? 0, lastUsedAt: scim?.lastUsedAt ?? null },
    /** Active people in the directory (canonical: excludes the break-glass admin account). */
    people: accounts.people,
    /** Active accounts, labelled exactly: "41 accounts: 40 people and 1 admin account". */
    accounts,
    /** Every app in the catalogue (admin wording: "13 apps in the catalogue"). */
    apps,
    ai: {
      enabled: !!ai?.enabled,
      keyConfigured: !!ai?.apiKeyEnc || !!env.anthropicApiKey,
      model: ai?.model ?? null,
    },
    queue,
  };
}

export async function recentAuditEvents(limit = 8) {
  return db
    .select({
      id: s.auditLog.id,
      action: s.auditLog.action,
      targetType: s.auditLog.targetType,
      targetId: s.auditLog.targetId,
      data: s.auditLog.data,
      createdAt: s.auditLog.createdAt,
      actorName: s.users.displayName,
      actorEmail: s.users.email,
    })
    .from(s.auditLog)
    .leftJoin(s.users, eq(s.users.id, s.auditLog.actorId))
    .where(ne(s.auditLog.action, "auth.signed_in"))
    .orderBy(desc(s.auditLog.createdAt))
    .limit(limit);
}
