#!/usr/bin/env node
/**
 * Loads the fictional demo company (Northwind Labs) into a fresh Lobby database, once.
 * Runs as the one-shot `seed-demo` compose service, after migrate.mjs has brought the schema
 * up to date. It is safe to run on every `docker compose up`: when the database already has
 * people in it, it does nothing. Pass --force to seed anyway (only on an empty schema).
 *
 * After seeding it queues a full search reindex, which the worker picks up.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import postgres from "postgres";

const APP_ROOT = process.env.LOBBY_APP_ROOT ?? "/app";
const TSX = join(APP_ROOT, "apps/worker/node_modules/.bin/tsx");
const force = process.argv.includes("--force");
const log = (msg) => console.log(`[seed-demo] ${msg}`);

if (!process.env.DATABASE_URL) {
  console.error("[seed-demo] DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
let people = 0;
try {
  const [row] = await sql`select count(*)::int as n from users`;
  people = row.n;
} finally {
  await sql.end({ timeout: 5 });
}

if (people > 0 && !force) {
  log(`the database already has ${people} people, so the demo company is not loaded again.`);
  process.exit(0);
}

const run = (label, script, cwd) => {
  log(label);
  const res = spawnSync(TSX, [script], { cwd, stdio: "inherit", env: process.env });
  if (res.status !== 0) {
    console.error(`[seed-demo] ${label} failed (exit ${res.status ?? res.signal}).`);
    process.exit(res.status ?? 1);
  }
};

run("loading Northwind Labs", "src/seed/index.ts", join(APP_ROOT, "packages/db"));
run("queueing a search reindex for the worker", "src/reindex.ts", join(APP_ROOT, "apps/worker"));
log("done. Sign in at " + (process.env.LOBBY_URL ?? "http://localhost:4100") + " as maya.chen / northwind.");
