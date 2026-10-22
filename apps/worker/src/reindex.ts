import { enqueue, QUEUES } from "@lobby/core/jobs";

await enqueue(QUEUES.reindexAll, {});
console.log("queued a full search reindex; the worker will process it");
process.exit(0);
