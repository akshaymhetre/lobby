import { inArray, notInArray } from "drizzle-orm";
import { db } from "../client";
import * as s from "../schema/index";
import { hoursAgo, type SeedContext } from "./util";

type LaunchType = "sso_link" | "idp_initiated" | "bookmark";

interface SeedApp {
  slug: string;
  name: string;
  description: string;
  category: string;
  launchUrl: string;
  launchType: LaunchType;
  color: string;
  /** Preset icon key; null = monogram. */
  preset: string | null;
  owner: string;
  groups: string[];
}

/** The 13 demo apps. Slugs are fixed: other seeds (journeys) reference them. */
const APPS: SeedApp[] = [
  {
    slug: "google-workspace",
    name: "Google Workspace",
    description: "Mail, calendar and shared drives.",
    category: "Communication",
    launchUrl: "https://www.google.com/a/northwind.example/ServiceLogin?continue=https://mail.google.com/",
    launchType: "sso_link",
    color: "#4285F4",
    preset: "google-workspace",
    owner: "alex.morgan",
    groups: [],
  },
  {
    slug: "slack",
    name: "Slack",
    description: "Team chat, channels and huddles.",
    category: "Communication",
    launchUrl: "https://northwind-labs.slack.com/sso/saml/start",
    launchType: "sso_link",
    color: "#4A154B",
    preset: "slack",
    owner: "alex.morgan",
    groups: [],
  },
  {
    slug: "zoom",
    name: "Zoom",
    description: "Video calls with customers and candidates.",
    category: "Communication",
    launchUrl: "https://northwind-labs.zoom.us/signin",
    launchType: "sso_link",
    color: "#0B5CFF",
    preset: "zoom",
    owner: "jordan.blake",
    groups: [],
  },
  {
    slug: "notion",
    name: "Notion",
    description: "Team notes, specs and meeting docs.",
    category: "Work management",
    launchUrl: "https://www.notion.so/login",
    launchType: "sso_link",
    color: "#000000",
    preset: "notion",
    owner: "rohan.mehta",
    groups: [],
  },
  {
    slug: "jira",
    name: "Jira",
    description: "Cross-team projects and roadmaps.",
    category: "Work management",
    launchUrl: "https://northwind-labs.atlassian.net/jira",
    launchType: "sso_link",
    color: "#0052CC",
    preset: "jira",
    owner: "aisha.bello",
    groups: [],
  },
  {
    slug: "linear",
    name: "Linear",
    description: "Engineering issues, cycles and triage.",
    category: "Work management",
    launchUrl: "https://linear.app/northwind-labs",
    launchType: "sso_link",
    color: "#5E6AD2",
    preset: "linear",
    owner: "nikolai.petrov",
    groups: ["engineering"],
  },
  {
    slug: "github",
    name: "GitHub",
    description: "Source code, pull requests and CI.",
    category: "Engineering",
    launchUrl: "https://github.com/orgs/northwind-labs/sso",
    launchType: "sso_link",
    color: "#181717",
    preset: "github",
    owner: "nikolai.petrov",
    groups: ["engineering"],
  },
  {
    slug: "grafana",
    name: "Grafana",
    description: "Service dashboards, alerts and on-call views.",
    category: "Engineering",
    launchUrl: "http://localhost:4130/login/generic_oauth",
    launchType: "sso_link",
    color: "#F46800",
    preset: "grafana",
    owner: "omar.farouk",
    groups: ["engineering"],
  },
  {
    slug: "figma",
    name: "Figma",
    description: "Design files, prototypes and FigJam boards.",
    category: "Design",
    launchUrl: "https://www.figma.com/login",
    launchType: "sso_link",
    color: "#F24E1E",
    preset: "figma",
    owner: "yuki.tanaka",
    groups: [],
  },
  {
    slug: "expenses",
    name: "Expenses",
    description: "Submit receipts and track your claims.",
    category: "Finance",
    launchUrl: "http://localhost:4140/",
    launchType: "sso_link",
    color: "#14532D",
    preset: null,
    owner: "ben.carter",
    groups: [],
  },
  {
    slug: "bamboohr",
    name: "BambooHR",
    description: "HR records, time off balances and reviews.",
    category: "People",
    launchUrl: "https://northwind-labs.bamboohr.com/login.php",
    launchType: "sso_link",
    color: "#73C41D",
    preset: "bamboohr",
    owner: "amara.nwosu",
    groups: ["people-team"],
  },
  {
    slug: "salesforce",
    name: "Salesforce",
    description: "Accounts, pipeline and forecasts.",
    category: "Sales",
    launchUrl: "https://northwind-labs.my.salesforce.com",
    launchType: "sso_link",
    color: "#00A1E0",
    preset: "salesforce",
    owner: "ethan.wright",
    groups: ["sales-marketing"],
  },
  {
    slug: "1password",
    name: "1Password",
    description: "Shared vaults for team credentials.",
    category: "Security",
    launchUrl: "https://northwind-labs.1password.com",
    launchType: "bookmark",
    color: "#145FE4",
    preset: "1password",
    owner: "anya.kowalski",
    groups: [],
  },
];

const PINS: Record<string, string[]> = {
  "maya.chen": ["grafana", "github", "linear", "slack", "expenses"],
  "grace.okoye": ["linear", "github", "google-workspace", "notion"],
  "alex.morgan": ["1password", "google-workspace", "slack", "zoom"],
  "priya.raman": ["bamboohr", "google-workspace", "slack"],
  "elena.vasquez": ["google-workspace", "slack", "notion"],
};

/** [username, slug, hours ago] */
const LAUNCHES: [string, string, number][] = [
  ["maya.chen", "grafana", 2],
  ["maya.chen", "github", 3],
  ["maya.chen", "slack", 4],
  ["maya.chen", "linear", 20],
  ["maya.chen", "notion", 26],
  ["maya.chen", "expenses", 50],
  ["maya.chen", "github", 52],
  ["maya.chen", "figma", 80],
  ["grace.okoye", "linear", 1],
  ["grace.okoye", "notion", 5],
  ["grace.okoye", "google-workspace", 6],
  ["alex.morgan", "1password", 1],
  ["alex.morgan", "zoom", 9],
  ["priya.raman", "bamboohr", 2],
  ["kenji.watanabe", "grafana", 7],
  ["omar.farouk", "grafana", 1],
  ["omar.farouk", "github", 3],
  ["chloe.martin", "figma", 4],
  ["noah.fischer", "figma", 2],
  ["olivia.brooks", "salesforce", 3],
  ["ethan.wright", "salesforce", 1],
];

/**
 * Upserts apps by slug so ids stay stable across re-seeds (journey steps reference them),
 * then replaces visibility, pins and launches for the seeded apps.
 */
export async function seedApps(ctx: SeedContext): Promise<void> {
  const known = (u: string) => ctx.userIdByUsername.has(u);
  const ids = new Map<string, string>();
  for (const [i, a] of APPS.entries()) {
    const values = {
      slug: a.slug,
      name: a.name,
      description: a.description,
      category: a.category,
      icon: a.preset ? `preset:${a.preset}` : null,
      color: a.color,
      launchUrl: a.launchUrl,
      launchType: a.launchType,
      presetKey: a.preset ?? "custom",
      ownerId: known(a.owner) ? ctx.user(a.owner) : null,
      requestAccessEnabled: true,
      sortOrder: i,
    };
    const [row] = await db
      .insert(s.apps)
      .values(values)
      .onConflictDoUpdate({ target: s.apps.slug, set: values })
      .returning({ id: s.apps.id });
    ids.set(a.slug, row!.id);
  }
  const appIds = [...ids.values()];

  // Seeded app ids are the module's own rows: clear their links, then rebuild.
  await db.delete(s.appVisibility).where(inArray(s.appVisibility.appId, appIds));
  await db.delete(s.userAppPins).where(inArray(s.userAppPins.appId, appIds));
  await db.delete(s.appLaunches).where(inArray(s.appLaunches.appId, appIds));

  const visibility = APPS.flatMap((a) => a.groups.map((g) => ({ appId: ids.get(a.slug)!, groupId: ctx.group(g) })));
  if (visibility.length) await db.insert(s.appVisibility).values(visibility);

  const pins = Object.entries(PINS)
    .filter(([u]) => known(u))
    .flatMap(([u, slugs]) => slugs.map((slug, position) => ({ userId: ctx.user(u), appId: ids.get(slug)!, position })));
  if (pins.length) await db.insert(s.userAppPins).values(pins);

  const launches = LAUNCHES.filter(([u]) => known(u)).map(([u, slug, h]) => ({
    userId: ctx.user(u),
    appId: ids.get(slug)!,
    at: hoursAgo(h),
  }));
  if (launches.length) await db.insert(s.appLaunches).values(launches);

  // Leave admin-created apps alone; only report how many there are.
  const others = await db.select({ id: s.apps.id }).from(s.apps).where(notInArray(s.apps.id, appIds));
  if (others.length) console.log(`apps: kept ${others.length} app(s) created outside the seed`);
}
