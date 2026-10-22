import { boolean, index, integer, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, groups, ts, updatedAt, users } from "./core";

/**
 * A launcher tile. launchType says how SSO happens:
 *  - "sso_link": the app's own login URL (SP-initiated SAML or OIDC). The app bounces to the
 *    shared IdP, which already holds a session, so sign-in completes silently. Preferred.
 *  - "idp_initiated": an IdP-initiated SAML URL. Works, but weaker (unsolicited assertion).
 *  - "bookmark": a plain link with no SSO.
 */
export const apps = pgTable("apps", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text(),
  category: text().notNull().default("General"),
  /** Either a key into the built-in icon set (e.g. "preset:slack") or an uploaded image URL. */
  icon: text(),
  /** Background colour for generated monogram icons. */
  color: text(),
  launchUrl: text().notNull(),
  launchType: text({ enum: ["sso_link", "idp_initiated", "bookmark"] }).notNull().default("sso_link"),
  presetKey: text(),
  ownerId: uuid().references(() => users.id, { onDelete: "set null" }),
  requestAccessEnabled: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Groups allowed to see an app. No rows = visible to everyone. */
export const appVisibility = pgTable(
  "app_visibility",
  {
    appId: uuid().notNull().references(() => apps.id, { onDelete: "cascade" }),
    groupId: uuid().notNull().references(() => groups.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.appId, t.groupId] })],
);

export const userAppPins = pgTable(
  "user_app_pins",
  {
    userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
    appId: uuid().notNull().references(() => apps.id, { onDelete: "cascade" }),
    position: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.appId] })],
);

export const appLaunches = pgTable(
  "app_launches",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
    appId: uuid().notNull().references(() => apps.id, { onDelete: "cascade" }),
    at: ts().defaultNow().notNull(),
  },
  (t) => [index("app_launches_user_idx").on(t.userId, t.at)],
);

