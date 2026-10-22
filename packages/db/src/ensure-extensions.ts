import { pg as sql } from "./client";

await sql`create extension if not exists vector`;
await sql`create extension if not exists pg_trgm`;
await sql.end();
