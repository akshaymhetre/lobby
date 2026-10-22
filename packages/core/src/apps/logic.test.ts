import { describe, expect, it } from "vitest";
import {
  groupByCategory, hasPlaceholder, isAppVisible, matchesQuery, monogram, moveInOrder, onColor, recentAppIds,
  reconcilePinOrder, safeLaunchUrl, slugify, uniqueSlug,
} from "./logic";
import { APP_PRESETS, getPreset } from "./presets";

describe("isAppVisible", () => {
  it("shows apps with no visibility rows to everyone", () => {
    expect(isAppVisible([], [])).toBe(true);
    expect(isAppVisible([], ["g1"])).toBe(true);
  });
  it("shows restricted apps only to members of a listed group", () => {
    expect(isAppVisible(["eng"], ["eng", "x"])).toBe(true);
    expect(isAppVisible(["eng", "sales"], ["sales"])).toBe(true);
    expect(isAppVisible(["eng"], ["sales"])).toBe(false);
    expect(isAppVisible(["eng"], [])).toBe(false);
  });
});

describe("safeLaunchUrl", () => {
  it("accepts http and https", () => {
    expect(safeLaunchUrl(" https://grafana.example/login ")).toBe("https://grafana.example/login");
    expect(safeLaunchUrl("http://localhost:4130/login/generic_oauth")).toBe("http://localhost:4130/login/generic_oauth");
  });
  it("refuses script, data and relative URLs", () => {
    expect(safeLaunchUrl("javascript:alert(1)")).toBeNull();
    expect(safeLaunchUrl("JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeLaunchUrl("data:text/html,hi")).toBeNull();
    expect(safeLaunchUrl("/apps")).toBeNull();
    expect(safeLaunchUrl("")).toBeNull();
    expect(safeLaunchUrl("ftp://files.example")).toBeNull();
  });
});

describe("hasPlaceholder", () => {
  it("spots unreplaced preset placeholders", () => {
    expect(hasPlaceholder("https://{tenant}.slack.com")).toBe(true);
    expect(hasPlaceholder("https://northwind.slack.com")).toBe(false);
  });
});

describe("slugs", () => {
  it("slugifies names", () => {
    expect(slugify("AWS console")).toBe("aws-console");
    expect(slugify("Café Órders!")).toBe("cafe-orders");
    expect(slugify("!!!")).toBe("app");
  });
  it("avoids collisions", () => {
    expect(uniqueSlug("slack", new Set())).toBe("slack");
    expect(uniqueSlug("slack", new Set(["slack", "slack-2"]))).toBe("slack-3");
  });
});

describe("groupByCategory", () => {
  it("orders preferred categories first, then alphabetically, and sorts apps by name", () => {
    const out = groupByCategory(
      [
        { name: "Zoom", category: "Communication" },
        { name: "Figma", category: "Design" },
        { name: "Slack", category: "Communication" },
        { name: "Acme", category: "Analytics" },
      ],
      ["Communication"],
    );
    expect(out.map((g) => g.category)).toEqual(["Communication", "Analytics", "Design"]);
    expect(out[0]!.items.map((a) => a.name)).toEqual(["Slack", "Zoom"]);
  });
});

describe("pin ordering", () => {
  it("moves an item one place and ignores out-of-range moves", () => {
    expect(moveInOrder(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveInOrder(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveInOrder(["a", "b", "c"], "z", 1)).toEqual(["a", "b", "c"]);
  });
  it("never lets a client add, duplicate or lose pins", () => {
    expect(reconcilePinOrder(["c", "evil", "a", "c"], ["a", "b", "c"])).toEqual(["c", "a", "b"]);
    expect(reconcilePinOrder([], ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("recentAppIds", () => {
  it("returns distinct apps newest first", () => {
    const t = (h: number) => new Date(Date.UTC(2026, 9, 15, h));
    const launches = [
      { appId: "a", at: t(1) },
      { appId: "b", at: t(3) },
      { appId: "a", at: t(5) },
      { appId: "c", at: t(2) },
    ];
    expect(recentAppIds(launches)).toEqual(["a", "b", "c"]);
    expect(recentAppIds(launches, 2)).toEqual(["a", "b"]);
  });
});

describe("matchesQuery", () => {
  const app = { name: "Grafana", description: "Dashboards and alerts", category: "Engineering" };
  it("matches every word across fields", () => {
    expect(matchesQuery(app, "graf")).toBe(true);
    expect(matchesQuery(app, "engineering dash")).toBe(true);
    expect(matchesQuery(app, "dash payroll")).toBe(false);
    expect(matchesQuery(app, "  ")).toBe(true);
  });
});

describe("monogram and colour", () => {
  it("makes two-letter monograms", () => {
    expect(monogram("Expenses")).toBe("E");
    expect(monogram("AWS console")).toBe("AC");
    expect(monogram("Microsoft 365")).toBe("M");
  });
  it("picks readable text on brand fills", () => {
    expect(onColor("#4A154B")).toBe("white");
    expect(onColor("#73C41D")).toBe("black");
    expect(onColor("#000000")).toBe("white");
    expect(onColor("#FFFFFF")).toBe("black");
  });
});

describe("APP_PRESETS", () => {
  it("has unique keys, a custom entry, and launch URLs that are valid once placeholders are filled", () => {
    const keys = APP_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(getPreset("custom")).toBeDefined();
    for (const p of APP_PRESETS) {
      if (p.key === "custom") continue;
      const filled = p.launchUrl.replace("{tenant}", "northwind").replace("{domain}", "northwind.example");
      expect(safeLaunchUrl(filled), p.key).not.toBeNull();
    }
  });
});
