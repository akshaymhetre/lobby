import { db, desc, eq, isNull, s } from "@lobby/db";
import { createScimToken as createPeopleScimToken } from "../people/scim";
import { audit } from "../audit";
import { env } from "../env";

export const scimBaseUrl = () => `${env.url}/api/scim/v2`;

/**
 * Creates a SCIM bearer token through the people module (which owns the token format and stores
 * only its sha256), and records who made it. The raw token is returned once.
 */
export async function createScimToken(actorId: string, name: string) {
  const label = name.trim().slice(0, 80) || "Identity provider";
  const { id, token } = await createPeopleScimToken(label);
  await audit(actorId, "scim.token_created", { type: "scim_token", id }, { name: label });
  return { id, name: label, token };
}

export async function listScimTokens() {
  return db
    .select({ id: s.scimTokens.id, name: s.scimTokens.name, createdAt: s.scimTokens.createdAt, lastUsedAt: s.scimTokens.lastUsedAt, revokedAt: s.scimTokens.revokedAt })
    .from(s.scimTokens)
    .orderBy(desc(s.scimTokens.createdAt));
}

export async function revokeScimToken(actorId: string, id: string) {
  const [row] = await db
    .update(s.scimTokens)
    .set({ revokedAt: new Date() })
    .where(eq(s.scimTokens.id, id))
    .returning({ id: s.scimTokens.id, name: s.scimTokens.name });
  if (!row) return false;
  await audit(actorId, "scim.token_revoked", { type: "scim_token", id }, { name: row.name });
  return true;
}

export async function activeScimTokenCount() {
  const rows = await db.select({ id: s.scimTokens.id }).from(s.scimTokens).where(isNull(s.scimTokens.revokedAt));
  return rows.length;
}
