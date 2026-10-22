import type { ConfigDoc } from "./schema";

/** A section of the file and what applying it would do. Pure: no database access. */
export interface SectionPlan {
  section: string;
  label: string;
  created: string[];
  updated: { key: string; changes: string[] }[];
  unchanged: number;
  /** Only role mappings are synced exactly; everything else is never deleted by an import. */
  removed: string[];
  errors: string[];
}

export interface ImportPlan {
  sections: SectionPlan[];
  errors: string[];
  hasChanges: boolean;
}

/** Stable JSON: object keys sorted, so key order in the file never counts as a change. */
export function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v,
  );
}

function changedFields(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => stable(a[k]) !== stable(b[k])).sort();
}

export function diffList<T extends Record<string, unknown>>(
  section: string,
  label: string,
  current: T[],
  incoming: T[],
  key: (t: T) => string,
): SectionPlan {
  const plan: SectionPlan = { section, label, created: [], updated: [], unchanged: 0, removed: [], errors: [] };
  const byKey = new Map(current.map((c) => [key(c), c]));
  const seen = new Set<string>();
  for (const item of incoming) {
    const k = key(item);
    if (seen.has(k)) {
      plan.errors.push(`"${k}" appears more than once.`);
      continue;
    }
    seen.add(k);
    const existing = byKey.get(k);
    if (!existing) plan.created.push(k);
    else {
      const changes = changedFields(existing, item);
      if (changes.length) plan.updated.push({ key: k, changes });
      else plan.unchanged++;
    }
  }
  return plan;
}

/** Compares two parsed documents section by section. Sections absent from `incoming` are skipped. */
export function diffDocs(current: ConfigDoc, incoming: ConfigDoc): SectionPlan[] {
  const out: SectionPlan[] = [];
  if (incoming.org) {
    const p: SectionPlan = { section: "org", label: "Company and branding", created: [], updated: [], unchanged: 0, removed: [], errors: [] };
    const changes = current.org ? changedFields(current.org, incoming.org) : Object.keys(incoming.org);
    if (changes.length) p.updated.push({ key: incoming.org.companyName, changes });
    else p.unchanged = 1;
    out.push(p);
  }
  if (incoming.roleMappings) {
    const k = (m: { group: string; role: string }) => `${m.group} → ${m.role}`;
    const p = diffList("roleMappings", "Role mappings", current.roleMappings ?? [], incoming.roleMappings, k);
    const incomingKeys = new Set(incoming.roleMappings.map(k));
    p.removed = (current.roleMappings ?? []).map(k).filter((x) => !incomingKeys.has(x));
    out.push(p);
  }
  if (incoming.groups) out.push(diffList("groups", "Groups", current.groups ?? [], incoming.groups, (g) => g.name));
  if (incoming.apps) out.push(diffList("apps", "Apps", current.apps ?? [], incoming.apps, (a) => a.slug));
  if (incoming.knowledgeSpaces)
    out.push(diffList("knowledgeSpaces", "Knowledge spaces", current.knowledgeSpaces ?? [], incoming.knowledgeSpaces, (s) => s.slug));
  const h = incoming.helpdesk;
  const ch = current.helpdesk ?? {};
  if (h?.calendars) out.push(diffList("calendars", "Business calendars", ch.calendars ?? [], h.calendars, (c) => c.name));
  if (h?.slaPolicies) out.push(diffList("slaPolicies", "SLA policies", ch.slaPolicies ?? [], h.slaPolicies, (c) => c.name));
  if (h?.teams) out.push(diffList("teams", "Helpdesk teams", ch.teams ?? [], h.teams, (t) => t.slug));
  if (h?.requestTypes) out.push(diffList("requestTypes", "Request types", ch.requestTypes ?? [], h.requestTypes, (r) => r.slug));
  if (incoming.journeys) out.push(diffList("journeys", "Journeys", current.journeys ?? [], incoming.journeys, (j) => j.name));
  return out;
}

export function summarise(sections: SectionPlan[], errors: string[] = []): ImportPlan {
  const all = [...errors, ...sections.flatMap((s) => s.errors.map((e) => `${s.label}: ${e}`))];
  const hasChanges = sections.some((s) => s.created.length || s.updated.length || s.removed.length);
  return { sections, errors: all, hasChanges };
}
