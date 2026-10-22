/**
 * Re-seeds ONE module against the existing database without touching anything else:
 *   pnpm --filter @lobby/db seed:one helpdesk
 * Every module seeder must be idempotent: delete its own module's rows first, then insert.
 */
import { pg } from "../client";
import { contextFromDb } from "./context-from-db";
import { seedPeople } from "./people";
import { seedApps } from "./apps";
import { seedHome } from "./home";
import { seedKnowledge } from "./knowledge";
import { seedHelpdesk } from "./helpdesk";
import { seedJourneys } from "./journeys";

const seeders = { people: seedPeople, apps: seedApps, home: seedHome, knowledge: seedKnowledge, helpdesk: seedHelpdesk, journeys: seedJourneys };
const name = process.argv[2] as keyof typeof seeders;
if (!seeders[name]) {
  console.error(`usage: seed:one <${Object.keys(seeders).join("|")}>`);
  process.exit(1);
}
await seeders[name](await contextFromDb());
console.log(`seeded ${name}`);
await pg.end();
