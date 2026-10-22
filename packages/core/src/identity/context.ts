import { and, count, db, eq, inArray, s } from "@lobby/db";
import type { Role } from "@lobby/db/schema";

export type UserRow = typeof s.users.$inferSelect;

/** Everything a request needs to know about who is acting and what they may see. */
export interface UserContext {
  user: UserRow;
  groupIds: string[];
  groupNames: string[];
  roles: Role[];
  /** ACL principals for search and visibility filters: "*", "user:<id>", "group:<id>". */
  principals: string[];
  has: (role: Role) => boolean;
}

export async function loadUserContext(userId: string): Promise<UserContext | null> {
  const user = await db.query.users.findFirst({ where: eq(s.users.id, userId) });
  if (!user || user.status !== "active") return null;

  const memberships = await db
    .select({ id: s.groups.id, name: s.groups.name })
    .from(s.groupMembers)
    .innerJoin(s.groups, eq(s.groups.id, s.groupMembers.groupId))
    .where(eq(s.groupMembers.userId, userId));
  const groupIds = memberships.map((m) => m.id);
  const groupNames = memberships.map((m) => m.name);

  const roles = new Set<Role>(["employee"]);
  if (groupNames.length) {
    const mapped = await db.select().from(s.roleMappings).where(inArray(s.roleMappings.groupName, groupNames));
    for (const m of mapped) roles.add(m.role);
  }
  const [reports] = await db
    .select({ n: count() })
    .from(s.users)
    .where(and(eq(s.users.managerId, userId), eq(s.users.status, "active")));
  if ((reports?.n ?? 0) > 0) roles.add("manager");
  if (user.isBreakGlass) roles.add("admin");
  if (roles.has("admin")) {
    roles.add("agent");
    roles.add("content-editor");
  }

  const roleList = [...roles];
  return {
    user,
    groupIds,
    groupNames,
    roles: roleList,
    principals: ["*", `user:${user.id}`, ...groupIds.map((id) => `group:${id}`)],
    has: (role) => roles.has(role),
  };
}

/** True when an audience list (group ids) is empty or intersects the user's groups. */
export function inAudience(ctx: Pick<UserContext, "groupIds">, audienceGroupIds: string[]): boolean {
  return audienceGroupIds.length === 0 || audienceGroupIds.some((g) => ctx.groupIds.includes(g));
}
