import type { QueueName } from "@lobby/core/jobs";

/** A queue handler. Return value is ignored; throw to let pg-boss retry. */
export type Handler<T = Record<string, unknown>> = (data: T) => Promise<void>;

export interface HandlerModule {
  handlers: Partial<Record<QueueName, Handler<never>>>;
  /** cron expressions (UTC) per queue for recurring work. */
  schedules?: Partial<Record<QueueName, string>>;
  /** Runs once when the worker starts (e.g. initial reindex). */
  onStart?: () => Promise<void>;
}
