/**
 * Pure SCIM 2.0 mapping (RFC 7643) between Lobby users/groups and SCIM resources, plus PATCH
 * evaluation (RFC 7644 section 3.5.2) including the quirks of Microsoft Entra ID and Okta.
 * No database access here, so all of it is unit tested.
 *
 * Identifier mapping:
 *  - SCIM `id`          = users.id / groups.id (our uuid).
 *  - SCIM `externalId`  = users.scim_id / groups.scim_id (the IdP's own identifier). users.external_id
 *                         is the OIDC `sub` and is rewritten at every login, so SCIM never touches it.
 *  - SCIM `userName`    = users.email (lower-cased).
 */

export const SCHEMA = {
  user: "urn:ietf:params:scim:schemas:core:2.0:User",
  group: "urn:ietf:params:scim:schemas:core:2.0:Group",
  enterprise: "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
  lobby: "urn:lobby:params:scim:schemas:extension:2.0:User",
  list: "urn:ietf:params:scim:api:messages:2.0:ListResponse",
  patch: "urn:ietf:params:scim:api:messages:2.0:PatchOp",
  error: "urn:ietf:params:scim:api:messages:2.0:Error",
  spc: "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig",
  resourceType: "urn:ietf:params:scim:schemas:core:2.0:ResourceType",
  schema: "urn:ietf:params:scim:schemas:core:2.0:Schema",
} as const;

export type ScimType =
  | "invalidFilter"
  | "tooMany"
  | "uniqueness"
  | "mutability"
  | "invalidSyntax"
  | "invalidPath"
  | "noTarget"
  | "invalidValue"
  | "invalidVers"
  | "sensitive";

/** An error that becomes a SCIM error response. */
export class ScimError extends Error {
  constructor(readonly status: number, message: string, readonly scimType?: ScimType) {
    super(message);
  }
}

export function scimErrorBody(status: number, detail: string, scimType?: ScimType) {
  return { schemas: [SCHEMA.error], status: String(status), ...(scimType ? { scimType } : {}), detail };
}

// ---------------------------------------------------------------------------------------------
// Users

/** The SCIM-managed slice of a Lobby user. `undefined` = not mentioned, `null` = cleared. */
export interface UserModel {
  userName: string;
  externalId: string | null;
  givenName: string;
  familyName: string;
  displayName: string;
  title: string | null;
  department: string | null;
  location: string | null;
  phone: string | null;
  timezone: string | null;
  /** Our user id of the manager, as sent in enterprise `manager.value`. */
  managerId: string | null;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  pronouns: string | null;
}

/** Row shape we need to render a SCIM user (a subset of the users table). */
export interface UserRowLike {
  id: string;
  email: string;
  scimId: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  title: string | null;
  department: string | null;
  location: string | null;
  phone: string | null;
  timezone: string | null;
  managerId: string | null;
  status: "active" | "deactivated";
  startDate: string | null;
  endDate: string | null;
  pronouns: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function rowToModel(r: UserRowLike): UserModel {
  return {
    userName: r.email,
    externalId: r.scimId,
    givenName: r.firstName,
    familyName: r.lastName,
    displayName: r.displayName,
    title: r.title,
    department: r.department,
    location: r.location,
    phone: r.phone,
    timezone: r.timezone,
    managerId: r.managerId,
    active: r.status === "active",
    startDate: r.startDate,
    endDate: r.endDate,
    pronouns: r.pronouns,
  };
}

export function toScimUser(
  r: UserRowLike,
  baseUrl: string,
  extra: { managerDisplayName?: string | null; groups?: { id: string; displayName: string }[] } = {},
) {
  const enterprise: Record<string, unknown> = {};
  if (r.department) enterprise.department = r.department;
  if (r.managerId)
    enterprise.manager = {
      value: r.managerId,
      $ref: `${baseUrl}/Users/${r.managerId}`,
      ...(extra.managerDisplayName ? { displayName: extra.managerDisplayName } : {}),
    };
  const lobby: Record<string, unknown> = {};
  if (r.startDate) lobby.startDate = r.startDate;
  if (r.endDate) lobby.endDate = r.endDate;
  if (r.pronouns) lobby.pronouns = r.pronouns;

  return {
    schemas: [SCHEMA.user, SCHEMA.enterprise, ...(Object.keys(lobby).length ? [SCHEMA.lobby] : [])],
    id: r.id,
    ...(r.scimId ? { externalId: r.scimId } : {}),
    userName: r.email,
    name: {
      givenName: r.firstName,
      familyName: r.lastName,
      formatted: `${r.firstName} ${r.lastName}`.trim() || r.displayName,
    },
    displayName: r.displayName,
    ...(r.title ? { title: r.title } : {}),
    ...(r.timezone ? { timezone: r.timezone } : {}),
    active: r.status === "active",
    emails: [{ value: r.email, type: "work", primary: true }],
    ...(r.phone ? { phoneNumbers: [{ value: r.phone, type: "work" }] } : {}),
    ...(r.location ? { addresses: [{ type: "work", locality: r.location, primary: true }] } : {}),
    ...(extra.groups ? { groups: extra.groups.map((g) => ({ value: g.id, display: g.displayName, $ref: `${baseUrl}/Groups/${g.id}` })) } : {}),
    [SCHEMA.enterprise]: enterprise,
    ...(Object.keys(lobby).length ? { [SCHEMA.lobby]: lobby } : {}),
    meta: {
      resourceType: "User",
      created: r.createdAt.toISOString(),
      lastModified: r.updatedAt.toISOString(),
      location: `${baseUrl}/Users/${r.id}`,
    },
  };
}

type Json = unknown;
const isObj = (v: Json): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Entra sends booleans as "True"/"False" strings. */
export function toBool(v: Json, attr = "active"): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string" && /^(true|false)$/i.test(v.trim())) return v.trim().toLowerCase() === "true";
  throw new ScimError(400, `"${attr}" must be true or false.`, "invalidValue");
}

const str = (v: Json): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() === "" ? null : v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (isObj(v) && "value" in v) return str(v.value);
  return null;
};

/** Picks the work (else primary, else first) entry of a multi-valued attribute. */
function pickTyped(list: Json, type = "work"): Record<string, Json> | null {
  if (!Array.isArray(list)) return null;
  const items = list.filter(isObj);
  return (
    items.find((i) => typeof i.type === "string" && i.type.toLowerCase() === type) ??
    items.find((i) => i.primary === true || i.primary === "True" || i.primary === "true") ??
    items[0] ??
    null
  );
}

const dateOnly = (v: Json): string | null => {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) throw new ScimError(400, `"${s}" is not a date.`, "invalidValue");
  return m[1]!;
};

const lowerKeys = (o: Record<string, Json>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));

/**
 * Builds the full model from a POST or PUT body. Attributes absent from the body are cleared,
 * except the enterprise and Lobby extension fields, which are only replaced when that extension
 * appears in the body. Okta and Entra often omit extensions they are not mapped to send, and
 * wiping managers set by CSV import in that case would be surprising.
 */
export function bodyToUserModel(body: Json, current?: UserModel): UserModel {
  if (!isObj(body)) throw new ScimError(400, "The request body must be a JSON object.", "invalidSyntax");
  const b = lowerKeys(body);
  const userName = str(b.username);
  const workEmail = str(pickTyped(b.emails)?.value);
  const email = (userName && userName.includes("@") ? userName : workEmail ?? userName)?.toLowerCase();
  if (!email) throw new ScimError(400, "userName is required.", "invalidValue");
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw new ScimError(400, `"${email}" is not an email address. Lobby uses the work email as userName.`, "invalidValue");

  const name = isObj(b.name) ? lowerKeys(b.name) : {};
  let givenName = str(name.givenname) ?? "";
  let familyName = str(name.familyname) ?? "";
  const displayName = str(b.displayname) ?? str(name.formatted) ?? (`${givenName} ${familyName}`.trim() || email.split("@")[0]!);
  if (!givenName && !familyName) {
    const parts = displayName.split(/\s+/);
    givenName = parts[0] ?? "";
    familyName = parts.slice(1).join(" ");
  }

  const ent = findExtension(body, SCHEMA.enterprise);
  const lob = findExtension(body, SCHEMA.lobby);
  const base = current ?? emptyModel(email);

  return {
    userName: email,
    externalId: str(b.externalid),
    givenName,
    familyName,
    displayName,
    title: str(b.title),
    department: ent ? str(ent.department) : base.department,
    location: str(pickTyped(b.addresses)?.locality) ?? (lob && "location" in lob ? str(lob.location) : null),
    phone: str(pickTyped(b.phonenumbers)?.value),
    timezone: str(b.timezone),
    managerId: ent ? (isObj(ent.manager) ? str(ent.manager.value) : str(ent.manager)) : base.managerId,
    active: b.active === undefined ? true : toBool(b.active),
    startDate: lob ? dateOnly(lob.startdate) : base.startDate,
    endDate: lob ? dateOnly(lob.enddate) : base.endDate,
    pronouns: lob ? str(lob.pronouns) : base.pronouns,
  };
}

function emptyModel(userName: string): UserModel {
  return {
    userName,
    externalId: null,
    givenName: "",
    familyName: "",
    displayName: userName,
    title: null,
    department: null,
    location: null,
    phone: null,
    timezone: null,
    managerId: null,
    active: true,
    startDate: null,
    endDate: null,
    pronouns: null,
  };
}

/** Finds an extension object by URN, case-insensitively, with lower-cased keys. */
function findExtension(body: Record<string, Json>, urn: string): Record<string, Json> | null {
  for (const [k, v] of Object.entries(body)) if (k.toLowerCase() === urn.toLowerCase() && isObj(v)) return lowerKeys(v);
  return null;
}

export interface PatchOperation {
  op: string;
  path?: string;
  value?: Json;
}

export function readPatchOps(body: Json): PatchOperation[] {
  if (!isObj(body)) throw new ScimError(400, "The request body must be a JSON object.", "invalidSyntax");
  const ops = body.Operations ?? body.operations;
  if (!Array.isArray(ops) || !ops.length) throw new ScimError(400, "A PATCH needs a non-empty Operations list.", "invalidSyntax");
  return ops.map((o) => {
    if (!isObj(o) || typeof o.op !== "string") throw new ScimError(400, "Every operation needs an op.", "invalidSyntax");
    const op = o.op.toLowerCase();
    if (!["add", "replace", "remove"].includes(op)) throw new ScimError(400, `Unknown op "${o.op}".`, "invalidSyntax");
    return { op, path: typeof o.path === "string" && o.path.trim() ? o.path.trim() : undefined, value: o.value };
  });
}

const ENT_PREFIX = `${SCHEMA.enterprise.toLowerCase()}:`;
const LOBBY_PREFIX = `${SCHEMA.lobby.toLowerCase()}:`;
const CORE_PREFIX = `${SCHEMA.user.toLowerCase()}:`;

/** Normalises an attribute path: lower-case, schema URNs replaced by short prefixes, filter quotes unified. */
export function normalisePath(path: string): string {
  let p = path.trim().replace(/'/g, '"').replace(/\s+/g, " ");
  const lower = p.toLowerCase();
  if (lower.startsWith(ENT_PREFIX)) p = `enterprise:${p.slice(ENT_PREFIX.length)}`;
  else if (lower.startsWith(LOBBY_PREFIX)) p = `lobby:${p.slice(LOBBY_PREFIX.length)}`;
  else if (lower.startsWith(CORE_PREFIX)) p = p.slice(CORE_PREFIX.length);
  return p.toLowerCase().replace(/\[\s*/g, "[").replace(/\s*\]/g, "]");
}

/**
 * Applies PATCH operations to a user model and returns the new model. Unknown attributes are
 * ignored (RFC 7644 lets a provider ignore attributes it does not support), and unknown paths with
 * filters raise `invalidPath`.
 */
export function applyUserPatch(current: UserModel, ops: PatchOperation[]): UserModel {
  const next: UserModel = { ...current };
  for (const op of ops) {
    if (op.path) {
      setUserPath(next, normalisePath(op.path), op.op === "remove" ? null : op.value, op.op);
    } else {
      if (op.op === "remove") throw new ScimError(400, "A remove operation needs a path.", "noTarget");
      if (!isObj(op.value)) throw new ScimError(400, "A path-less operation needs an object value.", "invalidValue");
      for (const [key, value] of Object.entries(op.value)) {
        const k = key.toLowerCase();
        // An extension URN as the key with an object value: {"urn:...:enterprise:2.0:User": {department: "x"}}
        if ((k === SCHEMA.enterprise.toLowerCase() || k === SCHEMA.lobby.toLowerCase()) && isObj(value)) {
          for (const [sub, v] of Object.entries(value)) setUserPath(next, normalisePath(`${key}:${sub}`), v, op.op);
        } else if (k === "name" && isObj(value)) {
          for (const [sub, v] of Object.entries(value)) setUserPath(next, `name.${sub.toLowerCase()}`, v, op.op);
        } else {
          setUserPath(next, normalisePath(key), value, op.op);
        }
      }
    }
  }
  return next;
}

function setUserPath(m: UserModel, path: string, value: Json, op: string) {
  const remove = op === "remove";
  switch (path) {
    case "username": {
      const v = str(value)?.toLowerCase();
      if (remove || !v) throw new ScimError(400, "userName cannot be removed.", "mutability");
      m.userName = v;
      return;
    }
    case "externalid":
      m.externalId = str(value);
      return;
    case "displayname":
      if (str(value)) m.displayName = str(value)!;
      return;
    case "name.givenname":
      m.givenName = str(value) ?? "";
      return;
    case "name.familyname":
      m.familyName = str(value) ?? "";
      return;
    case "name.formatted":
      return;
    case "name":
      if (isObj(value)) {
        const n = lowerKeys(value);
        if ("givenname" in n) m.givenName = str(n.givenname) ?? "";
        if ("familyname" in n) m.familyName = str(n.familyname) ?? "";
      } else if (remove) {
        m.givenName = "";
        m.familyName = "";
      }
      return;
    case "title":
      m.title = str(value);
      return;
    case "timezone":
      m.timezone = str(value);
      return;
    case "active":
      if (remove) return;
      m.active = toBool(value);
      return;
    case "emails":
    case 'emails[type eq "work"].value':
    case "emails[primary eq true].value":
    case "emails.value": {
      if (remove) return; // the work email is the userName; it cannot be cleared
      const v = path === "emails" ? str(pickTyped(value)?.value) : str(value);
      if (v && /^[^\s@]+@[^\s@]+$/.test(v)) m.userName = v.toLowerCase();
      return;
    }
    case "phonenumbers":
      m.phone = remove ? null : str(pickTyped(value)?.value);
      return;
    case 'phonenumbers[type eq "work"].value':
    case 'phonenumbers[type eq "mobile"].value':
    case "phonenumbers.value":
      m.phone = str(value);
      return;
    case "addresses":
      m.location = remove ? null : str(pickTyped(value)?.locality);
      return;
    case 'addresses[type eq "work"].locality':
    case "addresses.locality":
      m.location = str(value);
      return;
    case "enterprise:department":
      m.department = str(value);
      return;
    case "enterprise:manager":
    case "enterprise:manager.value":
      m.managerId = remove ? null : str(value);
      return;
    case "lobby:startdate":
      m.startDate = remove ? null : dateOnly(value);
      return;
    case "lobby:enddate":
      m.endDate = remove ? null : dateOnly(value);
      return;
    case "lobby:pronouns":
      m.pronouns = str(value);
      return;
    case "lobby:location":
      m.location = str(value);
      return;
    default:
      // Unsupported but well-formed attributes (employeeNumber, costCenter, preferredLanguage, ...)
      // are ignored. A filter we cannot evaluate is reported, so a client never believes a write landed.
      if (path.includes("[") && !/^(emails|phonenumbers|addresses|groups|roles|entitlements|ims|photos|x509certificates)\[/.test(path)) {
        throw new ScimError(400, `The path "${path}" is not supported.`, "invalidPath");
      }
      return;
  }
}

/** Model -> users table columns. */
export function modelToColumns(m: UserModel) {
  return {
    email: m.userName,
    scimId: m.externalId,
    firstName: m.givenName,
    lastName: m.familyName,
    displayName: m.displayName || `${m.givenName} ${m.familyName}`.trim() || m.userName,
    title: m.title,
    department: m.department,
    location: m.location,
    phone: m.phone,
    timezone: m.timezone,
    managerId: m.managerId,
    startDate: m.startDate,
    endDate: m.endDate,
    pronouns: m.pronouns,
  };
}

// ---------------------------------------------------------------------------------------------
// Groups

export interface GroupRowLike {
  id: string;
  name: string;
  displayName: string;
  scimId: string | null;
  createdAt: Date;
}

export function toScimGroup(g: GroupRowLike, baseUrl: string, members?: { id: string; displayName: string }[]) {
  return {
    schemas: [SCHEMA.group],
    id: g.id,
    ...(g.scimId ? { externalId: g.scimId } : {}),
    displayName: g.displayName,
    ...(members ? { members: members.map((m) => ({ value: m.id, display: m.displayName, $ref: `${baseUrl}/Users/${m.id}`, type: "User" })) } : {}),
    meta: {
      resourceType: "Group",
      created: g.createdAt.toISOString(),
      lastModified: g.createdAt.toISOString(),
      location: `${baseUrl}/Groups/${g.id}`,
    },
  };
}

export interface GroupChange {
  displayName?: string;
  externalId?: string | null;
  /** When set, membership becomes exactly this list. */
  replaceMembers?: string[];
  addMembers: string[];
  removeMembers: string[];
}

const memberIds = (v: Json): string[] => {
  const list = Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
  return list.map((i) => str(isObj(i) ? i.value : i)).filter((x): x is string => !!x);
};

export function bodyToGroup(body: Json): { displayName: string; externalId: string | null; members: string[] } {
  if (!isObj(body)) throw new ScimError(400, "The request body must be a JSON object.", "invalidSyntax");
  const b = lowerKeys(body);
  const displayName = str(b.displayname);
  if (!displayName) throw new ScimError(400, "displayName is required.", "invalidValue");
  return { displayName, externalId: str(b.externalid), members: memberIds(b.members) };
}

/** Evaluates group PATCH operations into one change set. Order matters, so later ops win. */
export function applyGroupPatch(ops: PatchOperation[]): GroupChange {
  const change: GroupChange = { addMembers: [], removeMembers: [] };
  const add = (ids: string[]) => {
    for (const id of ids) {
      change.removeMembers = change.removeMembers.filter((x) => x !== id);
      if (change.replaceMembers) {
        if (!change.replaceMembers.includes(id)) change.replaceMembers.push(id);
      } else if (!change.addMembers.includes(id)) change.addMembers.push(id);
    }
  };
  const remove = (ids: string[]) => {
    for (const id of ids) {
      change.addMembers = change.addMembers.filter((x) => x !== id);
      if (change.replaceMembers) change.replaceMembers = change.replaceMembers.filter((x) => x !== id);
      else if (!change.removeMembers.includes(id)) change.removeMembers.push(id);
    }
  };
  for (const op of ops) {
    const path = op.path ? normalisePath(op.path) : undefined;
    if (!path) {
      if (op.op === "remove") throw new ScimError(400, "A remove operation needs a path.", "noTarget");
      if (!isObj(op.value)) throw new ScimError(400, "A path-less operation needs an object value.", "invalidValue");
      const v = lowerKeys(op.value);
      if (str(v.displayname)) change.displayName = str(v.displayname)!;
      if ("externalid" in v) change.externalId = str(v.externalid);
      if ("members" in v) {
        if (op.op === "replace") {
          change.replaceMembers = memberIds(v.members);
          change.addMembers = [];
          change.removeMembers = [];
        } else add(memberIds(v.members));
      }
      continue;
    }
    if (path === "displayname") {
      if (op.op === "remove") throw new ScimError(400, "displayName cannot be removed.", "mutability");
      const name = str(op.value);
      if (!name) throw new ScimError(400, "displayName cannot be empty.", "invalidValue");
      change.displayName = name;
    } else if (path === "externalid") {
      change.externalId = op.op === "remove" ? null : str(op.value);
    } else if (path === "members") {
      if (op.op === "add") add(memberIds(op.value));
      else if (op.op === "replace") {
        change.replaceMembers = memberIds(op.value);
        change.addMembers = [];
        change.removeMembers = [];
      } else if (op.value === undefined || op.value === null) {
        // remove with path "members" and no value clears everyone
        change.replaceMembers = [];
        change.addMembers = [];
        change.removeMembers = [];
      } else remove(memberIds(op.value));
    } else {
      const m = path.match(/^members\[value eq "([^"]+)"\]$/);
      if (m) {
        if (op.op === "remove") remove([m[1]!]);
        else add([m[1]!]);
      } else throw new ScimError(400, `The path "${op.path}" is not supported on groups.`, "invalidPath");
    }
  }
  return change;
}
