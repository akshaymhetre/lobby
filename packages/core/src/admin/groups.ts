import { asc, count, db, eq, s } from "@lobby/db";

export async function listGroupsWithCounts() {
  return db
    .select({
      id: s.groups.id,
      name: s.groups.name,
      displayName: s.groups.displayName,
      source: s.groups.source,
      createdAt: s.groups.createdAt,
      members: count(s.groupMembers.userId),
    })
    .from(s.groups)
    .leftJoin(s.groupMembers, eq(s.groupMembers.groupId, s.groups.id))
    .groupBy(s.groups.id)
    .orderBy(asc(s.groups.displayName));
}

export async function listGroupMembers(groupId: string) {
  return db
    .select({
      id: s.users.id,
      displayName: s.users.displayName,
      email: s.users.email,
      title: s.users.title,
      avatarUrl: s.users.avatarUrl,
      status: s.users.status,
    })
    .from(s.groupMembers)
    .innerJoin(s.users, eq(s.users.id, s.groupMembers.userId))
    .where(eq(s.groupMembers.groupId, groupId))
    .orderBy(asc(s.users.displayName));
}
