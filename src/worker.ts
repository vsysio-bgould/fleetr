/**
 * Worker process entry point. Start with:
 *   node --loader ts-node/esm src/worker.ts
 * or via the compiled build. Registers all WorkerDefinition modules.
 */
import { Worker } from "bullmq";
import logger from "@/lib/logger";

// BullMQ bundles its own ioredis — pass the URL to avoid type conflicts.
const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
import type { WorkerDefinition } from "@/workers/types";

// Import all worker definitions explicitly so bundlers can tree-shake.
const definitions: WorkerDefinition<unknown>[] = [];

async function loadWorkers() {
  const modules = await Promise.all([
    import("@/workers/queue-advance.worker"),
    import("@/workers/fleet-cleanup.worker"),
    import("@/workers/session-cleanup.worker"),
    import("@/workers/esi-token-refresh.worker"),
    import("@/workers/location-sync.worker"),
  ]);
  for (const mod of modules) {
    definitions.push(mod.default as WorkerDefinition<unknown>);
  }
}

async function start() {
  await loadWorkers();

  const workers: Worker[] = [];

  for (const def of definitions) {
    const worker = new Worker(
      def.queueName,
      async (job) => {
        try {
          await (def as WorkerDefinition<unknown>).process(job);
        } catch (err) {
          logger.error({ err, jobId: job.id, queue: def.queueName }, "Worker job failed");
          throw err;
        }
      },
      {
        connection,
        concurrency: def.concurrency ?? 1,
      }
    );

    worker.on("completed", (job) => {
      logger.info({ jobId: job.id, queue: def.queueName }, "Job completed");
    });

    worker.on("failed", (job, err) => {
      logger.error({ jobId: job?.id, queue: def.queueName, err }, "Job failed");
    });

    workers.push(worker);
    logger.info({ queue: def.queueName, concurrency: def.concurrency ?? 1 }, "Worker registered");
  }

  logger.info({ count: workers.length }, "All workers started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down workers...");
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

start().catch((err) => {
  logger.error({ err }, "Failed to start worker process");
  process.exit(1);
});
