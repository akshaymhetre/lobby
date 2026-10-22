import { describe, expect, it } from "vitest";
import { accentTokens, contrast } from "./color";

const brands = ["#2F5D50", "#FFD400", "#00A3FF", "#E11D48", "#7C3AED", "#FFFFFF", "#000000", "#84CC16", "#F97316"];

describe("accentTokens", () => {
  for (const brand of brands) {
    it(`keeps ${brand} accessible in both themes`, () => {
      const { light, dark } = accentTokens(brand);
      expect(contrast(light.accentFg, light.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(light.accentText, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(light.accentText, "#EEF0F3")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark.accentFg, dark.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark.accentText, "#11262B")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark.accentText, "#183238")).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("does not change a brand colour that already passes", () => {
    expect(accentTokens("#2F5D50").light.accent).toBe("#2F5D50");
  });
});
