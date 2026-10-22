import { describe, expect, it } from "vitest";
import { passwordStrength, MIN_PASSWORD_LENGTH } from "./password";
import { isUploadName, sniffImage } from "./uploads";
import { explainProbeError } from "./identity";
import { brandingInput, normaliseHex } from "./branding";

describe("passwordStrength", () => {
  it("refuses anything shorter than the minimum", () => {
    expect(passwordStrength("a".repeat(MIN_PASSWORD_LENGTH - 1)).acceptable).toBe(false);
  });
  it("refuses common words and the company name", () => {
    expect(passwordStrength("password-password-1").acceptable).toBe(false);
    expect(passwordStrength("northwind-rocks-2026", ["Northwind"]).acceptable).toBe(false);
  });
  it("accepts a long passphrase and rates it strong", () => {
    const s = passwordStrength("Correct-Horse-Battery-Staple-9");
    expect(s.acceptable).toBe(true);
    expect(s.score).toBe(4);
  });
});

describe("sniffImage", () => {
  const bytes = (...b: number[]) => new Uint8Array(b);
  it("recognises image formats from their magic bytes", () => {
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(sniffImage(new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("svg");
  });
  it("rejects anything else, whatever it claims to be", () => {
    expect(sniffImage(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImage(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull();
  });
  it("only serves content-addressed names", () => {
    expect(isUploadName("0123456789abcdef0123456789abcdef.png")).toBe(true);
    expect(isUploadName("../../etc/passwd")).toBe(false);
    expect(isUploadName("0123456789abcdef0123456789abcdef.html")).toBe(false);
  });
});

describe("explainProbeError", () => {
  it("turns DNS failures into a sentence about the issuer", () => {
    const err = Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND" } });
    expect(explainProbeError(err, "https://idp.example")).toMatch(/could not find the host/);
  });
  it("reads the HTTP status openid-client attaches", () => {
    const err = Object.assign(new Error("unexpected HTTP response status code"), { cause: { status: 404 } });
    expect(explainProbeError(err, "https://idp.example/realms/x")).toMatch(/realms\/x\/.well-known/);
  });
  it("explains a missing discovery document", () => {
    expect(explainProbeError(new Error("discovery failed: HTTP 404"), "https://idp.example")).toMatch(/well-known/);
  });
});

describe("branding", () => {
  it("normalises short hex colours", () => {
    expect(normaliseHex("#2f5")).toBe("#22FF55");
  });
  it("validates timezone and working days", () => {
    const r = brandingInput.safeParse({ companyName: "N", accentColor: "#2F5D50", timezone: "Mars/Base", workingDays: [] });
    expect(r.success).toBe(false);
    const fields = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["timezone", "workingDays"]));
  });
});
