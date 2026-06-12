import type { Job } from "bullmq";
import type { WorkerDefinition } from "@/workers/types";
import db from "@/lib/db";
import { EsiClient } from "@/infra/esi/EsiClient";
import { EsiErrorBudget } from "@/infra/esi/EsiErrorBudget";
import { broadcastToFleet } from "@/lib/broadcast";
import logger from "@/lib/logger";

interface LocationSyncPayload {
  fleetId: string;
}

const BUDGET_MINIMUM = 26;

const definition: WorkerDefinition<LocationSyncPayload> = {
  queueName: "location-sync",
  concurrency: 2,

  async process(job: Job<LocationSyncPayload>) {
    const { fleetId } = job.data;

    const budget = new EsiErrorBudget();
    const remaining = await budget.remaining();
    if (remaining !== null && remaining < BUDGET_MINIMUM) {
      logger.warn({ fleetId, remaining }, "location-sync: error budget too low, skipping");
      return;
    }

    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { disbandedAt: true, expiresAt: true },
    });

    if (!fleet || fleet.disbandedAt || (fleet.expiresAt && fleet.expiresAt < new Date())) {
      logger.info({ fleetId }, "location-sync: fleet inactive, skipping");
      return;
    }

    const sessions = await db.session.findMany({
      where: { fleetId, expiresAt: { gt: new Date() } },
      select: {
        characterId: true,
        grantedScopes: true,
        character: {
          select: {
            esiToken: { select: { accessToken: true, characterId: true } },
          },
        },
      },
    });

    const LOCATION_SCOPE = "esi-location.read_location.v1";
    const esi = new EsiClient();

    // Collect solarSystemId per character
    const systemIds: Record<number, number | null> = {};

    await Promise.allSettled(
      sessions
        .filter((s) => {
          const scopes = s.grantedScopes as string[];
          return scopes.includes(LOCATION_SCOPE) && s.character.esiToken;
        })
        .map(async (s) => {
          const token = s.character.esiToken!.accessToken;
          try {
            const loc = await esi.getLocation(s.characterId, token);
            systemIds[s.characterId] = loc?.solarSystemId ?? null;
          } catch (err) {
            logger.warn({ characterId: s.characterId, err }, "location-sync: ESI call failed");
            systemIds[s.characterId] = null;
          }
        })
    );

    // Resolve unique system IDs to names in parallel
    const uniqueIds = Array.from(new Set(Object.values(systemIds).filter((id): id is number => id !== null)));
    const nameMap = new Map<number, string>();

    await Promise.allSettled(
      uniqueIds.map(async (id) => {
        try {
          const name = await esi.getSolarSystemName(id);
          if (name) nameMap.set(id, name);
        } catch {
          // leave unnamed — not worth failing the job
        }
      })
    );

    // Build final locations: characterId -> solarSystem name (or null)
    const locations: Record<number, string | null> = {};
    for (const [charId, sysId] of Object.entries(systemIds)) {
      locations[Number(charId)] = sysId !== null ? (nameMap.get(sysId) ?? null) : null;
    }

    // Persist last-known location so GET /fleets/:id/members can return it
    await Promise.allSettled(
      Object.entries(locations).map(([charId, name]) =>
        db.session.update({
          where: { fleetId_characterId: { fleetId, characterId: Number(charId) } },
          data: { solarSystem: name },
        })
      )
    );

    if (Object.keys(locations).length > 0) {
      void broadcastToFleet(fleetId, {
        type: "member:location-updated",
        payload: { locations },
      });
    }

    logger.debug({ fleetId, count: Object.keys(locations).length }, "location-sync: complete");
  },
};

export default definition;
