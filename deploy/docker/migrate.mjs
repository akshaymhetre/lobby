#!/usr/bin/env node
/**
 * Brings the Lobby database schema up to date. Runs at container start, before the server.
 *
 * - Waits for Postgres to accept connections (up to LOBBY_DB_WAIT_SECONDS, default 60).
 * - Takes a session advisory lock, so web, worker and seed-demo starting together never race:
 *   the first one migrates, the others wait for the lock and then find nothing left to do.
 * - Creates the extensions Lobby needs (vector, pg_trgm) before the first migration uses them.
 * - Applies Drizzle SQL migrations from LOBBY_MIGRATIONS_DIR (default /opt/lobby/migrations).
 *
 * Plain JavaScript on purpose: it runs from /opt/lobby/migrate with its own node_modules
 * (drizzle-orm and postgres, pinned to the versions packages/db uses), independent of how the
 * web or worker image lays out its dependencies.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const DATABASE_URL = process.env.DATABASE_URL;
const MIGRATIONS_DIR = process.env.LOBBY_MIGRATIONS_DIR ?? "/opt/lobby/migrations";
const WAIT_SECONDS = Number(process.env.LOBBY_DB_WAIT_SECONDS ?? 60);
const EXTENSIONS = (process.env.LOBBY_DB_EXTENSIONS ?? "vector,pg_trgm")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
/** Any stable 64-bit number works; it only has to match between processes running this script. */
const LOCK_KEY = 4242_0000_0001n;

const log = (msg) => console.log(`[migrate] ${msg}`);
const fail = (msg) => {
  console.error(`[migrate] ${msg}`);
  process.exit(1);
};

if (!DATABASE_URL) fail("DATABASE_URL is not set.");
for (const ext of EXTENSIONS) {
  if (!/^[a-z0-9_]+$/.test(ext)) fail(`LOBBY_DB_EXTENSIONS contains an invalid name: ${JSON.stringify(ext)}`);
}
if (!existsSync(join(MIGRATIONS_DIR, "meta", "_journal.json"))) {
  fail(
    `No Drizzle migrations found in ${MIGRATIONS_DIR} (expected meta/_journal.json). ` +
      "Generate them with `pnpm --filter @lobby/db generate` and rebuild the image.",
  );
}

// One connection only: the advisory lock is held by a session, so every statement below,
// including the migrator's own transaction, must run on that same session.
const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {}, connect_timeout: 5 });

async function waitForDatabase() {
  const deadline = Date.now() + WAIT_SECONDS * 1000;
  for (let attempt = 1; ; attempt++) {
    try {
      await sql`select 1`;
      return;
    } catch (err) {
      if (Date.now() > deadline) throw err;
      if (attempt === 1 || attempt % 5 === 0) log(`waiting for Postgres (${err.code ?? err.message})`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

/**
 * A database built by `drizzle-kit push` (the development workflow) has the tables but no
 * migration history, so replaying migrations would fail half way on "already exists".
 * Refuse up front with an explanation instead.
 */
async function refusePushedDatabase() {
  const [row] = await sql`
    select to_regclass('public.org_settings')::text as tables,
           to_regclass('drizzle.__drizzle_migrations')::text as history`;
  if (row.tables && !row.history) {
    fail(
      "This database already has Lobby tables but no migration history, which means it was created " +
        "with `drizzle-kit push` (the development workflow). Point Lobby at an empty database, " +
        "or use a separate Docker volume for the container install.",
    );
  }
}

async function ensureExtensions() {
  for (const ext of EXTENSIONS) {
    try {
      await sql.unsafe(`create extension if not exists ${ext}`);
    } catch (err) {
      const [row] = await sql`select 1 as ok from pg_extension where extname = ${ext}`;
      if (row?.ok) continue;
      fail(
        `Could not create the Postgres extension "${ext}" (${err.message}). ` +
          "Use the pgvector/pgvector image, or ask your database administrator to run " +
          `\`create extension ${ext}\` once as a superuser.`,
      );
    }
  }
}

const started = Date.now();
try {
  await waitForDatabase();
  log("waiting for the migration lock");
  await sql`select pg_advisory_lock(${LOCK_KEY.toString()}::bigint)`;
  try {
    await refusePushedDatabase();
    await ensureExtensions();
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_DIR });
    const [{ n }] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    log(`database is up to date (${n} migrations applied in total, ${Date.now() - started}ms)`);
  } finally {
    await sql`select pg_advisory_unlock(${LOCK_KEY.toString()}::bigint)`.catch(() => {});
  }
} catch (err) {
  console.error("[migrate] migration failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
