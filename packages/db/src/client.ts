import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

export const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://lobby:lobby@localhost:4132/lobby";

const globalForDb = globalThis as unknown as { __lobbyPg?: postgres.Sql };

/** One pool per process; survives Next.js dev hot reloads. */
export const pg = globalForDb.__lobbyPg ?? postgres(DATABASE_URL, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.__lobbyPg = pg;

export const db = drizzle(pg, { schema, casing: "snake_case" });
export type Db = typeof db;
