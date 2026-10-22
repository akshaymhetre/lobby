import { pg as sql } from "./client";

if (process.env.NODE_ENV === "production") throw new Error("refusing to reset a production database");
await sql`drop schema if exists public cascade`;
await sql`create schema public`;
await sql`drop schema if exists pgboss cascade`;
await sql.end();
console.log("database reset");
