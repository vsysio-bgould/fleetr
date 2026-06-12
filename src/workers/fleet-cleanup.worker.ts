import type { Job } from "bullmq";
import type { WorkerDefinition } from "@/workers/types";
import db from "@/lib/db";
import logger from "@/lib/logger";

interface FleetCleanupPayload {
  olderThanDays?: number;
}

const definition: WorkerDefinition<FleetCleanupPayload> = {
  queueName: "fleet-cleanup",
  concurrency: 1,

  async process(job: Job<FleetCleanupPayload>) {
    const days = job.data.olderThanDays ?? 7;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const fleets = await db.fleet.findMany({
      where: {
        OR: [
          { disbandedAt: { lt: cutoff } },
          { expiresAt: { lt: cutoff } },
        ],
      },
      select: { id: true },
    });

    if (fleets.length === 0) {
      logger.info("fleet-cleanup: no expired fleets to clean up");
      return;
    }

    const fleetIds = fleets.map((f) => f.id);

    // Delete in dependency order
    await db.vote.deleteMany({ where: { entry: { fleetId: { in: fleetIds } } } });
    await db.playback.deleteMany({ where: { fleetId: { in: fleetIds } } });
    await db.queueEntry.deleteMany({ where: { fleetId: { in: fleetIds } } });
    await db.session.deleteMany({ where: { fleetId: { in: fleetIds } } });
    await db.fleetDelegate.deleteMany({ where: { fleetId: { in: fleetIds } } });
    await db.fleet.deleteMany({ where: { id: { in: fleetIds } } });

    logger.info({ count: fleetIds.length, olderThanDays: days }, "fleet-cleanup: cleaned up expired fleets");
  },
};

export default definition;
