/**
 * SCIM 2.0 service provider (RFC 7643 / 7644) for Users and Groups, so Okta, Entra ID and other
 * identity providers can provision Lobby. The web route handler is a thin adapter around
 * `handleScimRequest`; everything protocol-shaped lives here and in scim-map.ts.
 */
import { and, asc, count, db, eq, inArray, isNull, ne, or, s, sql, type SQL } from "@lobby/db";
import { audit } from "../audit";
import { randomToken, sha256 } from "../crypto";
import { managerProblem, setPersonActive } from "./index";
import { indexPerson } from "./index-source";
import { parseScimFilter, ScimFilterError, type FilterClause } from "./scim-filter";
import {
  applyGroupPatch,
  applyUserPatch,
  bodyToGroup,
  bodyToUserModel,
  modelToColumns,
  readPatchOps,
  rowToModel,
  SCHEMA,
  ScimError,
  scimErrorBody,
  toScimGroup,
  toScimUser,
  type UserModel,
} from "./scim-map";

export { ScimError } from "./scim-map";

export interface ScimRequest {
  method: string;
  /** Path segments after /api/scim/v2, e.g. ["Users", "<id>"]. */
  segments: string[];
  query: URLSearchParams;
  /** Raw request body text (may be empty). */
  body: string;
  authorization: string | null;
  /** Absolute base URL of the SCIM endpoint, e.g. https://lobby.example.com/api/scim/v2 */
  baseUrl: string;
}

export interface ScimResponse {
  status: number;
  body: unknown | null;
  headers?: Record<string, string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COUNT = 200;

// ---------------------------------------------------------------------------------------------
// Tokens

/** Creates a SCIM bearer token. The raw value is returned once and only its sha256 is stored. */
export async function createScimToken(name: string): Promise<{ id: string; token: string }> {
  const token = `lobby_scim_${randomToken(32)}`;
  const [row] = await db.insert(s.scimTokens).values({ name, tokenHash: sha256(token) }).returning({ id: s.scimTokens.id });
  return { id: row!.id, token };
}

/** Resolves a `Bearer <token>` header to a live (non-revoked) token row and stamps lastUsedAt. */
export async function authenticateScim(authorization: string | null) {
  const m = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
  if (!m) return null;
  const [row] = await db
    .select()
    .from(s.scimTokens)
    .where(and(eq(s.scimTokens.tokenHash, sha256(m[1]!)), isNull(s.scimTokens.revokedAt)))
    .limit(1);
  if (!row) return null;
  await db.update(s.scimTokens).set({ lastUsedAt: new Date() }).where(eq(s.scimTokens.id, row.id));
  return row;
}

// ---------------------------------------------------------------------------------------------
// Dispatcher

export async function handleScimRequest(req: ScimRequest): Promise<ScimResponse> {
  try {
    const token = await authenticateScim(req.authorization);
    if (!token) {
      return {
        status: 401,
        body: scimErrorBody(401, "A valid bearer token is required. Ask a Lobby admin for a SCIM token."),
        headers: { "WWW-Authenticate": 'Bearer realm="Lobby SCIM"' },
      };
    }
    const actor = { tokenId: token.id, tokenName: token.name };
    const [resource, id, ...rest] = req.segments;
    const method = req.method.toUpperCase();
    if (rest.length) throw new ScimError(404, "Not found.");

    switch ((resource ?? "").toLowerCase()) {
      case "serviceproviderconfig":
        if (method !== "GET") throw notAllowed();
        return ok(serviceProviderConfig(req.baseUrl));
      case "resourcetypes":
        if (method !== "GET") throw notAllowed();
        return ok(resourceTypes(req.baseUrl, id));
      case "schemas":
        if (method !== "GET") throw notAllowed();
        return ok(schemas(req.baseUrl, id));
      case "users":
        return await users(req, method, id, actor);
      case "groups":
        return await groupsHandler(req, method, id, actor);
      default:
        throw new ScimError(404, `Unknown SCIM resource "${resource ?? ""}".`);
    }
  } catch (err) {
    if (err instanceof ScimError) return { status: err.status, body: scimErrorBody(err.status, err.message, err.scimType) };
    if (err instanceof ScimFilterError) return { status: 400, body: scimErrorBody(400, err.message, "invalidFilter") };
    console.error("[scim] unexpected error", err);
    return { status: 500, body: scimErrorBody(500, "Something went wrong on our side. The change was not applied.") };
  }
}

const ok = (body: unknown, status = 200): ScimResponse => ({ status, body });
const notAllowed = () => new ScimError(405, "That method is not allowed on this endpoint.");

function parseBody(raw: string): unknown {
  if (!raw.trim()) throw new ScimError(400, "The request body is empty.", "invalidSyntax");
  try {
    return JSON.parse(raw);
  } catch {
    throw new ScimError(400, "The request body is not valid JSON.", "invalidSyntax");
  }
}

function paging(q: URLSearchParams) {
  const startIndex = Math.max(1, Number.parseInt(q.get("startIndex") ?? "1", 10) || 1);
  const rawCount = q.get("count");
  const n = rawCount === null ? 100 : Number.parseInt(rawCount, 10);
  const pageSize = Math.min(Math.max(Number.isFinite(n) ? n : 100, 0), MAX_COUNT);
  return { startIndex, count: pageSize };
}

const listResponse = (resources: unknown[], total: number, startIndex: number) => ({
  schemas: [SCHEMA.list],
  totalResults: total,
  startIndex,
  itemsPerPage: resources.length,
  Resources: resources,
});

const likeEsc = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

function textClause(col: SQL | typeof s.users.email, c: FilterClause): SQL {
  const v = String(c.value ?? "");
  switch (c.op) {
    case "eq":
      return sql`lower(${col}) = ${v.toLowerCase()}`;
    case "ne":
      return sql`(${col} is null or lower(${col}) <> ${v.toLowerCase()})`;
    case "co":
      return sql`${col} ilike ${`%${likeEsc(v)}%`}`;
    case "sw":
      return sql`${col} ilike ${`${likeEsc(v)}%`}`;
    case "ew":
      return sql`${col} ilike ${`%${likeEsc(v)}`}`;
    case "pr":
      return sql`(${col} is not null and ${col} <> '')`;
  }
}

// ---------------------------------------------------------------------------------------------
// Users

type Actor = { tokenId: string; tokenName: string };
type UserRow = typeof s.users.$inferSelect;

/** SCIM never sees or touches the break-glass account. */
const scimVisible = () => eq(s.users.isBreakGlass, false);

function userFilterSql(clauses: FilterClause[]): SQL | undefined {
  const parts = clauses.map((c): SQL => {
    switch (c.attr) {
      case "userName":
      case "email":
        return textClause(sql`${s.users.email}`, c);
      case "externalId":
        return textClause(sql`${s.users.scimId}`, c);
      case "displayName":
        return textClause(sql`${s.users.displayName}`, c);
      case "title":
        return textClause(sql`${s.users.title}`, c);
      case "department":
        return textClause(sql`${s.users.department}`, c);
      case "id":
        if (c.op !== "eq") throw new ScimFilterError("Only eq is supported on id.");
        return UUID.test(String(c.value)) ? eq(s.users.id, String(c.value)) : sql`false`;
      case "active": {
        if (c.op === "pr") return sql`true`;
        const want = String(c.value).toLowerCase() === "true";
        return eq(s.users.status, (c.op === "ne" ? !want : want) ? "active" : "deactivated");
      }
      default:
        throw new ScimFilterError(`Filtering users on "${c.attr}" is not supported.`);
    }
  });
  return parts.length ? and(...parts) : undefined;
}

async function renderUser(row: UserRow, baseUrl: string) {
  const [manager, groups] = await Promise.all([
    row.managerId ? db.query.users.findFirst({ where: eq(s.users.id, row.managerId), columns: { displayName: true } }) : null,
    db
      .select({ id: s.groups.id, displayName: s.groups.displayName })
      .from(s.groupMembers)
      .innerJoin(s.groups, eq(s.groups.id, s.groupMembers.groupId))
      .where(eq(s.groupMembers.userId, row.id))
      .orderBy(asc(s.groups.displayName)),
  ]);
  return toScimUser(row, baseUrl, { managerDisplayName: manager?.displayName, groups });
}

async function loadUser(id: string | undefined): Promise<UserRow> {
  if (!id || !UUID.test(id)) throw new ScimError(404, `User ${id ?? ""} not found.`);
  const row = await db.query.users.findFirst({ where: and(eq(s.users.id, id), scimVisible()) });
  if (!row) throw new ScimError(404, `User ${id} not found.`);
  return row;
}

async function users(req: ScimRequest, method: string, id: string | undefined, actor: Actor): Promise<ScimResponse> {
  if (!id) {
    if (method === "GET") {
      const where = and(scimVisible(), userFilterSql(parseScimFilter(req.query.get("filter"))));
      const { startIndex, count: pageSize } = paging(req.query);
      const [[total], rows] = await Promise.all([
        db.select({ n: count() }).from(s.users).where(where),
        pageSize === 0
          ? Promise.resolve([] as UserRow[])
          : db.select().from(s.users).where(where).orderBy(asc(s.users.createdAt), asc(s.users.id)).limit(pageSize).offset(startIndex - 1),
      ]);
      const resources = await Promise.all(rows.map((r) => renderUser(r, req.baseUrl)));
      return ok(listResponse(resources, total?.n ?? 0, startIndex));
    }
    if (method === "POST") return createUser(req, actor);
    throw notAllowed();
  }

  if (method === "GET") return ok(await renderUser(await loadUser(id), req.baseUrl));
  if (method === "PUT") {
    const row = await loadUser(id);
    const model = bodyToUserModel(parseBody(req.body), rowToModel(row));
    return ok(await saveUser(row, model, req.baseUrl, actor, "scim.user_replaced"));
  }
  if (method === "PATCH") {
    const row = await loadUser(id);
    const model = applyUserPatch(rowToModel(row), readPatchOps(parseBody(req.body)));
    return ok(await saveUser(row, model, req.baseUrl, actor, "scim.user_patched"));
  }
  if (method === "DELETE") {
    const row = await loadUser(id);
    // Never hard-delete: their tickets, pages and history stay attributed. Deactivate and sign out.
    await setPersonActive(null, row.id, false, "scim");
    await audit(null, "scim.user_deleted", { type: "user", id: row.id }, { token: actor.tokenName, email: row.email });
    return { status: 204, body: null };
  }
  throw notAllowed();
}

async function assertEmailFree(email: string, exceptId?: string) {
  const clash = await db.query.users.findFirst({
    where: and(eq(sql`lower(${s.users.email})`, email.toLowerCase()), exceptId ? ne(s.users.id, exceptId) : undefined),
    columns: { id: true },
  });
  if (clash) throw new ScimError(409, `A user with userName ${email} already exists.`, "uniqueness");
}

async function assertExternalIdFree(externalId: string | null, exceptId?: string) {
  if (!externalId) return;
  const clash = await db.query.users.findFirst({
    where: and(eq(s.users.scimId, externalId), exceptId ? ne(s.users.id, exceptId) : undefined),
    columns: { id: true },
  });
  if (clash) throw new ScimError(409, `Another user already has externalId ${externalId}.`, "uniqueness");
}

/** Resolves a manager reference; an unknown manager is refused so the IdP can retry once it exists. */
async function resolveManager(personId: string | null, managerId: string | null): Promise<string | null> {
  if (!managerId) return null;
  if (!UUID.test(managerId)) throw new ScimError(400, `manager.value "${managerId}" is not a Lobby user id.`, "invalidValue");
  if (personId) {
    const problem = await managerProblem(personId, managerId);
    if (problem) throw new ScimError(400, `manager.value: ${problem}`, "invalidValue");
  } else {
    const m = await db.query.users.findFirst({ where: and(eq(s.users.id, managerId), eq(s.users.status, "active")), columns: { id: true } });
    if (!m) throw new ScimError(400, `manager.value "${managerId}" is not an active Lobby user.`, "invalidValue");
  }
  return managerId;
}

async function createUser(req: ScimRequest, actor: Actor): Promise<ScimResponse> {
  const model = bodyToUserModel(parseBody(req.body));
  await assertEmailFree(model.userName);
  await assertExternalIdFree(model.externalId);
  const managerId = await resolveManager(null, model.managerId);
  const [row] = await db
    .insert(s.users)
    .values({ ...modelToColumns({ ...model, managerId }), status: model.active ? "active" : "deactivated", source: "scim" })
    .returning();
  await audit(null, "scim.user_created", { type: "user", id: row!.id }, { token: actor.tokenName, email: row!.email });
  await indexPerson(row!.id);
  return { status: 201, body: await renderUser(row!, req.baseUrl), headers: { Location: `${req.baseUrl}/Users/${row!.id}` } };
}

async function saveUser(row: UserRow, model: UserModel, baseUrl: string, actor: Actor, action: string) {
  if (model.userName !== row.email) await assertEmailFree(model.userName, row.id);
  if (model.externalId !== row.scimId) await assertExternalIdFree(model.externalId, row.id);
  const managerId = model.managerId === row.managerId ? row.managerId : await resolveManager(row.id, model.managerId);
  const cols = modelToColumns({ ...model, managerId });
  const changed = Object.fromEntries(Object.entries(cols).filter(([k, v]) => (row as Record<string, unknown>)[k] !== v));
  if (Object.keys(changed).length || row.source !== "scim") {
    await db.update(s.users).set({ ...changed, source: "scim" }).where(eq(s.users.id, row.id));
  }
  const wasActive = row.status === "active";
  if (wasActive !== model.active) {
    await setPersonActive(null, row.id, model.active, "scim");
  } else {
    await indexPerson(row.id);
  }
  if (Object.keys(changed).length || wasActive !== model.active) {
    await audit(null, action, { type: "user", id: row.id }, {
      token: actor.tokenName,
      fields: Object.keys(changed),
      ...(wasActive !== model.active ? { active: model.active } : {}),
    });
  }
  const fresh = await db.query.users.findFirst({ where: eq(s.users.id, row.id) });
  return renderUser(fresh!, baseUrl);
}

// ---------------------------------------------------------------------------------------------
// Groups

type GroupRow = typeof s.groups.$inferSelect;

function groupFilterSql(clauses: FilterClause[]): SQL | undefined {
  const parts = clauses.map((c): SQL => {
    switch (c.attr) {
      case "displayName":
        return or(textClause(sql`${s.groups.displayName}`, c), textClause(sql`${s.groups.name}`, c))!;
      case "externalId":
        return textClause(sql`${s.groups.scimId}`, c);
      case "id":
        if (c.op !== "eq") throw new ScimFilterError("Only eq is supported on id.");
        return UUID.test(String(c.value)) ? eq(s.groups.id, String(c.value)) : sql`false`;
      case "member":
        if (c.op !== "eq" || !UUID.test(String(c.value))) return sql`false`;
        return sql`exists (select 1 from group_members gm where gm.group_id = ${s.groups.id} and gm.user_id = ${String(c.value)})`;
      default:
        throw new ScimFilterError(`Filtering groups on "${c.attr}" is not supported.`);
    }
  });
  return parts.length ? and(...parts) : undefined;
}

const wantsMembers = (q: URLSearchParams) => {
  const excluded = (q.get("excludedAttributes") ?? "").toLowerCase().split(",").map((x) => x.trim());
  if (excluded.includes("members")) return false;
  const attrs = q.get("attributes");
  if (attrs) return attrs.toLowerCase().split(",").map((x) => x.trim()).includes("members");
  return true;
};

async function groupMembersOf(groupIds: string[]) {
  if (!groupIds.length) return new Map<string, { id: string; displayName: string }[]>();
  const rows = await db
    .select({ groupId: s.groupMembers.groupId, id: s.users.id, displayName: s.users.displayName })
    .from(s.groupMembers)
    .innerJoin(s.users, eq(s.users.id, s.groupMembers.userId))
    .where(and(inArray(s.groupMembers.groupId, groupIds), eq(s.users.isBreakGlass, false)))
    .orderBy(asc(s.users.displayName));
  const map = new Map<string, { id: string; displayName: string }[]>();
  for (const r of rows) {
    const list = map.get(r.groupId) ?? [];
    list.push({ id: r.id, displayName: r.displayName });
    map.set(r.groupId, list);
  }
  return map;
}

async function loadGroup(id: string | undefined): Promise<GroupRow> {
  if (!id || !UUID.test(id)) throw new ScimError(404, `Group ${id ?? ""} not found.`);
  const row = await db.query.groups.findFirst({ where: eq(s.groups.id, id) });
  if (!row) throw new ScimError(404, `Group ${id} not found.`);
  return row;
}

async function renderGroup(g: GroupRow, baseUrl: string, includeMembers = true) {
  const members = includeMembers ? ((await groupMembersOf([g.id])).get(g.id) ?? []) : undefined;
  return toScimGroup(g, baseUrl, members);
}

/** Refuses member ids that are not Lobby users, naming them, instead of silently dropping them. */
async function assertMembersExist(ids: string[]) {
  if (!ids.length) return;
  const bad = ids.filter((id) => !UUID.test(id));
  const valid = ids.filter((id) => UUID.test(id));
  const found = valid.length
    ? await db.select({ id: s.users.id }).from(s.users).where(and(inArray(s.users.id, valid), eq(s.users.isBreakGlass, false)))
    : [];
  const known = new Set(found.map((f) => f.id));
  const missing = [...bad, ...valid.filter((id) => !known.has(id))];
  if (missing.length) throw new ScimError(400, `These members are not Lobby users: ${missing.join(", ")}.`, "invalidValue");
}

async function assertGroupNameFree(displayName: string, exceptId?: string) {
  const clash = await db.query.groups.findFirst({
    where: and(
      or(eq(sql`lower(${s.groups.name})`, displayName.toLowerCase()), eq(sql`lower(${s.groups.displayName})`, displayName.toLowerCase())),
      exceptId ? ne(s.groups.id, exceptId) : undefined,
    ),
    columns: { id: true },
  });
  if (clash) throw new ScimError(409, `A group named ${displayName} already exists.`, "uniqueness");
}

async function groupsHandler(req: ScimRequest, method: string, id: string | undefined, actor: Actor): Promise<ScimResponse> {
  if (!id) {
    if (method === "GET") {
      const where = groupFilterSql(parseScimFilter(req.query.get("filter")));
      const { startIndex, count: pageSize } = paging(req.query);
      const [[total], rows] = await Promise.all([
        db.select({ n: count() }).from(s.groups).where(where),
        pageSize === 0
          ? Promise.resolve([] as GroupRow[])
          : db.select().from(s.groups).where(where).orderBy(asc(s.groups.createdAt), asc(s.groups.id)).limit(pageSize).offset(startIndex - 1),
      ]);
      const include = wantsMembers(req.query);
      const members = include ? await groupMembersOf(rows.map((r) => r.id)) : null;
      return ok(listResponse(rows.map((g) => toScimGroup(g, req.baseUrl, members ? (members.get(g.id) ?? []) : undefined)), total?.n ?? 0, startIndex));
    }
    if (method === "POST") {
      const g = bodyToGroup(parseBody(req.body));
      await assertGroupNameFree(g.displayName);
      await assertMembersExist(g.members);
      const [row] = await db.insert(s.groups).values({ name: g.displayName, displayName: g.displayName, scimId: g.externalId, source: "scim" }).returning();
      if (g.members.length) {
        await db.insert(s.groupMembers).values(g.members.map((userId) => ({ groupId: row!.id, userId }))).onConflictDoNothing();
      }
      await audit(null, "scim.group_created", { type: "group", id: row!.id }, { token: actor.tokenName, name: g.displayName, members: g.members.length });
      return { status: 201, body: await renderGroup(row!, req.baseUrl), headers: { Location: `${req.baseUrl}/Groups/${row!.id}` } };
    }
    throw notAllowed();
  }

  if (method === "GET") return ok(await renderGroup(await loadGroup(id), req.baseUrl, wantsMembers(req.query)));

  if (method === "PUT") {
    const row = await loadGroup(id);
    const g = bodyToGroup(parseBody(req.body));
    if (g.displayName !== row.displayName) await assertGroupNameFree(g.displayName, row.id);
    await assertMembersExist(g.members);
    await db.transaction(async (tx) => {
      await tx.update(s.groups).set({ displayName: g.displayName, scimId: g.externalId, source: "scim" }).where(eq(s.groups.id, row.id));
      await tx.delete(s.groupMembers).where(eq(s.groupMembers.groupId, row.id));
      if (g.members.length) await tx.insert(s.groupMembers).values(g.members.map((userId) => ({ groupId: row.id, userId }))).onConflictDoNothing();
    });
    await audit(null, "scim.group_replaced", { type: "group", id: row.id }, { token: actor.tokenName, members: g.members.length });
    return ok(await renderGroup((await loadGroup(row.id)), req.baseUrl));
  }

  if (method === "PATCH") {
    const row = await loadGroup(id);
    const change = applyGroupPatch(readPatchOps(parseBody(req.body)));
    if (change.displayName && change.displayName !== row.displayName) await assertGroupNameFree(change.displayName, row.id);
    await assertMembersExist([...(change.replaceMembers ?? []), ...change.addMembers]);
    await db.transaction(async (tx) => {
      const set: Partial<typeof s.groups.$inferInsert> = {};
      if (change.displayName) set.displayName = change.displayName;
      if (change.externalId !== undefined) set.scimId = change.externalId;
      if (Object.keys(set).length) await tx.update(s.groups).set(set).where(eq(s.groups.id, row.id));
      if (change.replaceMembers) {
        await tx.delete(s.groupMembers).where(eq(s.groupMembers.groupId, row.id));
        if (change.replaceMembers.length)
          await tx.insert(s.groupMembers).values(change.replaceMembers.map((userId) => ({ groupId: row.id, userId }))).onConflictDoNothing();
      }
      if (change.addMembers.length)
        await tx.insert(s.groupMembers).values(change.addMembers.map((userId) => ({ groupId: row.id, userId }))).onConflictDoNothing();
      const removable = change.removeMembers.filter((x) => UUID.test(x));
      if (removable.length)
        await tx.delete(s.groupMembers).where(and(eq(s.groupMembers.groupId, row.id), inArray(s.groupMembers.userId, removable)));
    });
    await audit(null, "scim.group_patched", { type: "group", id: row.id }, {
      token: actor.tokenName,
      added: change.addMembers.length,
      removed: change.removeMembers.length,
      replaced: change.replaceMembers?.length ?? null,
    });
    // Entra and Okta accept 204 or 200 with the resource; returning it saves them a GET.
    return ok(await renderGroup(await loadGroup(row.id), req.baseUrl, wantsMembers(req.query)));
  }

  if (method === "DELETE") {
    const row = await loadGroup(id);
    await db.delete(s.groups).where(eq(s.groups.id, row.id));
    await audit(null, "scim.group_deleted", { type: "group", id: row.id }, { token: actor.tokenName, name: row.name });
    return { status: 204, body: null };
  }
  throw notAllowed();
}

// ---------------------------------------------------------------------------------------------
// Discovery

function serviceProviderConfig(baseUrl: string) {
  return {
    schemas: [SCHEMA.spc],
    documentationUri: "https://datatracker.ietf.org/doc/html/rfc7644",
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: MAX_COUNT },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: "oauthbearertoken",
        name: "Bearer token",
        description: "A long-lived token created by a Lobby admin, sent as Authorization: Bearer <token>.",
        primary: true,
      },
    ],
    meta: { resourceType: "ServiceProviderConfig", location: `${baseUrl}/ServiceProviderConfig` },
  };
}

function resourceTypeDefs(baseUrl: string) {
  return [
    {
      schemas: [SCHEMA.resourceType],
      id: "User",
      name: "User",
      endpoint: "/Users",
      description: "A person who can sign in to Lobby",
      schema: SCHEMA.user,
      schemaExtensions: [
        { schema: SCHEMA.enterprise, required: false },
        { schema: SCHEMA.lobby, required: false },
      ],
      meta: { resourceType: "ResourceType", location: `${baseUrl}/ResourceTypes/User` },
    },
    {
      schemas: [SCHEMA.resourceType],
      id: "Group",
      name: "Group",
      endpoint: "/Groups",
      description: "A group of people, used for audiences and roles",
      schema: SCHEMA.group,
      meta: { resourceType: "ResourceType", location: `${baseUrl}/ResourceTypes/Group` },
    },
  ];
}

function resourceTypes(baseUrl: string, id?: string) {
  const all = resourceTypeDefs(baseUrl);
  if (id) {
    const one = all.find((r) => r.id.toLowerCase() === id.toLowerCase());
    if (!one) throw new ScimError(404, `Resource type ${id} not found.`);
    return one;
  }
  return listResponse(all, all.length, 1);
}

type AttrDef = {
  name: string;
  type: "string" | "boolean" | "complex" | "reference" | "dateTime";
  multiValued?: boolean;
  required?: boolean;
  mutability?: "readOnly" | "readWrite" | "immutable" | "writeOnly";
  uniqueness?: "none" | "server" | "global";
  description?: string;
  subAttributes?: AttrDef[];
  referenceTypes?: string[];
};

const attr = (a: AttrDef): Record<string, unknown> => ({
  multiValued: false,
  required: false,
  caseExact: false,
  mutability: "readWrite",
  returned: "default",
  uniqueness: "none",
  ...a,
  ...(a.subAttributes ? { subAttributes: a.subAttributes.map(attr) } : {}),
});

function schemaDefs(baseUrl: string) {
  const multi = (name: string, extra: AttrDef[]) =>
    attr({
      name,
      type: "complex",
      multiValued: true,
      subAttributes: [{ name: "value", type: "string" }, { name: "type", type: "string" }, { name: "primary", type: "boolean" }, ...extra],
    });
  const defs = [
    {
      id: SCHEMA.user,
      name: "User",
      description: "Lobby user",
      attributes: [
        attr({ name: "userName", type: "string", required: true, uniqueness: "server", description: "The work email address." }),
        attr({ name: "externalId", type: "string", description: "The identity provider's own id for this person." }),
        attr({
          name: "name",
          type: "complex",
          subAttributes: [
            { name: "givenName", type: "string" },
            { name: "familyName", type: "string" },
            { name: "formatted", type: "string", mutability: "readOnly" },
          ],
        }),
        attr({ name: "displayName", type: "string" }),
        attr({ name: "title", type: "string" }),
        attr({ name: "timezone", type: "string" }),
        attr({ name: "active", type: "boolean" }),
        multi("emails", []),
        multi("phoneNumbers", []),
        attr({
          name: "addresses",
          type: "complex",
          multiValued: true,
          subAttributes: [{ name: "type", type: "string" }, { name: "locality", type: "string" }, { name: "primary", type: "boolean" }],
        }),
        attr({
          name: "groups",
          type: "complex",
          multiValued: true,
          mutability: "readOnly",
          subAttributes: [{ name: "value", type: "string" }, { name: "display", type: "string" }, { name: "$ref", type: "reference", referenceTypes: ["Group"] }],
        }),
      ],
    },
    {
      id: SCHEMA.enterprise,
      name: "EnterpriseUser",
      description: "Enterprise user extension",
      attributes: [
        attr({ name: "department", type: "string" }),
        attr({ name: "employeeNumber", type: "string", description: "Accepted and ignored." }),
        attr({
          name: "manager",
          type: "complex",
          subAttributes: [
            { name: "value", type: "string", description: "The Lobby id of the manager." },
            { name: "$ref", type: "reference", referenceTypes: ["User"] },
            { name: "displayName", type: "string", mutability: "readOnly" },
          ],
        }),
      ],
    },
    {
      id: SCHEMA.lobby,
      name: "LobbyUser",
      description: "Lobby people fields",
      attributes: [
        attr({ name: "startDate", type: "string", description: "First day, YYYY-MM-DD." }),
        attr({ name: "endDate", type: "string", description: "Last day, YYYY-MM-DD." }),
        attr({ name: "pronouns", type: "string" }),
        attr({ name: "location", type: "string", description: "Office or city, used when addresses are not sent." }),
      ],
    },
    {
      id: SCHEMA.group,
      name: "Group",
      description: "Lobby group",
      attributes: [
        attr({ name: "displayName", type: "string", required: true, uniqueness: "server" }),
        attr({ name: "externalId", type: "string" }),
        attr({
          name: "members",
          type: "complex",
          multiValued: true,
          subAttributes: [{ name: "value", type: "string", mutability: "immutable" }, { name: "display", type: "string", mutability: "readOnly" }, { name: "$ref", type: "reference", referenceTypes: ["User"], mutability: "immutable" }],
        }),
      ],
    },
  ];
  return defs.map((d) => ({ schemas: [SCHEMA.schema], ...d, meta: { resourceType: "Schema", location: `${baseUrl}/Schemas/${d.id}` } }));
}

function schemas(baseUrl: string, id?: string) {
  const all = schemaDefs(baseUrl);
  if (id) {
    const one = all.find((d) => d.id.toLowerCase() === id.toLowerCase());
    if (!one) throw new ScimError(404, `Schema ${id} not found.`);
    return one;
  }
  return listResponse(all, all.length, 1);
}

