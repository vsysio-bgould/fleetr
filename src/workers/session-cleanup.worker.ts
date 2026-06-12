import type { Job } from "bullmq";
import type { WorkerDefinition } from "@/workers/types";
import db from "@/lib/db";
import logger from "@/lib/logger";

interface SessionCleanupPayload {
  batchSize?: number;
}

const definition: WorkerDefinition<SessionCleanupPayload> = {
  queueName: "session-cleanup",
  concurrency: 1,

  async process(job: Job<SessionCleanupPayload>) {
    void job;
    const now = new Date();

    const result = await db.session.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    // Also clean expired API tokens
    const tokenResult = await db.apiToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    logger.info(
      { sessions: result.count, tokens: tokenResult.count },
      "session-cleanup: removed expired sessions and tokens"
    );
  },
};

export default definition;
