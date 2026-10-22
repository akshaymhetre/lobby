import { asc, db, s } from "@lobby/db";
import type { Role } from "@lobby/db/schema";
import { audit } from "../audit";

/** Roles an IdP group can grant. Employee is everyone; manager comes from the org chart. */
export const MAPPABLE_ROLES = ["admin", "agent", "content-editor"] as const satisfies readonly Role[];
export type MappableRole = (typeof MAPPABLE_ROLES)[number];

export async function listRoleMappings() {
  return db.select().from(s.roleMappings).orderBy(asc(s.roleMappings.role), asc(s.roleMappings.groupName));
}

/** Replaces every role mapping with the given set. Returns what was added and removed. */
export async function setRoleMappings(actorId: string, mappings: { groupName: string; role: MappableRole }[]) {
  const clean = new Map<string, { groupName: string; role: MappableRole }>();
  for (const m of mappings) {
    const groupName = m.groupName.trim();
    if (!groupName || !(MAPPABLE_ROLES as readonly string[]).includes(m.role)) continue;
    clean.set(`${m.role}\u0000${groupName}`, { groupName, role: m.role });
  }
  const before = await listRoleMappings();
  const key = (m: { groupName: string; role: string }) => `${m.role}\u0000${m.groupName}`;
  const beforeKeys = new Set(before.map(key));
  const added = [...clean.values()].filter((m) => !beforeKeys.has(key(m)));
  const removed = before.filter((m) => !clean.has(key(m)));
  if (!added.length && !removed.length) return { added, removed };
  await db.transaction(async (tx) => {
    await tx.delete(s.roleMappings);
    if (clean.size) await tx.insert(s.roleMappings).values([...clean.values()]);
  });
  await audit(actorId, "roles.mappings_updated", { type: "role_mappings", id: "all" }, { added, removed });
  return { added, removed };
}
