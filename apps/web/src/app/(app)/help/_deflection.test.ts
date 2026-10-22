import { describe, expect, it } from "vitest";
import { queryTerms, rankLooseHits, relevance, stem } from "./_deflection";

const page = (title: string, text: string, score = 0.01) => ({ title, text, score });

describe("queryTerms", () => {
  it("drops stopwords, short words and duplicates", () => {
    expect(queryTerms("I need a diagram tool for my laptop")).toEqual(["diagram", "tool", "laptop"]);
    expect(queryTerms("VPN drops every few minutes")).toEqual(["vpn", "drops"]);
    expect(queryTerms("reset my password password")).toEqual(["reset", "password"]);
  });
});

describe("stem", () => {
  it("meets the common inflections", () => {
    expect(stem("dropping")).toBe("drop");
    expect(stem("drops")).toBe("drop");
    expect(stem("licences")).toBe("licenc");
    expect(stem("diagramming")).toBe("diagram");
    expect(stem("vpn")).toBe("vpn");
  });
});

describe("relevance", () => {
  it("counts a title term double and a body term once", () => {
    expect(relevance(page("Using the VPN", "Tailscale is our VPN."), ["vpn", "dropping"])).toBe(2);
    expect(relevance(page("Setting up your laptop", "Order a monitor."), ["diagram", "tool", "laptop"])).toBe(2);
    expect(relevance(page("Information security policy", "Never paste data into a personal AI tool."), ["diagram", "tool", "laptop"])).toBe(1);
  });
});

describe("rankLooseHits (audit E2)", () => {
  // The search returns one chunk per page, so the laptop page arrives as whichever section ranked best.
  const laptop = page("Setting up your laptop", "Your laptop arrives configured. A new starter can order a monitor, keyboard, mouse and headset.", 0.0164);
  const mfa = page("Passwords and MFA › Before you start", "Your laptop, already set up. Your phone with the authenticator.", 0.0143);
  const dataHandling = page("Information security policy › Data handling", "Never paste customer data into a personal AI tool or any tool not listed in Apps.", 0.0147);

  it('"I need a diagram tool for my laptop" no longer surfaces MFA or Data handling for one shared word', () => {
    const terms = queryTerms("I need a diagram tool for my laptop");
    const kept = rankLooseHits([laptop, mfa, dataHandling], terms);
    expect(kept.map((h) => h.title)).toEqual(["Setting up your laptop"]);
    expect(kept).not.toContain(mfa);
    expect(kept).not.toContain(dataHandling);
  });

  it("positive control: a page about the thing still shows", () => {
    const vpn = page("Using the VPN › If something goes wrong", "Device not authorised: raise a VPN issue request.", 0.01);
    const travel = page("Information security policy › Travel", "Use the VPN on any network you do not control.", 0.0147);
    const kept = rankLooseHits([travel, vpn], queryTerms("VPN keeps dropping"));
    expect(kept.map((h) => h.title)).toEqual(["Using the VPN › If something goes wrong"]);
  });

  it("shows nothing when no page shares two terms", () => {
    expect(rankLooseHits([laptop, mfa, dataHandling], queryTerms("Need a licence for a diagram tool"))).toEqual([]);
  });

  it("caps at three, most relevant first", () => {
    const hits = [page("A", "vpn drop", 0.5), page("Using the VPN", "drop", 0.1), page("B", "vpn drop", 0.3), page("C", "vpn drop", 0.2)];
    expect(rankLooseHits(hits, ["vpn", "drops"]).map((h) => h.title)).toEqual(["Using the VPN", "A", "B"]);
  });
});
