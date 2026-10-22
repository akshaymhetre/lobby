import { describe, expect, it } from "vitest";
import { buildImportRows, detectMapping, groupKey, parseCsv, parseDate, TEMPLATE_CSV } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, CRLF, BOM and blank lines", () => {
    const text = '\uFEFFemail,title\r\n"a@b.example","Head of ""Fun"", London"\r\n\r\nc@d.example,\n';
    expect(parseCsv(text)).toEqual([
      ["email", "title"],
      ["a@b.example", 'Head of "Fun", London'],
      ["c@d.example", ""],
    ]);
  });

  it("keeps newlines inside quoted fields", () => {
    expect(parseCsv('a,b\n"line one\nline two",x')).toEqual([["a", "b"], ["line one\nline two", "x"]]);
  });

  it("detects semicolon-separated files", () => {
    expect(parseCsv("email;name\na@b.example;Ann")).toEqual([["email", "name"], ["a@b.example", "Ann"]]);
  });
});

describe("detectMapping", () => {
  it("maps the template headers", () => {
    const headers = parseCsv(TEMPLATE_CSV)[0]!;
    const m = detectMapping(headers);
    expect(m.email).toBe(0);
    expect(m.firstName).toBe(1);
    expect(m.lastName).toBe(2);
    expect(m.title).toBe(3);
    expect(m.managerEmail).toBe(6);
    expect(m.startDate).toBe(7);
    expect(m.groups).toBe(8);
    expect(m.displayName).toBe(-1);
  });

  it("maps typical HRIS export headers and never reuses a column", () => {
    const m = detectMapping(["Employee Name", "Work Email", "Job Title", "Team", "Office", "Reports To", "Hire Date"]);
    expect(m).toMatchObject({ displayName: 0, email: 1, title: 2, department: 3, location: 4, managerEmail: 5, startDate: 6 });
    const used = Object.values(m).filter((v) => v >= 0);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe("parseDate", () => {
  it("reads common formats and rejects impossible dates", () => {
    expect(parseDate("2026-03-14")).toBe("2026-03-14");
    expect(parseDate("14/03/2026")).toBe("2026-03-14");
    expect(parseDate("2026/3/4")).toBe("2026-03-04");
    expect(parseDate("14 Mar 2026")).toBe("2026-03-14");
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("soon")).toBeNull();
  });
});

describe("buildImportRows", () => {
  const rows = parseCsv(
    [
      "email,name,manager_email,start_date,groups",
      "Ann.Lee@northwind.example,Ann Lee,boss@northwind.example,2026-11-03,Product & Design; design-crit",
      "bad-email,Bob,,,",
      "ann.lee@northwind.example,Ann Again,,,",
      "cat@northwind.example,,ghost@northwind.example,next week,",
      "boss@northwind.example,Big Boss,,,",
      "dan@northwind.example,Dan,dan@northwind.example,,",
    ].join("\n"),
  );
  const out = buildImportRows(rows, detectMapping(rows[0]!), new Set(["maya.chen@northwind.example"]));

  it("normalises and splits names and groups", () => {
    expect(out[0]).toMatchObject({ line: 2, email: "ann.lee@northwind.example", firstName: "Ann", lastName: "Lee", groups: ["Product & Design", "design-crit"], errors: [] });
  });

  it("flags bad emails, duplicates, unreadable dates and self-management", () => {
    expect(out[1]!.errors[0]).toMatch(/not an email/);
    expect(out[2]!.errors).toContain("Same email as line 2.");
    expect(out[3]!.errors[0]).toMatch(/not a date/);
    expect(out[5]!.errors).toContain("Someone cannot be their own manager.");
  });

  it("warns about unknown managers and made-up names without blocking the row", () => {
    expect(out[3]!.warnings.join(" ")).toMatch(/ghost@northwind.example is not in Lobby/);
    expect(out[3]!.warnings.join(" ")).toMatch(/made one from the email/);
    expect(out[3]!.displayName).toBe("Cat");
    expect(out[0]!.warnings).toEqual([]);
  });
});

describe("groupKey", () => {
  it("makes stable keys", () => {
    expect(groupKey("Product & Design")).toBe("product-and-design");
    expect(groupKey(" sales-marketing ")).toBe("sales-marketing");
  });
});
