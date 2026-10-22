/** Rebuilds the people search index: `pnpm --filter @lobby/core exec tsx src/people/reindex-cli.ts` */
import { pg } from "@lobby/db";
import { reindexPeople } from "./index-source";

const n = await reindexPeople();
console.log(`indexed ${n} people`);
await pg.end();
