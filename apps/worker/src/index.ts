/**
 * Lobby background worker: email delivery, search indexing, SLA timers, journey steps,
 * content freshness and notification digests. Runs as its own process next to the web app.
 */
import { boss } from "@lobby/core/jobs";
import type { HandlerModule } from "./types";
import { email } from "./handlers/email";
import { search } from "./handlers/search";
import { helpdesk } from "./handlers/helpdesk";
import { journeys } from "./handlers/journeys";
import { knowledge } from "./handlers/knowledge";
import { notifications } from "./handlers/notifications";
import { ai } from "./handlers/ai";

const modules: HandlerModule[] = [email, search, helpdesk, journeys, knowledge, notifications, ai];

const b = await boss();
for (const mod of modules) {
  for (const [queue, handler] of Object.entries(mod.handlers)) {
    await b.work(queue, { batchSize: 1 }, async ([job]) => {
      if (!job) return;
      try {
        await (handler as (d: unknown) => Promise<void>)(job.data ?? {});
      } catch (err) {
        console.error(`[worker] ${queue} failed:`, err);
        throw err;
      }
    });
  }
  for (const [queue, cron] of Object.entries(mod.schedules ?? {})) {
    await b.schedule(queue, cron as string, {});
  }
}
for (const mod of modules) {
  await mod.onStart?.().catch((err) => console.error("[worker] onStart failed:", err));
}
console.log(`[worker] ready: ${modules.flatMap((m) => Object.keys(m.handlers)).join(", ")}`);

const shutdown = async () => {
  console.log("[worker] stopping");
  await b.stop({ graceful: true, timeout: 10_000 });
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
