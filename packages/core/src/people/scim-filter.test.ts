import { describe, expect, it } from "vitest";
import { matchesFilter, parseScimFilter, ScimFilterError } from "./scim-filter";

describe("parseScimFilter", () => {
  it("parses the filters Okta and Entra send", () => {
    expect(parseScimFilter('userName eq "maya.chen@northwind.example"')).toEqual([
      { attr: "userName", op: "eq", value: "maya.chen@northwind.example" },
    ]);
    expect(parseScimFilter('externalId eq "00u1"')).toEqual([{ attr: "externalId", op: "eq", value: "00u1" }]);
    expect(parseScimFilter('emails[type eq "work"].value eq "a@b.example"')).toEqual([{ attr: "email", op: "eq", value: "a@b.example" }]);
    expect(parseScimFilter('displayName eq "Engineering"')).toEqual([{ attr: "displayName", op: "eq", value: "Engineering" }]);
  });

  it("is case-insensitive on attribute names and operators and joins with and", () => {
    expect(parseScimFilter('USERNAME EQ "x@y.example" and active Eq true')).toEqual([
      { attr: "userName", op: "eq", value: "x@y.example" },
      { attr: "active", op: "eq", value: true },
    ]);
  });

  it("accepts schema-qualified attribute paths and escaped quotes", () => {
    expect(parseScimFilter('urn:ietf:params:scim:schemas:core:2.0:User:userName eq "a\\"b@c.example"')).toEqual([
      { attr: "userName", op: "eq", value: 'a"b@c.example' },
    ]);
    expect(parseScimFilter('urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:department eq "IT"')[0]!.attr).toBe("department");
  });

  it("supports pr and returns nothing for an empty filter", () => {
    expect(parseScimFilter("externalId pr")).toEqual([{ attr: "externalId", op: "pr", value: null }]);
    expect(parseScimFilter("")).toEqual([]);
    expect(parseScimFilter(undefined)).toEqual([]);
  });

  it("rejects or, unknown attributes, unsupported operators and garbage", () => {
    expect(() => parseScimFilter('userName eq "a" or userName eq "b"')).toThrow(ScimFilterError);
    expect(() => parseScimFilter('nickName eq "x"')).toThrow(/not supported/);
    expect(() => parseScimFilter('meta.lastModified gt "2026-01-01"')).toThrow(ScimFilterError);
    expect(() => parseScimFilter("userName eq")).toThrow(/needs a value/);
    expect(() => parseScimFilter("(((")).toThrow(ScimFilterError);
  });
});

describe("matchesFilter", () => {
  const user = { userName: "Maya.Chen@northwind.example", externalId: "00u1", active: true, email: ["maya.chen@northwind.example"] };

  it("matches case-insensitively", () => {
    expect(matchesFilter(user, parseScimFilter('userName eq "maya.chen@NORTHWIND.example"'))).toBe(true);
    expect(matchesFilter(user, parseScimFilter('userName sw "maya"'))).toBe(true);
    expect(matchesFilter(user, parseScimFilter('userName eq "grace@northwind.example"'))).toBe(false);
  });

  it("handles booleans, presence and multi-valued attributes", () => {
    expect(matchesFilter(user, parseScimFilter("active eq true"))).toBe(true);
    expect(matchesFilter(user, parseScimFilter("active eq false"))).toBe(false);
    expect(matchesFilter(user, parseScimFilter("externalId pr"))).toBe(true);
    expect(matchesFilter(user, parseScimFilter('emails.value eq "maya.chen@northwind.example"'))).toBe(true);
  });
});
