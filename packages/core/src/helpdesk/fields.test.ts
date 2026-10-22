import { describe, expect, it } from "vitest";
import { fieldKeyFromLabel, isFieldVisible, validateFields, validateSchema, type FormFieldDef } from "./fields";

const schema: FormFieldDef[] = [
  { key: "model", label: "Model", type: "select", required: true, options: ["MacBook Air", "MacBook Pro"] },
  { key: "needed_by", label: "Needed by", type: "date", required: true },
  { key: "replacement", label: "Is this a replacement?", type: "checkbox" },
  { key: "old_asset", label: "Old asset tag", type: "text", required: true, showIf: { key: "replacement", equals: true } },
  { key: "old_condition", label: "Condition", type: "select", options: ["Working", "Broken"], showIf: { key: "old_asset", equals: "X" } },
  { key: "monitors", label: "Monitors", type: "number" },
  { key: "manager", label: "Manager", type: "user" },
];

describe("validateFields", () => {
  it("accepts a valid submission and normalises types", () => {
    const r = validateFields(schema, { model: "MacBook Pro", needed_by: "2026-11-02", monitors: "2", extra: "dropped" });
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ model: "MacBook Pro", needed_by: "2026-11-02", replacement: false, monitors: 2 });
  });
  it("reports required fields", () => {
    const r = validateFields(schema, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["model", "needed_by"]);
  });
  it("requires conditional fields only when shown, and drops hidden values", () => {
    const hidden = validateFields(schema, { model: "MacBook Air", needed_by: "2026-11-02", old_asset: "NW-1" });
    expect(hidden.ok).toBe(true);
    expect(hidden.values.old_asset).toBeUndefined();
    const shown = validateFields(schema, { model: "MacBook Air", needed_by: "2026-11-02", replacement: "on" });
    expect(shown.ok).toBe(false);
    if (!shown.ok) expect(shown.errors.old_asset).toBeDefined();
  });
  it("rejects options outside the list, invalid dates and non-uuid pickers", () => {
    const r = validateFields(schema, { model: "ThinkPad", needed_by: "2026-02-30", monitors: "two", manager: "grace" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["manager", "model", "monitors", "needed_by"]);
  });
  it("hides grandchildren when the parent is hidden", () => {
    expect(isFieldVisible(schema[4]!, schema, { old_asset: "X", replacement: false })).toBe(false);
    expect(isFieldVisible(schema[4]!, schema, { old_asset: "X", replacement: true })).toBe(true);
  });
  it("does not loop on cyclic showIf", () => {
    const cyc: FormFieldDef[] = [
      { key: "a", label: "A", type: "text", showIf: { key: "b", equals: "1" } },
      { key: "b", label: "B", type: "text", showIf: { key: "a", equals: "1" } },
    ];
    expect(isFieldVisible(cyc[0]!, cyc, { a: "1", b: "1" })).toBe(false);
  });
  it("requires a required checkbox to be ticked", () => {
    const r = validateFields([{ key: "ok", label: "I agree", type: "checkbox", required: true }], {});
    expect(r.ok).toBe(false);
  });
});

describe("schema helpers", () => {
  it("derives keys from labels", () => {
    expect(fieldKeyFromLabel("Needed by")).toBe("needed_by");
    expect(fieldKeyFromLabel("  Café / Desk #2 ")).toBe("cafe_desk_2");
  });
  it("finds schema problems", () => {
    expect(validateSchema(schema)).toEqual([]);
    const bad = validateSchema([
      { key: "a", label: "A", type: "select" },
      { key: "a", label: "B", type: "text", showIf: { key: "zzz", equals: "1" } },
    ]);
    expect(bad).toHaveLength(3);
  });
});
