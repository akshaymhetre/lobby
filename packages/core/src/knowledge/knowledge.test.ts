import { describe, expect, it } from "vitest";
import { canEditSpace, canViewPage, canViewSpace, effectiveAudience, pageAclPrincipals } from "./access";
import { docOutline, docSections, docToText, safeHref, slugify } from "./doc";
import { addDays, freshnessFactor, freshnessState, reminderToSend, shouldArchive } from "./freshness";
import { markdownToDoc } from "./markdown";

const today = "2026-10-15";

describe("freshness", () => {
  it("classifies review dates", () => {
    expect(freshnessState(addDays(today, 60), today)).toBe("verified");
    expect(freshnessState(addDays(today, 14), today)).toBe("due-soon");
    expect(freshnessState(today, today)).toBe("due-soon");
    expect(freshnessState(addDays(today, -1), today)).toBe("stale");
    expect(freshnessState(null, today)).toBe("unset");
  });
  it("maps state to the search factor", () => {
    expect(freshnessFactor(addDays(today, 60), today)).toBe(1);
    expect(freshnessFactor(addDays(today, 3), today)).toBe(0.7);
    expect(freshnessFactor(addDays(today, -3), today)).toBe(0.4);
  });
  it("sends each reminder once per review date, even after missed days", () => {
    const reviewBy = addDays(today, 10);
    expect(reminderToSend({ reviewBy, lastReminder: null }, today)).toBe("soon");
    expect(reminderToSend({ reviewBy, lastReminder: `${reviewBy}:soon` }, today)).toBeNull();
    expect(reminderToSend({ reviewBy: addDays(today, 15), lastReminder: null }, today)).toBeNull();
    expect(reminderToSend({ reviewBy: today, lastReminder: `${today}:soon` }, today)).toBe("due");
    expect(reminderToSend({ reviewBy: addDays(today, -3), lastReminder: null }, today)).toBe("due");
    expect(reminderToSend({ reviewBy: today, lastReminder: `${today}:due` }, today)).toBeNull();
    // A new review date resets the bookkeeping.
    expect(reminderToSend({ reviewBy, lastReminder: "2026-01-01:due" }, today)).toBe("soon");
  });
  it("archives only after the grace period", () => {
    expect(shouldArchive(addDays(today, -60), today)).toBe(false);
    expect(shouldArchive(addDays(today, -61), today)).toBe(true);
    expect(shouldArchive(null, today)).toBe(false);
  });
});

describe("access", () => {
  const eng = "11111111-1111-1111-1111-111111111111";
  const people = "22222222-2222-2222-2222-222222222222";
  const maya = { groupIds: [eng], has: () => false, user: { id: "u1" } } as never;
  const priya = { groupIds: [people], has: (r: string) => r === "content-editor", user: { id: "u2" } } as never;
  const open = { visibilityGroupIds: [], editorGroupIds: [] };
  const confidential = { visibilityGroupIds: [people], editorGroupIds: [] };

  it("hides a restricted space from people outside its groups", () => {
    expect(canViewSpace(maya, confidential)).toBe(false);
    expect(canViewSpace(priya, confidential)).toBe(true);
    expect(canViewPage(maya, confidential, { visibilityGroupIds: [] })).toBe(false);
    expect(canViewPage(priya, confidential, { visibilityGroupIds: [] })).toBe(true);
  });
  it("lets a page narrow an open space", () => {
    expect(canViewPage(maya, open, { visibilityGroupIds: [people] })).toBe(false);
    expect(canViewPage(priya, open, { visibilityGroupIds: [people] })).toBe(true);
  });
  it("never widens a restricted space, and never indexes an unreadable page as public", () => {
    expect(effectiveAudience(confidential, { visibilityGroupIds: [eng] })).toEqual([]);
    expect(pageAclPrincipals(confidential, { visibilityGroupIds: [eng] })).toBeNull();
    expect(pageAclPrincipals(open, { visibilityGroupIds: [] })).toEqual(["*"]);
    expect(pageAclPrincipals(confidential, { visibilityGroupIds: [] })).toEqual([`group:${people}`]);
  });
  it("lets editors edit but not engineers", () => {
    expect(canEditSpace(maya, open)).toBe(false);
    expect(canEditSpace(maya, { visibilityGroupIds: [], editorGroupIds: [eng] })).toBe(true);
    expect(canEditSpace(priya, open)).toBe(true);
  });
});

describe("documents", () => {
  const doc = markdownToDoc(`Intro with **bold** and a [link](/help/new).

## Before you start

- Laptop
- [ ] Unchecked task

## Steps

1. One
2. Two

### Detail

:::warning
Careful here.
:::

| Band | Range |
|---|---|
| L3 | 60k |

## Steps`) as never;

  it("parses markdown into tiptap nodes", () => {
    const types = (doc as { content: { type: string }[] }).content.map((n) => n.type);
    expect(types).toEqual(["paragraph", "heading", "bulletList", "taskList", "heading", "orderedList", "heading", "callout", "table", "heading"]);
  });
  it("projects plain text", () => {
    const text = docToText(doc);
    expect(text).toContain("Intro with bold and a link.");
    expect(text).toContain("- Laptop");
    expect(text).toContain("[ ] Unchecked task");
    expect(text).toContain("1. One");
    expect(text).toContain("Careful here.");
    expect(text).toContain("L3 | 60k");
  });
  it("gives headings unique anchors", () => {
    expect(docOutline(doc).map((o) => o.id)).toEqual(["before-you-start", "steps", "detail", "steps-2"]);
  });
  it("splits sections at level-2 headings and keeps level 3 inside", () => {
    const sections = docSections(doc);
    expect(sections.map((s) => s.id)).toEqual([null, "before-you-start", "steps", "steps-2"]);
    expect(sections[2]!.text).toContain("Careful here.");
  });
  it("keeps numbering when a code block splits an ordered list", () => {
    const d = markdownToDoc("1. Install\n\n```\nmake\n```\n\n2. Clone") as never;
    const lists = (d as { content: { type: string; attrs?: { start: number } }[] }).content.filter((n) => n.type === "orderedList");
    expect(lists.map((l) => l.attrs?.start)).toEqual([1, 2]);
    expect(docToText(d)).toContain("2. Clone");
  });
  it("slugifies", () => {
    expect(slugify("VPN & MFA: getting set up")).toBe("vpn-and-mfa-getting-set-up");
    expect(slugify("Café")).toBe("cafe");
  });
  it("only allows safe link targets", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("https://example.com")).toBe("https://example.com");
    expect(safeHref("/help/new")).toBe("/help/new");
    expect(safeHref("mailto:it@northwind.example")).toBe("mailto:it@northwind.example");
  });
});
