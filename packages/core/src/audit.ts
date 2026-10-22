import { db, s } from "@lobby/db";

export async function audit(
  actorId: string | null,
  action: string,
  target?: { type: string; id: string },
  data: Record<string, unknown> = {},
) {
  await db.insert(s.auditLog).values({ actorId, action, targetType: target?.type, targetId: target?.id, data });
}
