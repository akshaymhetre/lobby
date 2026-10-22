/**
 * Demo seed: a fictional company ("Northwind Labs") with people, apps, content, tickets and journeys.
 * Run against an empty schema: `pnpm db:reset` drops, recreates and seeds.
 * Order matters: later seeders reference rows created by earlier ones.
 */
import { pg } from "../client";
import { seedBase } from "./base";
import { seedPeople } from "./people";
import { seedApps } from "./apps";
import { seedHome } from "./home";
import { seedKnowledge } from "./knowledge";
import { seedHelpdesk } from "./helpdesk";
import { seedJourneys } from "./journeys";

const started = Date.now();
const ctx = await seedBase();
await seedPeople(ctx);
await seedApps(ctx);
await seedKnowledge(ctx);
await seedHelpdesk(ctx);
await seedJourneys(ctx);
await seedHome(ctx);
console.log(`seeded demo company in ${Date.now() - started}ms (${ctx.userIdByUsername.size} people)`);
console.log("Search index: run the worker (it reindexes on start) or `pnpm --filter @lobby/worker reindex`.");
await pg.end();
