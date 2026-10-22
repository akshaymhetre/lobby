"use server";

import { revalidatePath } from "next/cache";
import { db, s, sql } from "@lobby/db";
import { deactivatePerson, PeopleError, reactivatePerson } from "@lobby/core/people";
import {
  buildImportRows,
  detectMapping,
  importPeople,
  IMPORT_FIELDS,
  parseCsv,
  type ColumnMapping,
  type ImportResult,
  type ImportRow,
} from "@lobby/core/people/csv";
import { requireAdmin } from "@/server/auth";

const MAX_BYTES = 2 * 1024 * 1024;

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof PeopleError) return { ok: false, error: err.message };
  console.error("[admin/people] action failed", err);
  return { ok: false, error: "Something went wrong and nothing changed. Try again in a moment." };
}

export async function setActiveAction(userId: string, active: boolean): Promise<Result> {
  const ctx = await requireAdmin();
  try {
    if (active) await reactivatePerson(ctx, userId);
    else await deactivatePerson(ctx, userId);
    revalidatePath("/admin/people");
    revalidatePath("/people");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export interface ImportPreview {
  headers: string[];
  mapping: ColumnMapping;
  rows: ImportRow[];
  totalRows: number;
  existing: string[];
}

async function knownEmails(): Promise<Set<string>> {
  const rows = await db.select({ email: sql<string>`lower(${s.users.email})` }).from(s.users);
  return new Set(rows.map((r) => r.email));
}

function validMapping(mapping: ColumnMapping, columns: number): ColumnMapping {
  const out = {} as ColumnMapping;
  for (const f of IMPORT_FIELDS) {
    const v = Number(mapping[f.key]);
    out[f.key] = Number.isInteger(v) && v >= -1 && v < columns ? v : -1;
  }
  return out;
}

/** Parses the file and validates every row. Pass a mapping to re-validate after the admin changes it. */
export async function previewImportAction(text: string, mapping?: ColumnMapping): Promise<Result<ImportPreview>> {
  await requireAdmin();
  try {
    if (text.length > MAX_BYTES) return { ok: false, error: "That file is over 2 MB. Split it into smaller files." };
    const rows = parseCsv(text);
    if (rows.length < 2) return { ok: false, error: "We found no rows under the header. Check the file has a header line and at least one person." };
    const headers = rows[0]!.map((h) => h.trim());
    const m = mapping ? validMapping(mapping, headers.length) : detectMapping(headers);
    const known = await knownEmails();
    const built = m.email >= 0 ? buildImportRows(rows, m, known) : [];
    return {
      ok: true,
      data: {
        headers,
        mapping: m,
        rows: built,
        totalRows: rows.length - 1,
        existing: built.filter((r) => known.has(r.email)).map((r) => r.email),
      },
    };
  } catch (err) {
    return fail(err);
  }
}

/** Re-parses on the server (never trusts rows from the browser) and imports the valid ones. */
export async function runImportAction(text: string, mapping: ColumnMapping): Promise<Result<ImportResult>> {
  const ctx = await requireAdmin();
  try {
    if (text.length > MAX_BYTES) return { ok: false, error: "That file is over 2 MB." };
    const rows = parseCsv(text);
    const headers = rows[0] ?? [];
    const m = validMapping(mapping, headers.length);
    if (m.email < 0) return { ok: false, error: "Pick which column holds the work email." };
    const result = await importPeople(ctx, buildImportRows(rows, m, await knownEmails()));
    revalidatePath("/admin/people");
    revalidatePath("/people");
    revalidatePath("/org-chart");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}
