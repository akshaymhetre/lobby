import { PgBoss } from "pg-boss";
import { DATABASE_URL } from "@lobby/db";

/**
 * Every background queue in one place. The web app only sends; apps/worker registers handlers.
 * Add a queue here, then a handler in apps/worker/src/handlers.
 */
export const QUEUES = {
  sendEmail: "email.send",
  indexSource: "search.index-source",
  reindexAll: "search.reindex-all",
  slaCheck: "helpdesk.sla-check",
  connectorPush: "helpdesk.connector-push",
  journeysTick: "journeys.tick",
  freshnessTick: "knowledge.freshness-tick",
  notificationDigest: "notifications.digest",
  aiRetention: "ai.retention",
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

const g = globalThis as unknown as { __lobbyBoss?: Promise<PgBoss> };

export function boss(): Promise<PgBoss> {
  g.__lobbyBoss ??= (async () => {
    const b = new PgBoss(DATABASE_URL);
    b.on("error", (err) => console.error("[jobs]", err));
    await b.start();
    for (const name of Object.values(QUEUES)) await b.createQueue(name);
    return b;
  })();
  return g.__lobbyBoss;
}

export async function enqueue(name: QueueName, data: object = {}, options: { startAfter?: Date | number; singletonKey?: string } = {}) {
  const b = await boss();
  return b.send(name, data, options);
}
