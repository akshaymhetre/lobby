/**
 * CSV import of people: parsing, column auto-detection and per-row validation are pure (and
 * tested); `importPeople` writes the result. Rows are matched by email, so re-running an import
 * updates people instead of duplicating them.
 */
import { and, db, eq, inArray, s, sql } from "@lobby/db";
import { audit } from "../audit";
import type { UserContext } from "../identity/context";
import { humanise } from "../identity/provision";
import { managerProblem, PeopleError } from "./index";
import { indexPerson } from "./index-source";

export const IMPORT_FIELDS = [
  { key: "email", label: "Work email", required: true },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "displayName", label: "Full name" },
  { key: "title", label: "Job title" },
  { key: "department", label: "Department" },
  { key: "location", label: "Location" },
  { key: "managerEmail", label: "Manager email" },
  { key: "startDate", label: "Start date" },
  { key: "groups", label: "Groups" },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
/** Column index per field; -1 = not mapped. */
export type ColumnMapping = Record<ImportField, number>;

export const TEMPLATE_CSV =
  "email,first_name,last_name,title,department,location,manager_email,start_date,groups\n" +
  "jamie.lee@northwind.example,Jamie,Lee,Product Designer,Product & Design,London,rohan.mehta@northwind.example,2026-11-03,product-design\n" +
  "priya.nair@northwind.example,Priya,Nair,Account Executive,Sales & Marketing,Austin,ethan.wright@northwind.example,2026-11-10,sales-marketing; customer-facing\n";

export const MAX_IMPORT_ROWS = 5000;

/** RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF, BOM. Drops fully blank lines. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Excel in many locales exports semicolons; pick whichever separator the header line uses more. */
function detectDelimiter(src: string): string {
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ",";
}

const ALIASES: Record<ImportField, string[]> = {
  email: ["email", "work email", "email address", "e-mail", "mail", "username", "user name", "login", "primary email"],
  firstName: ["first name", "firstname", "given name", "givenname", "forename", "first"],
  lastName: ["last name", "lastname", "surname", "family name", "familyname", "last"],
  displayName: ["name", "full name", "fullname", "display name", "displayname", "employee name", "employee"],
  title: ["title", "job title", "jobtitle", "position", "role", "job"],
  department: ["department", "dept", "team", "division", "org", "organisation", "organization"],
  location: ["location", "office", "city", "site", "work location"],
  managerEmail: ["manager email", "manager", "manager e-mail", "reports to", "reports to email", "line manager", "supervisor email", "supervisor"],
  startDate: ["start date", "startdate", "start", "hire date", "hiredate", "date hired", "joined", "join date", "first day"],
  groups: ["groups", "group", "teams", "memberships"],
};

const norm = (h: string) => h.trim().toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ");

/** Guesses which column holds which field from the header names. Each column is used at most once. */
export function detectMapping(headers: string[]): ColumnMapping {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, -1])) as ColumnMapping;
  const used = new Set<number>();
  const normalised = headers.map(norm);
  // Exact alias matches first, in alias priority order, then "contains" matches.
  for (const pass of ["exact", "contains"] as const) {
    for (const f of IMPORT_FIELDS) {
      if (mapping[f.key] !== -1) continue;
      for (const alias of ALIASES[f.key]) {
        const idx = normalised.findIndex((h, i) => !used.has(i) && (pass === "exact" ? h === alias : alias.length > 3 && h.includes(alias)));
        if (idx !== -1) {
          mapping[f.key] = idx;
          used.add(idx);
          break;
        }
      }
    }
  }
  return mapping;
}

export interface ImportRow {
  /** 1-based line number in the file, counting the header as line 1. */
  line: number;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  title: string | null;
  department: string | null;
  location: string | null;
  managerEmail: string | null;
  startDate: string | null;
  groups: string[];
  errors: string[];
  warnings: string[];
}

const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/** Accepts 2026-03-14, 14/03/2026 (day first), 2026/03/14 and 14 Mar 2026. */
export function parseDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  let match = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    const t = Date.parse(`${v} 12:00 UTC`);
    if (Number.isNaN(t)) return null;
    const dt = new Date(t);
    [y, m, d] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Turns parsed rows into validated import rows. Cross-row checks: duplicate emails, unknown managers. */
export function buildImportRows(rows: string[][], mapping: ColumnMapping, knownEmails: Set<string> = new Set()): ImportRow[] {
  const cell = (r: string[], f: ImportField) => (mapping[f] >= 0 ? (r[mapping[f]] ?? "").trim() : "");
  const out: ImportRow[] = rows.slice(1, MAX_IMPORT_ROWS + 1).map((r, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const email = cell(r, "email").toLowerCase();
    if (!email) errors.push("Email is missing.");
    else if (!EMAIL.test(email)) errors.push(`"${email}" is not an email address.`);

    let firstName = cell(r, "firstName");
    let lastName = cell(r, "lastName");
    let displayName = cell(r, "displayName");
    if (!firstName && !lastName && displayName) {
      const parts = displayName.split(/\s+/);
      firstName = parts[0] ?? "";
      lastName = parts.slice(1).join(" ");
    }
    if (!displayName) displayName = `${firstName} ${lastName}`.trim();
    if (!displayName && email) {
      displayName = email.split("@")[0]!.split(/[._-]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
      warnings.push("No name given, so we made one from the email.");
    }

    const rawDate = cell(r, "startDate");
    const startDate = rawDate ? parseDate(rawDate) : null;
    if (rawDate && !startDate) errors.push(`"${rawDate}" is not a date we can read. Use 2026-03-14.`);

    const managerEmail = cell(r, "managerEmail").toLowerCase() || null;
    if (managerEmail && !EMAIL.test(managerEmail)) errors.push(`Manager "${managerEmail}" is not an email address.`);
    if (managerEmail && managerEmail === email) errors.push("Someone cannot be their own manager.");

    const groups = [
      ...new Set(
        cell(r, "groups")
          .split(/[;|,]/)
          .map((g) => g.trim())
          .filter(Boolean),
      ),
    ];

    return {
      line: i + 2,
      email,
      firstName,
      lastName,
      displayName,
      title: cell(r, "title") || null,
      department: cell(r, "department") || null,
      location: cell(r, "location") || null,
      managerEmail,
      startDate,
      groups,
      errors,
      warnings,
    };
  });

  const seen = new Map<string, number>();
  const inFile = new Set(out.map((r) => r.email).filter(Boolean));
  for (const r of out) {
    if (!r.email) continue;
    const first = seen.get(r.email);
    if (first !== undefined) r.errors.push(`Same email as line ${first}.`);
    else seen.set(r.email, r.line);
    if (r.managerEmail && !inFile.has(r.managerEmail) && !knownEmails.has(r.managerEmail)) {
      r.warnings.push(`Manager ${r.managerEmail} is not in Lobby or this file, so the manager will be left empty.`);
    }
  }
  return out;
}

/** Normalises a group cell value into a stable group key (matches IdP-style names). */
export const groupKey = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  managersSet: number;
  groupsCreated: number;
  membershipsAdded: number;
}

/** Writes validated rows: create or update by email, then managers, then groups (source "csv"). */
export async function importPeople(ctx: UserContext, rows: ImportRow[]): Promise<ImportResult> {
  if (!ctx.has("admin")) throw new PeopleError("Only admins can import people.", 403);
  const good = rows.filter((r) => r.errors.length === 0 && r.email);
  const result: ImportResult = { created: 0, updated: 0, skipped: rows.length - good.length, managersSet: 0, groupsCreated: 0, membershipsAdded: 0 };
  if (!good.length) return result;

  const emails = good.map((r) => r.email);
  const existing = await db.select().from(s.users).where(inArray(sql`lower(${s.users.email})`, emails));
  const byEmail = new Map(existing.map((u) => [u.email.toLowerCase(), u]));
  const idByEmail = new Map<string, string>();
  const touched: string[] = [];

  // Pass 1: people.
  for (const r of good) {
    const found = byEmail.get(r.email);
    if (found) {
      if (found.isBreakGlass) {
        result.skipped++;
        continue;
      }
      // Only overwrite what the file actually says; blank cells keep the current value.
      await db
        .update(s.users)
        .set({
          ...(r.firstName ? { firstName: r.firstName } : {}),
          ...(r.lastName ? { lastName: r.lastName } : {}),
          ...(r.displayName ? { displayName: r.displayName } : {}),
          ...(r.title ? { title: r.title } : {}),
          ...(r.department ? { department: r.department } : {}),
          ...(r.location ? { location: r.location } : {}),
          ...(r.startDate ? { startDate: r.startDate } : {}),
        })
        .where(eq(s.users.id, found.id));
      idByEmail.set(r.email, found.id);
      touched.push(found.id);
      result.updated++;
    } else {
      const [row] = await db
        .insert(s.users)
        .values({
          email: r.email,
          firstName: r.firstName,
          lastName: r.lastName,
          displayName: r.displayName || r.email,
          title: r.title,
          department: r.department,
          location: r.location,
          startDate: r.startDate,
          source: "csv",
        })
        .returning({ id: s.users.id });
      idByEmail.set(r.email, row!.id);
      touched.push(row!.id);
      result.created++;
    }
  }

  // Pass 2: managers, once everyone in the file exists.
  const managerEmails = [...new Set(good.map((r) => r.managerEmail).filter((m): m is string => !!m))];
  if (managerEmails.length) {
    const managers = await db
      .select({ id: s.users.id, email: s.users.email })
      .from(s.users)
      .where(and(inArray(sql`lower(${s.users.email})`, managerEmails), eq(s.users.status, "active")));
    const managerId = new Map(managers.map((m) => [m.email.toLowerCase(), m.id]));
    for (const r of good) {
      const personId = idByEmail.get(r.email);
      const mId = r.managerEmail ? managerId.get(r.managerEmail) : undefined;
      if (!personId || !mId) continue;
      if (await managerProblem(personId, mId)) continue;
      await db.update(s.users).set({ managerId: mId }).where(eq(s.users.id, personId));
      result.managersSet++;
    }
  }

  // Pass 3: groups and memberships.
  const labels = [...new Set(good.flatMap((r) => r.groups))];
  if (labels.length) {
    const keys = labels.map((l) => ({ name: groupKey(l), displayName: /[A-Z\s&]/.test(l) ? l : humanise(l) })).filter((g) => g.name);
    const before = await db.select({ name: s.groups.name }).from(s.groups).where(inArray(s.groups.name, keys.map((k) => k.name)));
    const have = new Set(before.map((b) => b.name));
    const fresh = keys.filter((k, i) => !have.has(k.name) && keys.findIndex((x) => x.name === k.name) === i);
    if (fresh.length) {
      await db.insert(s.groups).values(fresh.map((k) => ({ ...k, source: "csv" as const }))).onConflictDoNothing();
      result.groupsCreated = fresh.length;
    }
    const groups = await db.select({ id: s.groups.id, name: s.groups.name }).from(s.groups).where(inArray(s.groups.name, keys.map((k) => k.name)));
    const gid = new Map(groups.map((g) => [g.name, g.id]));
    const memberships = good.flatMap((r) =>
      r.groups.map((l) => ({ groupId: gid.get(groupKey(l)), userId: idByEmail.get(r.email) })).filter((m): m is { groupId: string; userId: string } => !!m.groupId && !!m.userId),
    );
    if (memberships.length) {
      const added = await db.insert(s.groupMembers).values(memberships).onConflictDoNothing().returning({ g: s.groupMembers.groupId });
      result.membershipsAdded = added.length;
    }
  }

  for (const id of touched) await indexPerson(id);
  await audit(ctx.user.id, "people.csv_imported", { type: "users", id: "csv" }, { ...result });
  return result;
}
