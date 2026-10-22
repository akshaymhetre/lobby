import { parse as parseYaml, stringify } from "yaml";
import { audit } from "@lobby/core/audit";
import { configDoc, type ConfigDoc } from "./schema";
import { diffDocs, summarise, type ImportPlan } from "./diff";
import { snapshot } from "./snapshot";
import { checkReferences, writeDoc } from "./apply";

export * from "./schema";
export * from "./diff";
export { snapshot } from "./snapshot";

const HEADER = `# Lobby configuration
# Apply with: pnpm --filter @lobby/config exec tsx src/cli.ts apply <file> --dry-run
# Items are matched by slug or name. Importing never deletes anything except role mappings,
# which are kept exactly as listed. Secrets (SSO client secret, API keys, SCIM tokens) are never included.
`;

export function toYaml(doc: ConfigDoc): string {
  return HEADER + stringify(doc, { lineWidth: 0, nullStr: "null" });
}

/** The whole configuration as one YAML document. */
export async function exportConfig(): Promise<string> {
  return toYaml(await snapshot());
}

export type ParseResult = { ok: true; doc: ConfigDoc } | { ok: false; errors: string[] };

export function parseConfig(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    return { ok: false, errors: [`This is not valid YAML: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`] };
  }
  if (!raw || typeof raw !== "object") return { ok: false, errors: ["The file is empty or is not a Lobby configuration."] };
  const r = configDoc.safeParse(raw);
  if (!r.success) {
    return {
      ok: false,
      errors: r.error.issues.slice(0, 20).map((i) => `${i.path.length ? i.path.join(".") : "file"}: ${i.message}`),
    };
  }
  return { ok: true, doc: r.data };
}

/** Dry run: what applying `yaml` would create, update and leave alone, per section. */
export async function planImport(yaml: string): Promise<ImportPlan> {
  const parsed = parseConfig(yaml);
  if (!parsed.ok) return { sections: [], errors: parsed.errors, hasChanges: false };
  const [current, refErrors] = await Promise.all([snapshot(), checkReferences(parsed.doc)]);
  return summarise(diffDocs(current, parsed.doc), refErrors);
}

export async function applyImport(yaml: string, actorId: string | null): Promise<ImportPlan & { applied: boolean }> {
  const plan = await planImport(yaml);
  if (plan.errors.length) return { ...plan, applied: false };
  if (!plan.hasChanges) return { ...plan, applied: false };
  const parsed = parseConfig(yaml);
  if (!parsed.ok) return { ...plan, applied: false };
  const changed = new Set(plan.sections.filter((s) => s.created.length || s.updated.length || s.removed.length).map((s) => s.section));
  await writeDoc(parsed.doc, changed);
  await audit(actorId, "config.imported", { type: "config", id: "yaml" }, {
    sections: plan.sections
      .filter((s) => changed.has(s.section))
      .map((s) => ({ section: s.section, created: s.created.length, updated: s.updated.length, removed: s.removed.length })),
  });
  return { ...plan, applied: true };
}
