/**
 * Request-type form schemas: visibility (`showIf`), normalisation and validation.
 * Pure and dependency-free so the browser form and the server run the exact same rules.
 */

export type FieldType = "text" | "textarea" | "select" | "date" | "checkbox" | "user" | "app" | "number";

export interface FormFieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  help?: string;
  showIf?: { key: string; equals: string | boolean };
}

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "user", label: "Person" },
  { value: "app", label: "App" },
  { value: "number", label: "Number" },
];

export type FieldValues = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 5000;

/** True when a field is shown given the current values. Hidden parents hide their children too. */
export function isFieldVisible(field: FormFieldDef, fields: FormFieldDef[], values: FieldValues, depth = 0): boolean {
  if (!field.showIf) return true;
  if (depth > fields.length) return false; // cyclic showIf
  const parent = fields.find((f) => f.key === field.showIf!.key);
  if (!parent) return false;
  if (!isFieldVisible(parent, fields, values, depth + 1)) return false;
  const v = values[parent.key];
  const want = field.showIf.equals;
  if (typeof want === "boolean") return (v === true || v === "true" || v === "on") === want;
  return v === want;
}

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/**
 * Validates and normalises submitted values against a schema. Unknown keys and values for
 * hidden fields are dropped, so a client cannot smuggle data the form never showed.
 */
export function validateFields(
  fields: FormFieldDef[],
  input: FieldValues,
): { ok: true; values: FieldValues } | { ok: false; errors: Record<string, string>; values: FieldValues } {
  const values: FieldValues = {};
  const errors: Record<string, string> = {};

  for (const f of fields) {
    if (!isFieldVisible(f, fields, input)) continue;
    const raw = input[f.key];

    if (f.type === "checkbox") {
      const checked = raw === true || raw === "true" || raw === "on";
      if (f.required && !checked) errors[f.key] = "Tick this to continue.";
      values[f.key] = checked;
      continue;
    }

    if (isEmpty(raw)) {
      if (f.required) errors[f.key] = f.type === "select" || f.type === "user" || f.type === "app" ? "Choose an option." : "This is required.";
      continue;
    }

    switch (f.type) {
      case "text":
      case "textarea": {
        const s = String(raw).trim();
        if (s.length > MAX_TEXT) errors[f.key] = `Keep this under ${MAX_TEXT} characters.`;
        else values[f.key] = s;
        break;
      }
      case "select": {
        const s = String(raw);
        if (!(f.options ?? []).includes(s)) errors[f.key] = "Choose one of the listed options.";
        else values[f.key] = s;
        break;
      }
      case "date": {
        const s = String(raw);
        const d = new Date(`${s}T00:00:00Z`);
        if (!DATE.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) errors[f.key] = "Enter a valid date.";
        else values[f.key] = s;
        break;
      }
      case "number": {
        const n = typeof raw === "number" ? raw : Number(String(raw).trim());
        if (!Number.isFinite(n)) errors[f.key] = "Enter a number.";
        else values[f.key] = n;
        break;
      }
      case "user":
      case "app": {
        const s = String(raw);
        if (!UUID.test(s)) errors[f.key] = "Choose an option.";
        else values[f.key] = s;
        break;
      }
    }
  }

  return Object.keys(errors).length ? { ok: false, errors, values } : { ok: true, values };
}

/** Normalises a field key from a label: "Needed by" -> "needed_by". */
export function fieldKeyFromLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field"
  );
}

/** Checks an admin-authored schema: unique keys, options for selects, showIf targets that exist. */
export function validateSchema(fields: FormFieldDef[]): string[] {
  const problems: string[] = [];
  const keys = new Set<string>();
  for (const f of fields) {
    if (!f.label.trim()) problems.push("Every field needs a label.");
    if (!/^[a-z][a-z0-9_]*$/.test(f.key)) problems.push(`"${f.label}" has an invalid key.`);
    if (keys.has(f.key)) problems.push(`Two fields share the key "${f.key}".`);
    keys.add(f.key);
    if (!FIELD_TYPES.some((t) => t.value === f.type)) problems.push(`"${f.label}" has an unknown type.`);
    if (f.type === "select" && !(f.options ?? []).filter((o) => o.trim()).length) problems.push(`"${f.label}" needs at least one option.`);
    if (f.showIf && !fields.some((o) => o.key === f.showIf!.key && o.key !== f.key)) {
      problems.push(`"${f.label}" depends on a field that does not exist.`);
    }
  }
  return [...new Set(problems)];
}
