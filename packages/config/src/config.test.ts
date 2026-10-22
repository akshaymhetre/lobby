import { afterAll, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { pg } from "@lobby/db";
import { diffDocs, stable, summarise } from "./diff";
import { configDoc } from "./schema";
import { exportConfig, parseConfig, planImport } from "./index";

const fixture = configDoc.parse({
  org: { companyName: "Northwind Labs", accentColor: "#2F5D50" },
  roleMappings: [{ group: "lobby-admins", role: "admin" }],
  groups: [{ name: "engineering", displayName: "Engineering" }],
  apps: [{ slug: "github", name: "GitHub", launchUrl: "https://github.com/login", visibleTo: ["engineering"] }],
  helpdesk: {
    calendars: [{ name: "London office hours", timezone: "Europe/London" }],
    teams: [{ slug: "it", name: "IT", calendar: "London office hours" }],
    requestTypes: [{ slug: "new-laptop", team: "it", name: "New laptop", approval: { mode: "manager" } }],
  },
  journeys: [{ name: "Engineering onboarding", steps: [{ title: "Set up your laptop", config: { spaceSlug: "it", pageSlug: "laptop-setup" } }] }],
});

describe("diff (pure)", () => {
  it("a document compared with its own YAML round trip has no changes", () => {
    const again = configDoc.parse(parse(stringify(fixture)));
    const plan = summarise(diffDocs(fixture, again));
    expect(plan.hasChanges).toBe(false);
    expect(plan.errors).toEqual([]);
  });

  it("reports created, updated and removed items by natural key", () => {
    const next = configDoc.parse(parse(stringify(fixture)));
    next.apps![0]!.name = "GitHub Enterprise";
    next.apps!.push({ ...next.apps![0]!, slug: "linear", name: "Linear" });
    next.roleMappings = [{ group: "it-team", role: "admin" }];
    const sections = diffDocs(fixture, next);
    const apps = sections.find((s) => s.section === "apps")!;
    expect(apps.created).toEqual(["linear"]);
    expect(apps.updated).toEqual([{ key: "github", changes: ["name"] }]);
    const roles = sections.find((s) => s.section === "roleMappings")!;
    expect(roles.created).toEqual(["it-team → admin"]);
    expect(roles.removed).toEqual(["lobby-admins → admin"]);
  });

  it("skips sections the file leaves out and flags duplicates", () => {
    const next = configDoc.parse({ apps: [fixture.apps![0], fixture.apps![0]] });
    const sections = diffDocs(fixture, next);
    expect(sections.map((s) => s.section)).toEqual(["apps"]);
    expect(sections[0]!.errors[0]).toMatch(/more than once/);
  });

  it("ignores key order", () => {
    expect(stable({ b: 1, a: { d: 2, c: 3 } })).toBe(stable({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it("rejects invalid YAML and invalid shapes with readable errors", () => {
    expect(parseConfig("apps: [").ok).toBe(false);
    const bad = parseConfig("apps:\n  - slug: Not A Slug\n    name: x\n    launchUrl: nope\n");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.join("\n")).toMatch(/apps\.0\.slug/);
  });
});

describe("round trip against the database (read-only)", () => {
  afterAll(() => pg.end({ timeout: 5 }));

  it("export then plan shows zero changes", async () => {
    const yaml = await exportConfig();
    const plan = await planImport(yaml);
    expect(plan.errors).toEqual([]);
    expect(plan.hasChanges).toBe(false);
    expect(plan.sections.length).toBeGreaterThan(5);
  });

  it("an edited export plans exactly that edit", async () => {
    const doc = parse(await exportConfig());
    doc.org.companyName = "Northwind Labs Ltd";
    const plan = await planImport(stringify(doc));
    const org = plan.sections.find((s) => s.section === "org")!;
    expect(org.updated).toEqual([{ key: "Northwind Labs Ltd", changes: ["companyName"] }]);
    expect(plan.sections.filter((s) => s.section !== "org").every((s) => !s.created.length && !s.updated.length)).toBe(true);
  });

  it("refuses a reference to a group that does not exist", async () => {
    const doc = parse(await exportConfig());
    doc.apps = [{ slug: "zz-test", name: "Test", launchUrl: "https://example.test", visibleTo: ["no-such-group"] }];
    const plan = await planImport(stringify(doc));
    expect(plan.errors.join("\n")).toMatch(/no-such-group/);
  });
});
