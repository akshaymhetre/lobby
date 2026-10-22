/** Applies SQL migrations from ./migrations (development and CI; containers use deploy/docker/migrate.mjs). */
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, pg } from "./client";

await pg`create extension if not exists vector`;
await pg`create extension if not exists pg_trgm`;
await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
console.log("migrations applied");
await pg.end();
