import { QUEUES } from "@lobby/core/jobs";
import { pruneConversations } from "@lobby/ai";
import type { HandlerModule } from "../types";

/** Deletes assistant conversations older than the configured retention window. */
export const ai: HandlerModule = {
  handlers: {
    [QUEUES.aiRetention]: async () => {
      const n = await pruneConversations();
      if (n) console.log(`[ai] pruned ${n} conversations past retention`);
    },
  },
  schedules: { [QUEUES.aiRetention]: "17 3 * * *" },
};
