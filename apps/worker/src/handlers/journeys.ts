import { runJourneysTick } from "@lobby/core/journeys";
import { QUEUES } from "@lobby/core/jobs";
import type { HandlerModule } from "../types";

async function tick() {
  const summary = await runJourneysTick();
  const { today, ...counts } = summary;
  if (Object.values(counts).some((n) => n > 0)) console.log(`[journeys] tick ${today}`, counts);
}

/**
 * Background work for the journeys module: every 15 minutes (and once on start) start journeys
 * for people starting or leaving soon, raise due tickets, send due and overdue reminders and
 * close finished runs. The web app can also enqueue a tick after starting a journey by hand.
 */
export const journeys: HandlerModule = {
  handlers: {
    [QUEUES.journeysTick]: async () => {
      await tick();
    },
  },
  schedules: { [QUEUES.journeysTick]: "*/15 * * * *" },
  onStart: tick,
};
