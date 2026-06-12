import {
  fleetCleanupQueue,
  sessionCleanupQueue,
  esiTokenRefreshQueue,
  fcPresenceQueue,
} from "@/lib/queue";
import logger from "@/lib/logger";

/**
 * Registers repeatable BullMQ jobs so the stack is self-scheduling —
 * no external cron is required. Safe to call on every worker start:
 * BullMQ deduplicates repeatable jobs by name + repeat options.
 *
 * The /api/v1/internal/cron endpoint remains available for manual or
 * external triggering of the same jobs.
 */
export async function registerRepeatableJobs(): Promise<void> {
  await Promise.all([
    // Check FC presence in their EVE fleet every 2 minutes
    fcPresenceQueue.add(
      "scan",
      {},
      { repeat: { every: 2 * 60 * 1000 }, jobId: "fc-presence-scan" }
    ),

    // Refresh ESI tokens expiring soon, every 5 minutes
    esiTokenRefreshQueue.add(
      "scan",
      {},
      { repeat: { every: 5 * 60 * 1000 }, jobId: "esi-token-refresh-scan" }
    ),

    // Remove expired sessions and API tokens every 30 minutes
    sessionCleanupQueue.add(
      "cleanup",
      {},
      { repeat: { every: 30 * 60 * 1000 }, jobId: "session-cleanup-scan" }
    ),

    // Purge long-disbanded fleets daily
    fleetCleanupQueue.add(
      "cleanup",
      { olderThanDays: 7 },
      { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: "fleet-cleanup-scan" }
    ),
  ]);

  logger.info("Repeatable jobs registered");
}
