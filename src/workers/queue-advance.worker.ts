import type { Job } from "bullmq";
import type { WorkerDefinition } from "@/workers/types";
import db from "@/lib/db";
import logger from "@/lib/logger";

interface QueueAdvancePayload {
  fleetId: string;
}

const definition: WorkerDefinition<QueueAdvancePayload> = {
  queueName: "queue-advance",
  concurrency: 5,

  async process(job: Job<QueueAdvancePayload>) {
    const { fleetId } = job.data;

    const expectedJobId = `fleet-advance-${fleetId}`;
    if (job.id !== expectedJobId) {
      logger.warn(
        { jobId: job.id, expectedJobId, fleetId },
        "Stale queue-advance job - discarding"
      );
      return;
    }

    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { disbandedAt: true },
    });

    if (!fleet || fleet.disbandedAt) {
      logger.info({ fleetId }, "Fleet disbanded - skipping queue advance");
      return;
    }

    const appUrl =
      process.env.PARTYKIT_APP_URL ??
      process.env.INTERNAL_APP_URL ??
      process.env.APP_URL ??
      "http://localhost:3000";
    const secret = process.env.PARTYKIT_SECRET ?? "";

    const response = await fetch(`${appUrl}/api/v1/internal/fleets/${fleetId}/playback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PartyKit-Secret": secret,
      },
      body: JSON.stringify({
        advance: true,
        initiatedBy: null,
      }),
    });
    if (!response.ok) {
      throw new Error(`Internal playback advance failed with ${response.status}`);
    }

    logger.info({ fleetId }, "Auto-advance requested");
  },
};

export default definition;
