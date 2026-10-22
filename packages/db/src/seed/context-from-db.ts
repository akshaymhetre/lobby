import { db } from "../client";
import * as s from "../schema/index";
import type { SeedContext } from "./util";

/** Rebuilds the seed context from rows already in the database (for seeding one module). */
export async function contextFromDb(): Promise<SeedContext> {
  const users = await db.select({ id: s.users.id, email: s.users.email, isBreakGlass: s.users.isBreakGlass }).from(s.users);
  const groups = await db.select({ id: s.groups.id, name: s.groups.name }).from(s.groups);
  const userIdByUsername = new Map(
    users.map((u) => [u.isBreakGlass ? "admin" : u.email.split("@")[0]!, u.id] as const),
  );
  const groupIdByName = new Map(groups.map((g) => [g.name, g.id] as const));
  return {
    userIdByUsername,
    groupIdByName,
    user: (u) => {
      const id = userIdByUsername.get(u);
      if (!id) throw new Error(`seed: unknown user ${u}`);
      return id;
    },
    group: (g) => {
      const id = groupIdByName.get(g);
      if (!id) throw new Error(`seed: unknown group ${g}`);
      return id;
    },
  };
}
