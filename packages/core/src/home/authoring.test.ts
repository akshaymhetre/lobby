import { describe, expect, it } from "vitest";
import { cleanCardConfig, ContentError } from "./authoring";

describe("cleanCardConfig", () => {
  it("keeps safe links and marks external ones", () => {
    expect(
      cleanCardConfig("links", {
        links: [
          { label: "Help", href: "/help" },
          { label: "Status", href: "https://status.example" },
          { label: "", href: "" },
        ],
      }),
    ).toEqual({ links: [{ label: "Help", href: "/help" }, { label: "Status", href: "https://status.example", external: true }] });
  });
  it("refuses unsafe links", () => {
    expect(() => cleanCardConfig("links", { links: [{ label: "x", href: "javascript:alert(1)" }] })).toThrow(ContentError);
    expect(() => cleanCardConfig("links", { links: [] })).toThrow(ContentError);
  });
  it("needs a value or a computed KPI", () => {
    expect(cleanCardConfig("kpi", { compute: "next-payday", hint: "Monthly" })).toEqual({ compute: "next-payday", hint: "Monthly" });
    expect(cleanCardConfig("kpi", { value: "4 of 4" })).toEqual({ value: "4 of 4" });
    expect(() => cleanCardConfig("kpi", {})).toThrow(ContentError);
  });
  it("only embeds https and clamps height", () => {
    expect(cleanCardConfig("embed", { url: "https://status.example", height: 9999 })).toEqual({ url: "https://status.example", height: 600 });
    expect(() => cleanCardConfig("embed", { url: "http://x.example" })).toThrow(ContentError);
  });
});
