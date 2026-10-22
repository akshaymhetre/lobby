import { and, db, eq, inArray, notInArray, or, s, sql } from "@lobby/db";
import type { IdentityClaims } from "./oidc";

/**
 * Creates or updates the Lobby user for an IdP login and syncs group memberships from the token.
 * Users pre-provisioned by SCIM or CSV are matched by email and linked to their IdP subject.
 */
export async function upsertUserFromClaims(c: IdentityClaims): Promise<string> {
  const first = c.givenName ?? c.name?.split(" ")[0] ?? c.email.split("@")[0]!;
  const last = c.familyName ?? c.name?.split(" ").slice(1).join(" ") ?? "";
  const displayName = c.name ?? `${first} ${last}`.trim();

  const existing = await db.query.users.findFirst({
    where: or(eq(s.users.externalId, c.sub), eq(sql`lower(${s.users.email})`, c.email)),
  });

  let userId: string;
  if (existing) {
    if (existing.status !== "active") throw new Error("This account has been deactivated.");
    await db
      .update(s.users)
      .set({
        externalId: c.sub,
        email: c.email,
        firstName: existing.firstName || first,
        lastName: existing.lastName || last,
        displayName: existing.displayName || displayName,
      })
      .where(eq(s.users.id, existing.id));
    userId = existing.id;
  } else {
    const [row] = await db
      .insert(s.users)
      .values({ externalId: c.sub, email: c.email, firstName: first, lastName: last, displayName, source: "oidc" })
      .returning({ id: s.users.id });
    userId = row!.id;
  }

  await syncClaimGroups(userId, c.groups);
  return userId;
}

async function syncClaimGroups(userId: string, names: string[]) {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length) {
    await db
      .insert(s.groups)
      .values(unique.map((name) => ({ name, displayName: humanise(name), source: "oidc" as const })))
      .onConflictDoNothing();
    const rows = await db.select({ id: s.groups.id }).from(s.groups).where(inArray(s.groups.name, unique));
    await db
      .insert(s.groupMembers)
      .values(rows.map((g) => ({ groupId: g.id, userId })))
      .onConflictDoNothing();
  }
  // Drop memberships in IdP-sourced groups the token no longer lists. SCIM/CSV groups are left alone.
  const stale = db
    .select({ id: s.groups.id })
    .from(s.groups)
    .where(and(eq(s.groups.source, "oidc"), unique.length ? notInArray(s.groups.name, unique) : sql`true`));
  await db.delete(s.groupMembers).where(and(eq(s.groupMembers.userId, userId), inArray(s.groupMembers.groupId, stale)));
}

export const humanise = (name: string) =>
  name.replace(/[-_.]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()).replace(/\bIt\b/, "IT");
