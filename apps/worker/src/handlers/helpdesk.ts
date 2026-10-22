import { QUEUES } from "@lobby/core/jobs";
import { runSlaCheck } from "@lobby/core/helpdesk";
import { pushTicket, type PushJob } from "@lobby/connectors";
import type { HandlerModule } from "../types";

/** Background work for the helpdesk module: the SLA sweep every minute, and connector pushes. */
export const helpdesk: HandlerModule = {
  handlers: {
    [QUEUES.slaCheck]: async () => {
      const r = await runSlaCheck();
      if (r.firstResponse.length || r.resolution.length) {
        console.info(`[helpdesk] SLA breaches: first response ${r.firstResponse.map((n) => `#${n}`).join(", ") || "none"}; resolution ${r.resolution.map((n) => `#${n}`).join(", ") || "none"}`);
      }
    },
    [QUEUES.connectorPush]: async (job: PushJob) => {
      const outcome = await pushTicket(job);
      console.info(`[helpdesk] connector push ${job.event} ticket=${job.ticketId} connector=${job.connectorId}: ${outcome}`);
    },
  },
  schedules: {
    [QUEUES.slaCheck]: "* * * * *",
  },
};
