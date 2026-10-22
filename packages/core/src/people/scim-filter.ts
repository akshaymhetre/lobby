/**
 * A deliberately small SCIM filter parser (RFC 7644 section 3.4.2.2). Identity providers only ever
 * send simple equality filters for provisioning, so we support `attr op value` clauses joined by
 * `and`, with ops eq / ne / co / sw / ew / pr. Anything else is an `invalidFilter` error.
 */

export type FilterOp = "eq" | "ne" | "co" | "sw" | "ew" | "pr";

export interface FilterClause {
  /** Normalised attribute: userName, externalId, email, id, displayName, active, title, department, member. */
  attr: string;
  op: FilterOp;
  value: string | boolean | null;
}

export class ScimFilterError extends Error {}

const CLAUSE =
  /^\s*([A-Za-z][\w:.$-]*(?:\[[^\]]*\])?(?:\.[A-Za-z]\w*)?)\s+(eq|ne|co|sw|ew|gt|ge|lt|le|pr)\b\s*("(?:[^"\\]|\\.)*"|true|false|null|[^\s)]+)?\s*/i;

const ENTERPRISE = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:user:";
const CORE_USER = "urn:ietf:params:scim:schemas:core:2.0:user:";
const CORE_GROUP = "urn:ietf:params:scim:schemas:core:2.0:group:";

/** Maps a SCIM attribute path to the name our queries understand, or null when unsupported. */
export function normaliseFilterAttr(path: string): string | null {
  let p = path.toLowerCase();
  for (const prefix of [CORE_USER, CORE_GROUP]) if (p.startsWith(prefix)) p = p.slice(prefix.length);
  if (p.startsWith(ENTERPRISE)) p = `enterprise.${p.slice(ENTERPRISE.length)}`;
  switch (p) {
    case "username":
      return "userName";
    case "externalid":
      return "externalId";
    case "id":
      return "id";
    case "displayname":
      return "displayName";
    case "active":
      return "active";
    case "title":
      return "title";
    case "enterprise.department":
      return "department";
    case "members.value":
    case "members":
      return "member";
    case "emails":
    case "emails.value":
    case 'emails[type eq "work"].value':
    case "emails[type eq work].value":
    case "emails[primary eq true].value":
      return "email";
    default:
      return null;
  }
}

function parseValue(raw: string | undefined): string | boolean | null {
  if (raw === undefined) return null;
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      throw new ScimFilterError(`Could not read the value ${raw}.`);
    }
  }
  if (/^true$/i.test(raw)) return true;
  if (/^false$/i.test(raw)) return false;
  if (/^null$/i.test(raw)) return null;
  return raw;
}

/** Parses a filter string into clauses (all joined by `and`). Empty input gives no clauses. */
export function parseScimFilter(input: string | null | undefined): FilterClause[] {
  let rest = (input ?? "").trim();
  if (!rest) return [];
  const clauses: FilterClause[] = [];
  // Some clients wrap the whole filter in parentheses.
  while (rest.startsWith("(") && rest.endsWith(")")) rest = rest.slice(1, -1).trim();
  for (;;) {
    const m = rest.match(CLAUSE);
    if (!m) throw new ScimFilterError(`Unsupported filter near "${rest.slice(0, 60)}".`);
    const attr = normaliseFilterAttr(m[1]!);
    if (!attr) throw new ScimFilterError(`Filtering on "${m[1]}" is not supported.`);
    const op = m[2]!.toLowerCase();
    if (!["eq", "ne", "co", "sw", "ew", "pr"].includes(op)) throw new ScimFilterError(`The "${op}" operator is not supported.`);
    if (op !== "pr" && m[3] === undefined) throw new ScimFilterError(`The "${op}" operator needs a value.`);
    clauses.push({ attr, op: op as FilterOp, value: op === "pr" ? null : parseValue(m[3]) });
    rest = rest.slice(m[0].length);
    if (!rest) break;
    const and = rest.match(/^and\s+/i);
    if (!and) throw new ScimFilterError(`Only "and" can join filter clauses (near "${rest.slice(0, 40)}").`);
    rest = rest.slice(and[0].length);
  }
  return clauses;
}

/** Evaluates clauses against plain attribute values, case-insensitively for strings (RFC 7643 caseExact=false). */
export function matchesFilter(values: Record<string, string | boolean | null | undefined | string[]>, clauses: FilterClause[]): boolean {
  return clauses.every((c) => {
    const raw = values[c.attr];
    const list = Array.isArray(raw) ? raw : [raw];
    if (c.op === "pr") return list.some((v) => v !== null && v !== undefined && v !== "");
    const test = (v: string | boolean | null | undefined) => {
      if (typeof c.value === "boolean" || typeof v === "boolean") {
        const result = String(v).toLowerCase() === String(c.value).toLowerCase();
        return c.op === "ne" ? !result : result;
      }
      const a = (v ?? "").toString().toLowerCase();
      const b = (c.value ?? "").toString().toLowerCase();
      switch (c.op) {
        case "eq":
          return v != null && a === b;
        case "ne":
          return a !== b;
        case "co":
          return a.includes(b);
        case "sw":
          return a.startsWith(b);
        case "ew":
          return a.endsWith(b);
        default:
          return false;
      }
    };
    return c.op === "ne" ? list.every(test) : list.some(test);
  });
}
