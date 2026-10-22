import { and, asc, count, db, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, s, sql, type SQL } from "@lobby/db";
import { z } from "zod";
import { audit } from "../audit";
import { destroyUserSessions } from "../identity/sessions";
import type { UserContext } from "../identity/context";
import { notify } from "../notify";
import { daysUntil, isValidTimezone, normaliseSkills, parseWorkingHours } from "./format";
import { indexPerson } from "./index-source";
import { directoryPersonWhere } from "./directory";

export * from "./format";
export { indexPerson, reindexPeople } from "./index-source";

type UserRow = typeof s.users.$inferSelect;

/** Thrown for anything the user should see as a plain message. */
export class PeopleError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409 = 400) {
    super(message);
  }
}

export interface PersonSummary {
  id: string;
  displayName: string;
  email: string;
  title: string | null;
  department: string | null;
  location: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  workingHours: string | null;
  startDate: string | null;
  pronouns: string | null;
  skills: string[];
  managerId: string | null;
}

const summaryCols = {
  id: s.users.id,
  displayName: s.users.displayName,
  email: s.users.email,
  title: s.users.title,
  department: s.users.department,
  location: s.users.location,
  avatarUrl: s.users.avatarUrl,
  timezone: s.users.timezone,
  workingHours: s.users.workingHours,
  startDate: s.users.startDate,
  pronouns: s.users.pronouns,
  skills: s.users.skills,
  managerId: s.users.managerId,
};

/** Active people who are real employees (not the break-glass account). One definition: ./directory. */
const listable = directoryPersonWhere;

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Matches a free-text query against name, email, title, team, location and skills. */
function matchQuery(q: string): SQL | undefined {
  const terms = q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  if (!terms.length) return undefined;
  return and(
    ...terms.map((t) =>
      or(
        ilike(s.users.displayName, like(t)),
        ilike(s.users.email, like(t)),
        ilike(s.users.title, like(t)),
        ilike(s.users.department, like(t)),
        ilike(s.users.location, like(t)),
        sql`array_to_string(${s.users.skills}, ' ') ilike ${like(t)}`,
      ),
    ),
  );
}

/** Ranks name-prefix matches first, then name contains, then everything else. */
const rankQuery = (q: string) =>
  sql`case when ${s.users.displayName} ilike ${`${q.trim().replace(/[\\%_]/g, "")}%`} then 0
           when ${s.users.displayName} ilike ${like(q.trim())} then 1
           when ${s.users.title} ilike ${like(q.trim())} then 2 else 3 end`;

/**
 * Contract (AI assistant `find_person`): people matching a name, title, team or skill.
 * Everyone signed in may see the directory, so the context only has to be a valid user.
 */
export async function findPeople(_ctx: UserContext, query: string, limit = 10): Promise<PersonSummary[]> {
  const where = matchQuery(query);
  if (!where) return [];
  return db
    .select(summaryCols)
    .from(s.users)
    .where(and(listable(), where))
    .orderBy(rankQuery(query), asc(s.users.displayName))
    .limit(Math.min(Math.max(limit, 1), 50));
}

export interface DirectoryQuery {
  q?: string;
  department?: string[];
  location?: string[];
  page?: number;
  pageSize?: number;
}

export interface Facet {
  value: string;
  count: number;
}

export interface DirectoryResult {
  people: PersonSummary[];
  total: number;
  /** Everyone in the directory, before filters. */
  everyone: number;
  page: number;
  pageCount: number;
  departments: Facet[];
  locations: Facet[];
}

/** The directory listing with search, department and location filters, and counts per facet. */
export async function listDirectory(_ctx: UserContext, opts: DirectoryQuery = {}): Promise<DirectoryResult> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 48, 1), 200);
  const qWhere = opts.q ? matchQuery(opts.q) : undefined;
  const deptWhere = opts.department?.length ? inArray(s.users.department, opts.department) : undefined;
  const locWhere = opts.location?.length ? inArray(s.users.location, opts.location) : undefined;
  const where = and(listable(), qWhere, deptWhere, locWhere);

  const [[totalRow], [everyoneRow], departments, locations] = await Promise.all([
    db.select({ n: count() }).from(s.users).where(where),
    db.select({ n: count() }).from(s.users).where(listable()),
    // Each facet counts with every OTHER filter applied, so the numbers say what picking it would show.
    db
      .select({ value: s.users.department, count: count() })
      .from(s.users)
      .where(and(listable(), qWhere, locWhere, sql`${s.users.department} is not null`))
      .groupBy(s.users.department)
      .orderBy(asc(s.users.department)),
    db
      .select({ value: s.users.location, count: count() })
      .from(s.users)
      .where(and(listable(), qWhere, deptWhere, sql`${s.users.location} is not null`))
      .groupBy(s.users.location)
      .orderBy(asc(s.users.location)),
  ]);
  const total = totalRow?.n ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(opts.page ?? 1, 1), pageCount);
  const people = await db
    .select(summaryCols)
    .from(s.users)
    .where(where)
    .orderBy(...(opts.q ? [rankQuery(opts.q)] : []), asc(s.users.displayName))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    people,
    total,
    everyone: everyoneRow?.n ?? 0,
    page,
    pageCount,
    departments: departments.map((d) => ({ value: d.value!, count: d.count })),
    locations: locations.map((l) => ({ value: l.value!, count: l.count })),
  };
}

export interface NewJoiner extends PersonSummary {
  greetedByMe: boolean;
  greetings: number;
}

/** People who joined in the last 30 days and people starting in the next 30, with greeting state. */
export async function listNewJoiners(ctx: UserContext): Promise<{ recent: NewJoiner[]; upcoming: NewJoiner[] }> {
  const today = new Date();
  const from = isoDay(today, -29);
  const to = isoDay(today, 30);
  const rows = await db
    .select(summaryCols)
    .from(s.users)
    .where(and(listable(), gte(s.users.startDate, from), lte(s.users.startDate, to)))
    .orderBy(desc(s.users.startDate));
  if (!rows.length) return { recent: [], upcoming: [] };
  const ids = rows.map((r) => r.id);
  const [mine, counts] = await Promise.all([
    db
      .select({ to: s.greetings.toUserId })
      .from(s.greetings)
      .where(and(eq(s.greetings.fromUserId, ctx.user.id), inArray(s.greetings.toUserId, ids))),
    db
      .select({ to: s.greetings.toUserId, n: count() })
      .from(s.greetings)
      .where(inArray(s.greetings.toUserId, ids))
      .groupBy(s.greetings.toUserId),
  ]);
  const greeted = new Set(mine.map((m) => m.to));
  const byId = new Map(counts.map((c) => [c.to, c.n]));
  const withState = rows.map((r) => ({ ...r, greetedByMe: greeted.has(r.id), greetings: byId.get(r.id) ?? 0 }));
  return {
    recent: withState.filter((r) => daysUntil(r.startDate!, today) <= 0),
    upcoming: withState.filter((r) => daysUntil(r.startDate!, today) > 0).reverse(),
  };
}

function isoDay(base: Date, offsetDays: number): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + offsetDays));
  return d.toISOString().slice(0, 10);
}

export interface Greeting {
  id: string;
  message: string;
  createdAt: Date;
  from: { id: string; displayName: string; title: string | null; avatarUrl: string | null };
}

export interface PersonProfile {
  person: UserRow;
  manager: PersonSummary | null;
  reports: PersonSummary[];
  peers: PersonSummary[];
  groups: { id: string; displayName: string; source: string }[];
  /** Only filled in when the viewer is looking at their own profile. */
  greetings: Greeting[];
  greetedByMe: boolean;
  isSelf: boolean;
  canEdit: boolean;
  canAdminEdit: boolean;
}

/** One person's profile with their reporting line. Deactivated people are only visible to admins. */
export async function getPersonProfile(ctx: UserContext, id: string): Promise<PersonProfile | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const person = await db.query.users.findFirst({ where: eq(s.users.id, id) });
  if (!person) return null;
  const isAdmin = ctx.has("admin");
  if ((person.status !== "active" || person.isBreakGlass) && !isAdmin && person.id !== ctx.user.id) return null;

  const [manager, reports, peers, groups, greetings, mine] = await Promise.all([
    person.managerId
      ? db.select(summaryCols).from(s.users).where(eq(s.users.id, person.managerId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db.select(summaryCols).from(s.users).where(and(listable(), eq(s.users.managerId, person.id))).orderBy(asc(s.users.displayName)),
    person.managerId
      ? db
          .select(summaryCols)
          .from(s.users)
          .where(and(listable(), eq(s.users.managerId, person.managerId), ne(s.users.id, person.id)))
          .orderBy(asc(s.users.displayName))
      : Promise.resolve([] as PersonSummary[]),
    db
      .select({ id: s.groups.id, displayName: s.groups.displayName, source: s.groups.source })
      .from(s.groupMembers)
      .innerJoin(s.groups, eq(s.groups.id, s.groupMembers.groupId))
      .where(eq(s.groupMembers.userId, person.id))
      .orderBy(asc(s.groups.displayName)),
    person.id === ctx.user.id
      ? db
          .select({
            id: s.greetings.id,
            message: s.greetings.message,
            createdAt: s.greetings.createdAt,
            fromId: s.users.id,
            fromName: s.users.displayName,
            fromTitle: s.users.title,
            fromAvatar: s.users.avatarUrl,
          })
          .from(s.greetings)
          .innerJoin(s.users, eq(s.users.id, s.greetings.fromUserId))
          .where(eq(s.greetings.toUserId, person.id))
          .orderBy(desc(s.greetings.createdAt))
          .limit(50)
      : Promise.resolve([]),
    db
      .select({ id: s.greetings.id })
      .from(s.greetings)
      .where(and(eq(s.greetings.fromUserId, ctx.user.id), eq(s.greetings.toUserId, person.id)))
      .limit(1),
  ]);

  const isSelf = person.id === ctx.user.id;
  return {
    person,
    manager,
    reports,
    peers,
    groups,
    greetings: greetings.map((g) => ({
      id: g.id,
      message: g.message,
      createdAt: g.createdAt,
      from: { id: g.fromId, displayName: g.fromName, title: g.fromTitle, avatarUrl: g.fromAvatar },
    })),
    greetedByMe: mine.length > 0,
    isSelf,
    canEdit: (isSelf && !person.isBreakGlass) || isAdmin,
    canAdminEdit: isAdmin,
  };
}

/** Minimal rows for the org chart: every active person and who they report to. */
export async function listOrgChart(_ctx: UserContext) {
  return db
    .select({
      id: s.users.id,
      displayName: s.users.displayName,
      title: s.users.title,
      department: s.users.department,
      location: s.users.location,
      avatarUrl: s.users.avatarUrl,
      managerId: s.users.managerId,
    })
    .from(s.users)
    .where(listable())
    .orderBy(asc(s.users.displayName));
}
export type OrgChartPerson = Awaited<ReturnType<typeof listOrgChart>>[number];

/** Options for manager and filter pickers. */
export async function listPeopleOptions() {
  return db
    .select({ id: s.users.id, displayName: s.users.displayName, title: s.users.title })
    .from(s.users)
    .where(listable())
    .orderBy(asc(s.users.displayName));
}

// ---------------------------------------------------------------------------------------------
// Editing

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const dateString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => v == null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), "Use a date like 2026-03-14.");

export const selfProfileSchema = z.object({
  pronouns: optionalText(40),
  bio: optionalText(1200),
  skills: z.array(z.string()).max(60).optional(),
  timezone: optionalText(64).refine((v) => v == null || isValidTimezone(v), "Pick a time zone from the list."),
  workingHours: optionalText(20).refine((v) => v == null || parseWorkingHours(v) !== null, "Use 24-hour times like 09:00-17:30."),
  phone: optionalText(40).refine((v) => v == null || /^[+\d][\d\s().-]{4,}$/.test(v), "That does not look like a phone number."),
  avatarUrl: optionalText(500).refine((v) => v == null || /^https:\/\/\S+$/i.test(v), "Use an https:// image address."),
});

export const adminProfileSchema = selfProfileSchema.extend({
  displayName: z.string().trim().min(1, "Add a name.").max(120).optional(),
  title: optionalText(120),
  department: optionalText(80),
  location: optionalText(80),
  managerId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine((v) => v == null || z.uuid().safeParse(v).success, "Pick a manager from the list."),
  startDate: dateString,
  endDate: dateString,
});

export type ProfilePatch = z.input<typeof adminProfileSchema>;

export interface FieldErrors {
  [field: string]: string;
}

/** Validates and saves a profile edit. People edit their own personal fields; admins edit everything. */
export async function updateProfile(
  ctx: UserContext,
  id: string,
  patch: ProfilePatch,
): Promise<{ ok: true } | { ok: false; errors: FieldErrors }> {
  const person = await db.query.users.findFirst({ where: eq(s.users.id, id) });
  if (!person) throw new PeopleError("We could not find that person.", 404);
  const isAdmin = ctx.has("admin");
  const isSelf = ctx.user.id === id;
  if (!isAdmin && !isSelf) throw new PeopleError("You can only edit your own profile.", 403);

  const schema = isAdmin ? adminProfileSchema : selfProfileSchema;
  const parsed = schema.safeParse(patch);
  if (!parsed.success) {
    const errors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  const data = parsed.data as z.output<typeof adminProfileSchema>;
  const set: Partial<typeof s.users.$inferInsert> = {};
  for (const key of ["pronouns", "bio", "timezone", "workingHours", "phone", "avatarUrl"] as const) {
    if (data[key] !== undefined) set[key] = data[key];
  }
  if (data.skills !== undefined) set.skills = normaliseSkills(data.skills);

  if (isAdmin) {
    for (const key of ["title", "department", "location", "startDate", "endDate"] as const) {
      if (data[key] !== undefined) set[key] = data[key];
    }
    if (data.displayName !== undefined) set.displayName = data.displayName;
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      return { ok: false, errors: { endDate: "The last day has to be after the start date." } };
    }
    if (data.managerId !== undefined) {
      if (data.managerId) {
        const problem = await managerProblem(id, data.managerId);
        if (problem) return { ok: false, errors: { managerId: problem } };
      }
      set.managerId = data.managerId;
    }
  }

  if (Object.keys(set).length) {
    await db.update(s.users).set(set).where(eq(s.users.id, id));
    if (isAdmin && !isSelf) await audit(ctx.user.id, "people.profile_updated", { type: "user", id }, { fields: Object.keys(set) });
    await indexPerson(id);
  }
  return { ok: true };
}

/** Explains why `managerId` cannot manage `personId` (self, unknown, inactive, or a loop), or null when fine. */
export async function managerProblem(personId: string, managerId: string): Promise<string | null> {
  if (managerId === personId) return "Someone cannot be their own manager.";
  const manager = await db.query.users.findFirst({ where: eq(s.users.id, managerId) });
  if (!manager || manager.status !== "active") return "Pick an active person as manager.";
  // Walk up from the proposed manager; reaching the person means the change would create a loop.
  let cursor: string | null = manager.managerId;
  const seen = new Set<string>([managerId]);
  while (cursor) {
    if (cursor === personId) return `${manager.displayName} reports to this person, so that would create a loop.`;
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const next: { managerId: string | null } | undefined = await db.query.users.findFirst({
      where: eq(s.users.id, cursor),
      columns: { managerId: true },
    });
    cursor = next?.managerId ?? null;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Greetings

export const DEFAULT_GREETING = "Hi and welcome to the team! Shout if you need anything.";

/** "Say hi" to a new joiner: stores the greeting once per sender and notifies the person. */
export async function sendGreeting(ctx: UserContext, toUserId: string, message?: string): Promise<{ created: boolean }> {
  if (!z.uuid().safeParse(toUserId).success) throw new PeopleError("We could not find that person.", 404);
  if (toUserId === ctx.user.id) throw new PeopleError("You cannot say hi to yourself.");
  const to = await db.query.users.findFirst({ where: and(eq(s.users.id, toUserId), listable()) });
  if (!to) throw new PeopleError("We could not find that person.", 404);
  const text = (message ?? "").trim().slice(0, 500) || DEFAULT_GREETING;

  const existing = await db
    .select({ id: s.greetings.id })
    .from(s.greetings)
    .where(and(eq(s.greetings.fromUserId, ctx.user.id), eq(s.greetings.toUserId, toUserId)))
    .limit(1);
  if (existing.length) return { created: false };

  await db.insert(s.greetings).values({ fromUserId: ctx.user.id, toUserId, message: text });
  await notify(toUserId, {
    kind: "people.greeting",
    title: `${ctx.user.displayName} said hi`,
    body: text,
    href: `/people/${toUserId}#greetings`,
  });
  return { created: true };
}

// ---------------------------------------------------------------------------------------------
// Admin

export interface AdminPersonRow {
  id: string;
  displayName: string;
  email: string;
  title: string | null;
  department: string | null;
  status: "active" | "deactivated";
  source: UserRow["source"];
  lastLoginAt: Date | null;
  isBreakGlass: boolean;
  avatarUrl: string | null;
}

export async function listPeopleForAdmin(
  ctx: UserContext,
  opts: { q?: string; status?: "active" | "deactivated" | "all"; source?: UserRow["source"] | "all" } = {},
): Promise<{ rows: AdminPersonRow[]; counts: { active: number; deactivated: number } }> {
  if (!ctx.has("admin")) throw new PeopleError("Only admins can see this.", 403);
  const where = and(
    opts.q ? matchQuery(opts.q) : undefined,
    opts.status && opts.status !== "all" ? eq(s.users.status, opts.status) : undefined,
    opts.source && opts.source !== "all" ? eq(s.users.source, opts.source) : undefined,
  );
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: s.users.id,
        displayName: s.users.displayName,
        email: s.users.email,
        title: s.users.title,
        department: s.users.department,
        status: s.users.status,
        source: s.users.source,
        lastLoginAt: s.users.lastLoginAt,
        isBreakGlass: s.users.isBreakGlass,
        avatarUrl: s.users.avatarUrl,
      })
      .from(s.users)
      .where(where)
      .orderBy(asc(s.users.displayName))
      .limit(1000),
    db.select({ status: s.users.status, n: count() }).from(s.users).groupBy(s.users.status),
  ]);
  return {
    rows,
    counts: {
      active: counts.find((c) => c.status === "active")?.n ?? 0,
      deactivated: counts.find((c) => c.status === "deactivated")?.n ?? 0,
    },
  };
}

/**
 * Deactivates or reactivates someone. Deactivating signs them out everywhere and removes them from
 * search. Used by the admin page and by SCIM (`actorId` null).
 */
export async function setPersonActive(actorId: string | null, id: string, active: boolean, via: "admin" | "scim" = "admin") {
  const person = await db.query.users.findFirst({ where: eq(s.users.id, id) });
  if (!person) throw new PeopleError("We could not find that person.", 404);
  const status = active ? "active" : "deactivated";
  if (person.status !== status) {
    await db
      .update(s.users)
      .set({ status, endDate: active ? null : (person.endDate ?? new Date().toISOString().slice(0, 10)) })
      .where(eq(s.users.id, id));
    await audit(actorId, active ? "people.reactivated" : "people.deactivated", { type: "user", id }, { via });
  }
  if (!active) await destroyUserSessions(id);
  await indexPerson(id);
}

export async function deactivatePerson(ctx: UserContext, id: string) {
  if (!ctx.has("admin")) throw new PeopleError("Only admins can deactivate people.", 403);
  if (id === ctx.user.id) throw new PeopleError("You cannot deactivate your own account.");
  const person = await db.query.users.findFirst({ where: eq(s.users.id, id), columns: { isBreakGlass: true } });
  if (person?.isBreakGlass) throw new PeopleError("The break-glass admin cannot be deactivated here.");
  await setPersonActive(ctx.user.id, id, false);
}

export async function reactivatePerson(ctx: UserContext, id: string) {
  if (!ctx.has("admin")) throw new PeopleError("Only admins can reactivate people.", 403);
  await setPersonActive(ctx.user.id, id, true);
}

/** People with no manager who are not deactivated (the org chart's roots). */
export async function countOrgRoots() {
  const [r] = await db.select({ n: count() }).from(s.users).where(and(listable(), isNull(s.users.managerId)));
  return r?.n ?? 0;
}
