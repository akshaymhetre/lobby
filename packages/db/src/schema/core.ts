import {
  boolean, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/** Timestamps are always timezone-aware. */
export const ts = () => timestamp({ withTimezone: true, mode: "date" });
export const createdAt = () => ts().defaultNow().notNull();
export const updatedAt = () => ts().defaultNow().notNull().$onUpdate(() => new Date());

/** Shape of the identity provider settings stored in org_settings.identity. */
export interface IdentitySettings {
  provider: "okta" | "entra" | "google" | "keycloak" | "authentik" | "oidc";
  issuer: string;
  clientId: string;
  /** Encrypted with LOBBY_SECRET (see packages/core/src/crypto). */
  clientSecretEnc: string;
  /** Optional internal discovery URL when the app reaches the IdP on a different host than browsers do. */
  discoveryUrl?: string;
  scopes?: string;
  groupsClaim?: string;
  testedAt?: string;
}

export interface AiSettings {
  enabled: boolean;
  provider: "anthropic" | "openai-compatible";
  model: string;
  apiKeyEnc?: string;
  baseUrl?: string;
  embeddingsProvider?: "none" | "voyage" | "openai-compatible";
  embeddingsModel?: string;
  embeddingsKeyEnc?: string;
  retentionDays: number;
}

/** Single-row table (id = 1) holding company-wide configuration. */
export const orgSettings = pgTable("org_settings", {
  id: integer().primaryKey().default(1),
  companyName: text().notNull().default("Your company"),
  productName: text().notNull().default("Lobby"),
  logoUrl: text(),
  accentColor: text().notNull().default("#2A5FE6"),
  timezone: text().notNull().default("UTC"),
  workingDays: integer().array().notNull().default([1, 2, 3, 4, 5]),
  emailDomain: text(),
  identity: jsonb().$type<IdentitySettings>(),
  ai: jsonb().$type<AiSettings>(),
  /** Wizard progress: step key -> ISO timestamp when completed or skipped. */
  setupSteps: jsonb().$type<Record<string, { status: "done" | "skipped"; at: string }>>().notNull().default({}),
  setupCompletedAt: ts(),
  updatedAt: updatedAt(),
});

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** OIDC `sub` from the identity provider. */
    externalId: text().unique(),
    scimId: text().unique(),
    /** Always stored lower-cased. */
    email: text().notNull(),
    firstName: text().notNull().default(""),
    lastName: text().notNull().default(""),
    displayName: text().notNull(),
    title: text(),
    department: text(),
    location: text(),
    managerId: uuid().references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    startDate: date({ mode: "string" }),
    endDate: date({ mode: "string" }),
    avatarUrl: text(),
    pronouns: text(),
    bio: text(),
    skills: text().array().notNull().default([]),
    timezone: text(),
    workingHours: text(),
    phone: text(),
    status: text({ enum: ["active", "deactivated"] }).notNull().default("active"),
    source: text({ enum: ["oidc", "scim", "csv", "seed", "local"] }).notNull().default("oidc"),
    /** Only the break-glass admin created by the setup wizard has a password. */
    passwordHash: text(),
    isBreakGlass: boolean().notNull().default(false),
    lastLoginAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    index("users_manager_idx").on(t.managerId),
    index("users_department_idx").on(t.department),
  ],
);

export const groups = pgTable("groups", {
  id: uuid().primaryKey().defaultRandom(),
  /** Stable key, matches the IdP group name / SCIM displayName. */
  name: text().notNull().unique(),
  displayName: text().notNull(),
  scimId: text().unique(),
  source: text({ enum: ["oidc", "scim", "csv", "local", "seed"] }).notNull().default("oidc"),
  createdAt: createdAt(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid().notNull().references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("group_members_user_idx").on(t.userId)],
);

export const ROLES = ["employee", "manager", "agent", "content-editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Maps an IdP group name to a Lobby role. Everyone signed in is an employee. */
export const roleMappings = pgTable(
  "role_mappings",
  {
    groupName: text().notNull(),
    role: text({ enum: ROLES }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupName, t.role] })],
);

export const sessions = pgTable(
  "sessions",
  {
    /** sha256 of the opaque cookie token. The raw token is never stored. */
    id: text().primaryKey(),
    userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    lastSeenAt: ts().defaultNow().notNull(),
    expiresAt: ts().notNull(),
    userAgent: text(),
    ip: text(),
    idTokenHint: text(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const scimTokens = pgTable("scim_tokens", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  tokenHash: text().notNull().unique(),
  createdAt: createdAt(),
  lastUsedAt: ts(),
  revokedAt: ts(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    /** e.g. "app.created", "identity.updated", "ai.action.executed" */
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    title: text().notNull(),
    body: text(),
    href: text(),
    readAt: ts(),
    emailedAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const notificationPrefs = pgTable("notification_prefs", {
  userId: uuid().primaryKey().references(() => users.id, { onDelete: "cascade" }),
  emailDigest: text({ enum: ["off", "daily", "instant"] }).notNull().default("daily"),
  mutedKinds: text().array().notNull().default([]),
});
