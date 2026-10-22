import { createHash, createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { db } from "../client";
import * as s from "../schema/index";
import { daysFromToday, demoPeople, emailOf, usernameOf, type SeedContext } from "./util";

const humanise = (name: string) =>
  name.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bIt\b/, "IT");

// Mirrors packages/core/src/crypto.ts so the seed does not depend on core.
const secret = () =>
  process.env.LOBBY_SECRET && process.env.LOBBY_SECRET.length >= 32
    ? process.env.LOBBY_SECRET
    : "lobby-development-secret-do-not-use-in-production";
function encrypt(plain: string) {
  const key = createHash("sha256").update(`enc:${secret()}`).digest();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}
function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `scrypt.${salt.toString("base64url")}.${scryptSync(pw, salt, 64).toString("base64url")}`;
}

export const DEMO_ADMIN_EMAIL = "admin@northwind.example";
export const DEMO_ADMIN_PASSWORD = "lobby-demo-admin";

export async function seedBase(): Promise<SeedContext> {
  const lobbyUrl = process.env.LOBBY_URL ?? "http://localhost:4100";
  const issuer = process.env.DEMO_OIDC_ISSUER ?? "http://localhost:4180/realms/northwind";
  await db
    .insert(s.orgSettings)
    .values({
      id: 1,
      companyName: "Northwind Labs",
      productName: "Lobby",
      accentColor: "#2A5FE6",
      timezone: "Europe/London",
      emailDomain: "northwind.example",
      identity: {
        provider: "keycloak",
        issuer,
        clientId: "lobby",
        clientSecretEnc: encrypt("lobby-demo-secret"),
        discoveryUrl: process.env.DEMO_OIDC_DISCOVERY_URL || undefined,
        scopes: "openid email profile",
        groupsClaim: "groups",
        testedAt: new Date().toISOString(),
      },
      ai: {
        enabled: true,
        provider: "anthropic",
        model: "claude-opus-5-5",
        embeddingsProvider: "none",
        retentionDays: 90,
      },
      setupSteps: Object.fromEntries(
        ["admin", "company", "identity", "people", "apps", "content"].map((k) => [k, { status: "done", at: new Date().toISOString() }]),
      ),
      setupCompletedAt: new Date(),
    })
    .onConflictDoNothing();
  void lobbyUrl;

  const people = demoPeople();
  const groupNames = [...new Set(people.flatMap((p) => p.groups))];
  const groupRows = await db
    .insert(s.groups)
    .values(groupNames.map((name) => ({ name, displayName: humanise(name), source: "seed" as const })))
    .returning();
  const groupIdByName = new Map(groupRows.map((g) => [g.name, g.id]));

  const userRows = await db
    .insert(s.users)
    .values(
      people.map((p) => ({
        email: emailOf(p),
        firstName: p.first,
        lastName: p.last,
        displayName: `${p.first} ${p.last}`,
        title: p.title,
        department: p.dept,
        location: p.loc,
        startDate: daysFromToday(-p.tenureDays),
        timezone: { London: "Europe/London", Berlin: "Europe/Berlin", Austin: "America/Chicago", Bengaluru: "Asia/Kolkata", Remote: "UTC" }[p.loc],
        workingHours: "09:00-17:30",
        source: "seed" as const,
      })),
    )
    .returning({ id: s.users.id, email: s.users.email });
  const idByEmail = new Map(userRows.map((u) => [u.email, u.id]));
  const userIdByUsername = new Map(people.map((p) => [usernameOf(p), idByEmail.get(emailOf(p))!]));

  for (const p of people) {
    if (!p.manager) continue;
    const { eq } = await import("drizzle-orm");
    await db.update(s.users).set({ managerId: userIdByUsername.get(p.manager)! }).where(eq(s.users.id, userIdByUsername.get(usernameOf(p))!));
  }

  await db.insert(s.groupMembers).values(
    people.flatMap((p) => p.groups.map((g) => ({ groupId: groupIdByName.get(g)!, userId: userIdByUsername.get(usernameOf(p))! }))),
  );

  await db.insert(s.roleMappings).values([
    { groupName: "lobby-admins", role: "admin" },
    { groupName: "helpdesk-agents", role: "agent" },
    { groupName: "content-editors", role: "content-editor" },
    { groupName: "people-team", role: "content-editor" },
  ]);

  // Break-glass admin for the demo. Real deploys create this in the setup wizard.
  const [admin] = await db
    .insert(s.users)
    .values({
      email: DEMO_ADMIN_EMAIL,
      firstName: "Lobby",
      lastName: "Admin",
      displayName: "Lobby Admin",
      title: "Break-glass administrator",
      isBreakGlass: true,
      passwordHash: hashPassword(DEMO_ADMIN_PASSWORD),
      source: "local",
    })
    .returning({ id: s.users.id });
  userIdByUsername.set("admin", admin!.id);

  return {
    userIdByUsername,
    groupIdByName,
    user: (u) => {
      const id = userIdByUsername.get(u);
      if (!id) throw new Error(`seed: unknown user ${u}`);
      return id;
    },
    group: (g) => {
      const id = groupIdByName.get(g);
      if (!id) throw new Error(`seed: unknown group ${g}`);
      return id;
    },
  };
}
