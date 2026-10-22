import { freshnessTick } from "@lobby/core/knowledge";
import type { HandlerModule } from "../types";

/** Background work for the knowledge module: the daily freshness engine. */
export const knowledge: HandlerModule = {
  handlers: {
    "knowledge.freshness-tick": async () => {
      const r = await freshnessTick();
      console.log(
        `[knowledge] freshness tick: ${r.remindedSoon} due-soon reminders, ${r.remindedDue} due reminders, ${r.archived} archived, ${r.reindexed} reindexed`,
      );
    },
  },
  // 06:00 UTC daily, before anyone in London or Berlin starts work.
  schedules: { "knowledge.freshness-tick": "0 6 * * *" },
};
