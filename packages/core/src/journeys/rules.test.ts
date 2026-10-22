import { describe, expect, it } from "vitest";
import { anchorFor, canActOnStep, conditionsSummary, matchesConditions, resolveAssignee, type MatchSubject } from "./rules";

const sam: MatchSubject = { department: "Engineering", location: "London", startDate: "2026-10-16", endDate: null, groupIds: ["g-eng"] };

describe("matchesConditions", () => {
  it("matches everyone when there are no conditions", () => {
    expect(matchesConditions(sam, {})).toBe(true);
    expect(matchesConditions(sam, { departments: [], locations: [], groupIds: [] })).toBe(true);
  });
  it("matches any of several values within one condition, case-insensitively", () => {
    expect(matchesConditions(sam, { departments: ["Product & Design", "engineering"] })).toBe(true);
    expect(matchesConditions(sam, { departments: ["Finance"] })).toBe(false);
  });
  it("requires every condition that is set", () => {
    expect(matchesConditions(sam, { departments: ["Engineering"], locations: ["London"] })).toBe(true);
    expect(matchesConditions(sam, { departments: ["Engineering"], locations: ["Berlin"] })).toBe(false);
    expect(matchesConditions(sam, { departments: ["Engineering"], groupIds: ["g-other"] })).toBe(false);
    expect(matchesConditions(sam, { groupIds: ["g-other", "g-eng"] })).toBe(true);
  });
  it("does not match a person missing the attribute", () => {
    expect(matchesConditions({ ...sam, department: null }, { departments: ["Engineering"] })).toBe(false);
  });
});

describe("anchorFor", () => {
  it("uses the start date for onboarding and the end date for offboarding", () => {
    expect(anchorFor(sam, "onboarding")).toBe("2026-10-16");
    expect(anchorFor(sam, "offboarding")).toBeNull();
    expect(anchorFor({ startDate: null, endDate: "2026-11-30" }, "offboarding")).toBe("2026-11-30");
  });
});

describe("resolveAssignee", () => {
  const run = { subjectUserId: "sam", managerId: "grace", buddyUserId: null as string | null };
  it("gives subject and manager steps to those people", () => {
    expect(resolveAssignee({ assignee: "subject", assigneeUserId: null }, run)).toEqual({ assigneeId: "sam", assigneeTeam: null, awaitingBuddy: false });
    expect(resolveAssignee({ assignee: "manager", assigneeUserId: null }, run).assigneeId).toBe("grace");
    expect(resolveAssignee({ assignee: "manager", assigneeUserId: null }, { ...run, managerId: null }).assigneeId).toBeNull();
  });
  it("leaves buddy steps waiting until a buddy is chosen", () => {
    expect(resolveAssignee({ assignee: "buddy", assigneeUserId: null }, run)).toEqual({ assigneeId: null, assigneeTeam: null, awaitingBuddy: true });
    expect(resolveAssignee({ assignee: "buddy", assigneeUserId: null }, { ...run, buddyUserId: "chloe" })).toEqual({
      assigneeId: "chloe",
      assigneeTeam: null,
      awaitingBuddy: false,
    });
  });
  it("puts team steps in the queue unless a person is named", () => {
    expect(resolveAssignee({ assignee: "it", assigneeUserId: null }, run)).toEqual({ assigneeId: null, assigneeTeam: "it", awaitingBuddy: false });
    expect(resolveAssignee({ assignee: "people", assigneeUserId: "priya" }, run)).toEqual({ assigneeId: "priya", assigneeTeam: null, awaitingBuddy: false });
  });
  it("gives specific steps to the named person", () => {
    expect(resolveAssignee({ assignee: "specific", assigneeUserId: "alex" }, run).assigneeId).toBe("alex");
  });
});

describe("canActOnStep", () => {
  const step = { assigneeId: "sam", assigneeTeam: null, subjectManagerId: "grace" } as const;
  const actor = (userId: string, extra: Partial<{ isAdmin: boolean; teams: ("it" | "people")[] }> = {}) => ({ userId, isAdmin: false, teams: [], ...extra });
  it("lets the assignee, the manager, admins and the People team act", () => {
    expect(canActOnStep(actor("sam"), step)).toBe(true);
    expect(canActOnStep(actor("grace"), step)).toBe(true);
    expect(canActOnStep(actor("root", { isAdmin: true }), step)).toBe(true);
    expect(canActOnStep(actor("priya", { teams: ["people"] }), step)).toBe(true);
  });
  it("refuses everyone else", () => {
    expect(canActOnStep(actor("maya"), step)).toBe(false);
    expect(canActOnStep(actor("alex", { teams: ["it"] }), step)).toBe(false);
  });
  it("lets the team act on its queue steps", () => {
    const queued = { assigneeId: null, assigneeTeam: "it", subjectManagerId: "grace" } as const;
    expect(canActOnStep(actor("alex", { teams: ["it"] }), queued)).toBe(true);
    expect(canActOnStep(actor("maya"), queued)).toBe(false);
  });
});

describe("conditionsSummary", () => {
  it("reads naturally", () => {
    expect(conditionsSummary({})).toBe("Everyone");
    expect(conditionsSummary({ departments: ["Engineering"] })).toBe("Engineering");
    expect(conditionsSummary({ departments: ["Engineering"], locations: ["London", "Berlin"] })).toBe("Engineering in London, Berlin");
  });
});

import { personalise, ticketFieldValues } from "./rules";
describe("journey tickets and copy", () => {
  it("fills a request form from the template, then from the person", () => {
    const defs = [
      { key: "new_starter", type: "user", required: true },
      { key: "start_date", type: "date", required: true },
      { key: "laptop", type: "select", required: true, options: ["Air", "Pro"] },
      { key: "extras", type: "textarea" },
      { key: "until", type: "date", required: true, showIf: { key: "temporary", equals: true } },
    ];
    expect(ticketFieldValues(defs, { laptop: "Pro" }, { subjectId: "sam", anchor: "2026-10-16", text: "Order it" })).toEqual({
      new_starter: "sam",
      start_date: "2026-10-16",
      laptop: "Pro",
    });
    expect(ticketFieldValues(defs, {}, { subjectId: "sam", anchor: "2026-10-16", text: "x" }).laptop).toBe("Air");
  });
  it("personalises template text", () => {
    expect(personalise("Plan {firstName}'s first week", { displayName: "Sam Okafor", firstName: "Sam" })).toBe("Plan Sam's first week");
    expect(personalise("Laptop for {name}", { displayName: "Sam Okafor" })).toBe("Laptop for Sam Okafor");
  });
});
