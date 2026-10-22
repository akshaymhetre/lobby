import { describe, expect, it } from "vitest";
import {
  applyGroupPatch,
  applyUserPatch,
  bodyToGroup,
  bodyToUserModel,
  modelToColumns,
  normalisePath,
  readPatchOps,
  rowToModel,
  SCHEMA,
  ScimError,
  toBool,
  toScimUser,
  type UserModel,
  type UserRowLike,
} from "./scim-map";

const MANAGER = "6b1f0c1e-2b8a-4c55-9f7e-1d2c3b4a5f60";

const row: UserRowLike = {
  id: "0f8fad5b-d9cb-469f-a165-70867728950e",
  email: "ravi.shankar@northwind.example",
  scimId: "00u1abcd",
  firstName: "Ravi",
  lastName: "Shankar",
  displayName: "Ravi Shankar",
  title: "Data Engineer",
  department: "Engineering",
  location: "Bengaluru",
  phone: null,
  timezone: "Asia/Kolkata",
  managerId: MANAGER,
  status: "active",
  startDate: "2026-10-01",
  endDate: null,
  pronouns: "he/him",
  createdAt: new Date("2026-09-01T10:00:00Z"),
  updatedAt: new Date("2026-09-02T10:00:00Z"),
};

const base = (): UserModel => rowToModel(row);
const ENT = SCHEMA.enterprise;

describe("toScimUser", () => {
  it("renders the core, enterprise and Lobby attributes", () => {
    const u = toScimUser(row, "https://lobby.test/api/scim/v2", { managerDisplayName: "Nikolai Petrov" });
    expect(u.id).toBe(row.id);
    expect(u.userName).toBe(row.email);
    expect(u.externalId).toBe("00u1abcd");
    expect(u.active).toBe(true);
    expect(u.emails).toEqual([{ value: row.email, type: "work", primary: true }]);
    expect(u.addresses).toEqual([{ type: "work", locality: "Bengaluru", primary: true }]);
    expect(u[ENT]).toEqual({
      department: "Engineering",
      manager: { value: MANAGER, $ref: `https://lobby.test/api/scim/v2/Users/${MANAGER}`, displayName: "Nikolai Petrov" },
    });
    expect(u[SCHEMA.lobby]).toEqual({ startDate: "2026-10-01", pronouns: "he/him" });
    expect(u.schemas).toContain(SCHEMA.user);
    expect(u.meta.location).toBe(`https://lobby.test/api/scim/v2/Users/${row.id}`);
  });

  it("reports deactivated people as active false", () => {
    expect(toScimUser({ ...row, status: "deactivated" }, "x").active).toBe(false);
  });
});

describe("bodyToUserModel", () => {
  it("maps a typical Okta create", () => {
    const m = bodyToUserModel({
      schemas: [SCHEMA.user],
      userName: "Felix.Wagner@Northwind.example",
      name: { givenName: "Felix", familyName: "Wagner" },
      emails: [{ primary: true, value: "felix.wagner@northwind.example", type: "work" }],
      displayName: "Felix Wagner",
      title: "Marketing Designer",
      active: true,
      externalId: "00uabc",
      addresses: [{ type: "work", locality: "Berlin" }],
      phoneNumbers: [{ type: "mobile", value: "+49 30 1234" }],
    });
    expect(m.userName).toBe("felix.wagner@northwind.example");
    expect(m.givenName).toBe("Felix");
    expect(m.location).toBe("Berlin");
    expect(m.phone).toBe("+49 30 1234");
    expect(m.externalId).toBe("00uabc");
    expect(m.active).toBe(true);
  });

  it("maps an Entra create with the enterprise extension and string booleans", () => {
    const m = bodyToUserModel({
      schemas: [SCHEMA.user, ENT],
      externalId: "felix",
      userName: "felix.wagner@northwind.example",
      active: "False",
      displayName: "Felix Wagner",
      [ENT]: { department: "Sales & Marketing", employeeNumber: "1042", manager: { value: MANAGER } },
    });
    expect(m.active).toBe(false);
    expect(m.department).toBe("Sales & Marketing");
    expect(m.managerId).toBe(MANAGER);
    expect(m.givenName).toBe("Felix");
    expect(m.familyName).toBe("Wagner");
  });

  it("falls back to the work email when userName is not an email", () => {
    const m = bodyToUserModel({ userName: "fwagner", emails: [{ value: "felix.wagner@northwind.example", type: "work" }] });
    expect(m.userName).toBe("felix.wagner@northwind.example");
  });

  it("refuses a missing or non-email userName", () => {
    expect(() => bodyToUserModel({ displayName: "x" })).toThrow(ScimError);
    expect(() => bodyToUserModel({ userName: "not-an-email" })).toThrow(/not an email/);
  });

  it("keeps extension fields on PUT when the extension is not sent", () => {
    const m = bodyToUserModel({ userName: row.email, name: { givenName: "Ravi", familyName: "Shankar" } }, base());
    expect(m.department).toBe("Engineering");
    expect(m.managerId).toBe(MANAGER);
    expect(m.startDate).toBe("2026-10-01");
    // core attributes absent from a PUT are cleared
    expect(m.title).toBeNull();
    expect(m.location).toBeNull();
  });

  it("reads Lobby extension start dates, trimming a time part", () => {
    const m = bodyToUserModel({ userName: "a@b.example", [SCHEMA.lobby]: { startDate: "2026-11-03T00:00:00Z", location: "Austin" } });
    expect(m.startDate).toBe("2026-11-03");
    expect(m.location).toBe("Austin");
  });
});

describe("readPatchOps", () => {
  it("accepts mixed-case ops as Entra sends them", () => {
    expect(readPatchOps({ schemas: [SCHEMA.patch], Operations: [{ op: "Replace", path: "active", value: "False" }] })).toEqual([
      { op: "replace", path: "active", value: "False" },
    ]);
  });

  it("rejects empty and unknown operations", () => {
    expect(() => readPatchOps({ Operations: [] })).toThrow(ScimError);
    expect(() => readPatchOps({ Operations: [{ op: "move", path: "x" }] })).toThrow(/Unknown op/);
  });
});

describe("normalisePath", () => {
  it("shortens extension URNs and unifies case and quotes", () => {
    expect(normalisePath(`${ENT}:department`)).toBe("enterprise:department");
    expect(normalisePath("urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager")).toBe("enterprise:manager");
    expect(normalisePath(`emails[type eq 'work'].value`)).toBe('emails[type eq "work"].value');
    expect(normalisePath("urn:ietf:params:scim:schemas:core:2.0:User:title")).toBe("title");
  });
});

describe("applyUserPatch", () => {
  it("deactivates on Entra's string False", () => {
    const m = applyUserPatch(base(), [{ op: "replace", path: "active", value: "False" }]);
    expect(m.active).toBe(false);
  });

  it("applies Entra's path-less replace with a value object of qualified keys", () => {
    const m = applyUserPatch(base(), [
      {
        op: "replace",
        value: {
          active: "True",
          displayName: "Ravi S. Shankar",
          title: "Senior Data Engineer",
          "name.givenName": "Ravi S.",
          [`${ENT}:department`]: "Data",
          [`${ENT}:manager`]: "11111111-2222-3333-4444-555555555555",
          'addresses[type eq "work"].locality': "London",
        },
      },
    ]);
    expect(m.displayName).toBe("Ravi S. Shankar");
    expect(m.title).toBe("Senior Data Engineer");
    expect(m.givenName).toBe("Ravi S.");
    expect(m.department).toBe("Data");
    expect(m.managerId).toBe("11111111-2222-3333-4444-555555555555");
    expect(m.location).toBe("London");
    expect(m.active).toBe(true);
  });

  it("applies Okta's path-less replace with nested name and extension objects", () => {
    const m = applyUserPatch(base(), [
      { op: "replace", value: { name: { familyName: "Shankar-Iyer" }, [ENT]: { department: "Platform" }, active: false } },
    ]);
    expect(m.familyName).toBe("Shankar-Iyer");
    expect(m.givenName).toBe("Ravi");
    expect(m.department).toBe("Platform");
    expect(m.active).toBe(false);
  });

  it("handles manager as a string, an object, and removal", () => {
    const other = "11111111-2222-3333-4444-555555555555";
    expect(applyUserPatch(base(), [{ op: "add", path: `${ENT}:manager`, value: other }]).managerId).toBe(other);
    expect(applyUserPatch(base(), [{ op: "replace", path: `${ENT}:manager`, value: { value: other } }]).managerId).toBe(other);
    expect(applyUserPatch(base(), [{ op: "remove", path: `${ENT}:manager` }]).managerId).toBeNull();
  });

  it("updates the work email, which is the userName", () => {
    const m = applyUserPatch(base(), [{ op: "replace", path: 'emails[type eq "work"].value', value: "Ravi.S@northwind.example" }]);
    expect(m.userName).toBe("ravi.s@northwind.example");
  });

  it("removes simple attributes", () => {
    const m = applyUserPatch(base(), [
      { op: "remove", path: "title" },
      { op: "remove", path: 'addresses[type eq "work"].locality' },
    ]);
    expect(m.title).toBeNull();
    expect(m.location).toBeNull();
  });

  it("refuses to remove userName and refuses a garbage active value", () => {
    expect(() => applyUserPatch(base(), [{ op: "remove", path: "userName" }])).toThrow(/cannot be removed/);
    expect(() => applyUserPatch(base(), [{ op: "replace", path: "active", value: "maybe" }])).toThrow(/true or false/);
  });

  it("ignores unsupported attributes but rejects unsupported filtered paths", () => {
    expect(applyUserPatch(base(), [{ op: "replace", path: `${ENT}:employeeNumber`, value: "7" }])).toEqual(base());
    expect(() => applyUserPatch(base(), [{ op: "replace", path: 'title[value eq "x"]', value: "y" }])).toThrow(/not supported/);
  });

  it("does not mutate its input", () => {
    const before = base();
    applyUserPatch(before, [{ op: "replace", path: "title", value: "CEO" }]);
    expect(before.title).toBe("Data Engineer");
  });
});

describe("toBool", () => {
  it("accepts booleans and case-insensitive strings", () => {
    expect(toBool(true)).toBe(true);
    expect(toBool("FALSE")).toBe(false);
    expect(toBool(" True ")).toBe(true);
    expect(() => toBool(0)).toThrow(ScimError);
  });
});

describe("modelToColumns", () => {
  it("round-trips a row", () => {
    const cols = modelToColumns(base());
    expect(cols).toMatchObject({ email: row.email, scimId: "00u1abcd", firstName: "Ravi", managerId: MANAGER, location: "Bengaluru" });
  });
});

describe("groups", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("reads a create body", () => {
    expect(bodyToGroup({ displayName: "Data", externalId: "g1", members: [{ value: A }, { value: B, display: "x" }] })).toEqual({
      displayName: "Data",
      externalId: "g1",
      members: [A, B],
    });
    expect(() => bodyToGroup({ members: [] })).toThrow(/displayName is required/);
  });

  it("adds and removes members with Entra's filtered remove path", () => {
    const c = applyGroupPatch([
      { op: "add", path: "members", value: [{ value: A }, { value: B }] },
      { op: "remove", path: `members[value eq "${A}"]` },
    ]);
    expect(c.addMembers).toEqual([B]);
    expect(c.removeMembers).toEqual([A]);
    expect(c.replaceMembers).toBeUndefined();
  });

  it("removes members listed in a value array (Okta)", () => {
    expect(applyGroupPatch([{ op: "remove", path: "members", value: [{ value: A }] }]).removeMembers).toEqual([A]);
  });

  it("treats a remove of members with no value as clearing the group", () => {
    expect(applyGroupPatch([{ op: "remove", path: "members" }]).replaceMembers).toEqual([]);
  });

  it("applies a path-less replace of displayName and members", () => {
    const c = applyGroupPatch([{ op: "replace", value: { id: "ignored", displayName: "Data team", members: [{ value: A }] } }]);
    expect(c.displayName).toBe("Data team");
    expect(c.replaceMembers).toEqual([A]);
  });

  it("lets later operations win over a replace", () => {
    const c = applyGroupPatch([
      { op: "replace", path: "members", value: [{ value: A }] },
      { op: "add", path: "members", value: [{ value: B }] },
      { op: "remove", path: `members[value eq "${A}"]` },
    ]);
    expect(c.replaceMembers).toEqual([B]);
  });

  it("rejects unsupported group paths", () => {
    expect(() => applyGroupPatch([{ op: "replace", path: "owners", value: [] }])).toThrow(/not supported/);
  });
});
