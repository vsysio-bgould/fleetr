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

    // Stale-job guard: verify the job ID still matches the expected pattern.
    // When the FC manually advances, we cancel the old job and create a new one
    // with the same deterministic ID. If somehow both run, the second will find
    // the playback state already updated and exit without side effects.
    const expectedJobId = `fleet-advance-${fleetId}`;
    if (job.id !== expectedJobId) {
      logger.warn(
        { jobId: job.id, expectedJobId, fleetId },
        "Stale queue-advance job — discarding"
      );
      return;
    }

    // Read current mode to advance the right queue
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { mode: true, disbandedAt: true },
    });

    if (!fleet || fleet.disbandedAt) {
      logger.info({ fleetId }, "Fleet disbanded — skipping queue advance");
      return;
    }

    // Find the next entry in the active queue
    const current = await db.playback.findUnique({
      where: { fleetId },
      select: { queueEntryId: true },
    });

    const nextEntry = await db.queueEntry.findFirst({
      where: {
        fleetId,
        queue: fleet.mode,
        removedAt: null,
        // Skip current entry (we just finished playing it)
        NOT: current?.queueEntryId
          ? { id: current.queueEntryId }
          : undefined,
      },
      orderBy: [{ position: "asc" }],
    });

    const appUrl =
      process.env.PARTYKIT_APP_URL ??
      process.env.INTERNAL_APP_URL ??
      process.env.APP_URL ??
      "http://localhost:3000";
    const secret = process.env.PARTYKIT_SECRET ?? "";

    if (!nextEntry) {
      // Queue exhausted — clear reference and notify clients
      const response = await fetch(`${appUrl}/api/v1/internal/fleets/${fleetId}/playback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PartyKit-Secret": secret,
        },
        body: JSON.stringify({
          queueEntryId: null,
          initiatedBy: null,
        }),
      });
      if (!response.ok) {
        throw new Error(`Internal playback clear failed with ${response.status}`);
      }

      logger.info({ fleetId }, "Queue exhausted after auto-advance");
      return;
    }

    // Advance to the next entry via internal API (which handles scheduling next job)
    const response = await fetch(`${appUrl}/api/v1/internal/fleets/${fleetId}/playback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PartyKit-Secret": secret,
      },
      body: JSON.stringify({
        queueEntryId: nextEntry.id,
        initiatedBy: null, // null = auto-advance
      }),
    });
    if (!response.ok) {
      throw new Error(`Internal playback advance failed with ${response.status}`);
    }

    logger.info(
      { fleetId, nextEntryId: nextEntry.id },
      "Auto-advanced to next track"
    );
  },
};

export default definition;
