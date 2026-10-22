import { and, asc, count, db, desc, eq, gte, ilike, lt, s, type SQL } from "@lobby/db";

export interface AuditFilter {
  /** Matches the action prefix or substring, e.g. "identity" or "app.created". */
  action?: string;
  actorId?: string;
  /** YYYY-MM-DD, inclusive, in UTC. */
  from?: string;
  /** YYYY-MM-DD, inclusive, in UTC. */
  to?: string;
  page?: number;
  pageSize?: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function auditWhere(f: AuditFilter): SQL | undefined {
  const parts: SQL[] = [];
  if (f.action?.trim()) parts.push(ilike(s.auditLog.action, `%${f.action.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`));
  if (f.actorId && /^[0-9a-f-]{36}$/i.test(f.actorId)) parts.push(eq(s.auditLog.actorId, f.actorId));
  if (f.from && DAY.test(f.from)) parts.push(gte(s.auditLog.createdAt, new Date(`${f.from}T00:00:00Z`)));
  if (f.to && DAY.test(f.to)) {
    const end = new Date(`${f.to}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    parts.push(lt(s.auditLog.createdAt, end));
  }
  return parts.length ? and(...parts) : undefined;
}

export async function listAuditEvents(f: AuditFilter) {
  const pageSize = Math.min(100, Math.max(10, f.pageSize ?? 25));
  const page = Math.max(1, Math.floor(f.page ?? 1));
  const where = auditWhere(f);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: s.auditLog.id,
        action: s.auditLog.action,
        targetType: s.auditLog.targetType,
        targetId: s.auditLog.targetId,
        data: s.auditLog.data,
        createdAt: s.auditLog.createdAt,
        actorId: s.auditLog.actorId,
        actorName: s.users.displayName,
        actorEmail: s.users.email,
      })
      .from(s.auditLog)
      .leftJoin(s.users, eq(s.users.id, s.auditLog.actorId))
      .where(where)
      .orderBy(desc(s.auditLog.createdAt), desc(s.auditLog.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(s.auditLog).where(where),
  ]);
  return { rows, total: total?.n ?? 0, page, pageSize, pages: Math.max(1, Math.ceil((total?.n ?? 0) / pageSize)) };
}

/** Distinct action prefixes ("identity", "app", ...) and the people who have acted, for the filter controls. */
export async function auditFacets() {
  const [actions, actors] = await Promise.all([
    db
      .select({ action: s.auditLog.action, n: count() })
      .from(s.auditLog)
      .groupBy(s.auditLog.action)
      .orderBy(asc(s.auditLog.action)),
    db
      .selectDistinct({ id: s.users.id, name: s.users.displayName, email: s.users.email })
      .from(s.auditLog)
      .innerJoin(s.users, eq(s.users.id, s.auditLog.actorId))
      .orderBy(asc(s.users.displayName))
      .limit(200),
  ]);
  return { actions, actors };
}

