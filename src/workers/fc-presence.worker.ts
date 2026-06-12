import type { Job } from "bullmq";
import type { WorkerDefinition } from "@/workers/types";
import db from "@/lib/db";
import { EsiClient } from "@/infra/esi/EsiClient";
import { EsiErrorBudget } from "@/infra/esi/EsiErrorBudget";
import { EsiTokenStore } from "@/infra/esi/EsiTokenStore";
import { broadcastToFleet } from "@/lib/broadcast";
import logger from "@/lib/logger";

interface FcPresencePayload {
  /** Specific fleet to check; omit to scan all active fleets. */
  fleetId?: string;
}

const BUDGET_MINIMUM = 26;

/**
 * Checks whether the FC is still in the EVE fleet backing a Fleetr fleet.
 * If ESI definitively reports the FC has left (or moved to a different
 * fleet), the Fleetr fleet is disbanded and clients are notified so the
 * web UI can offer to create a new one. Transient ESI failures are skipped
 * — a fleet is only disbanded on a definitive answer.
 */
const definition: WorkerDefinition<FcPresencePayload> = {
  queueName: "fc-presence",
  concurrency: 2,

  async process(job: Job<FcPresencePayload>) {
    const { fleetId } = job.data;

    // Scan mode: fan out a check job per active fleet.
    if (!fleetId) {
      const { fcPresenceQueue } = await import("@/lib/queue");
      const fleets = await db.fleet.findMany({
        where: {
          disbandedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      });
      await Promise.all(
        fleets.map((f) =>
          fcPresenceQueue.add("check", { fleetId: f.id }, { jobId: `fc-presence-${f.id}` })
        )
      );
      logger.debug({ count: fleets.length }, "fc-presence: scan queued checks");
      return;
    }

    const budget = new EsiErrorBudget();
    const remaining = await budget.remaining();
    if (remaining !== null && remaining < BUDGET_MINIMUM) {
      logger.warn({ fleetId, remaining }, "fc-presence: error budget too low, skipping");
      return;
    }

    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { esiFleetId: true, fcCharacterId: true, disbandedAt: true, expiresAt: true },
    });

    if (!fleet || fleet.disbandedAt || (fleet.expiresAt && fleet.expiresAt < new Date())) {
      logger.info({ fleetId }, "fc-presence: fleet inactive, skipping");
      return;
    }

    const esiClient = new EsiClient();
    const token = await new EsiTokenStore().getOrRefresh(fleet.fcCharacterId, esiClient);
    if (!token) {
      logger.warn(
        { fleetId, fcCharacterId: fleet.fcCharacterId },
        "fc-presence: no ESI token for FC, skipping"
      );
      return;
    }

    // ESI 404 maps to null = definitively not in any fleet.
    // Other ESI errors throw and the check is skipped this round.
    const membership = await esiClient.getFleetMembership(fleet.fcCharacterId, token.accessToken);

    const fcStillPresent = membership !== null && membership.fleetId === fleet.esiFleetId;
    if (fcStillPresent) return;

    await db.fleet.update({
      where: { id: fleetId },
      data: { disbandedAt: new Date() },
    });

    logger.info(
      {
        fleetId,
        fcCharacterId: fleet.fcCharacterId,
        currentEsiFleetId: membership?.fleetId ?? null,
      },
      "fc-presence: FC left EVE fleet, Fleetr fleet disbanded"
    );

    await broadcastToFleet(fleetId, { type: "fleet:disbanded" });
  },
};

export default definition;
