import db from "@/lib/db";
import type { SessionRole } from "@prisma/client";
import type { IEsiClient } from "@/infra/esi/types";
import {
  NotFoundError,
  FleetExpiredError,
  NotInFleetError,
} from "@/lib/errors";
import logger from "@/lib/logger";

export interface JoinResult {
  fleetId: string;
  sessionId: string;
  role: string;
}

export class FleetJoinService {
  constructor(private readonly esiClient: IEsiClient) {}

  async join(
    joinToken: string,
    characterId: number,
    accessToken: string | null,
    grantedScopes: string[] = []
  ): Promise<JoinResult> {
    const fleet = await db.fleet.findUnique({
      where: { joinToken },
      select: {
        id: true,
        esiFleetId: true,
        disbandedAt: true,
        expiresAt: true,
        fcCharacterId: true,
      },
    });

    if (!fleet) {
      throw new NotFoundError("Fleet");
    }

    if (fleet.disbandedAt || (fleet.expiresAt && fleet.expiresAt < new Date())) {
      throw new FleetExpiredError();
    }

    // Gate: verify the character is actually in this EVE fleet
    let eveRole: string | null = null;
    let fleetBossId = fleet.fcCharacterId;
    if (accessToken) {
      const membership = await this.esiClient.getFleetMembership(
        characterId,
        accessToken
      );

      if (!membership) {
        throw new NotInFleetError();
      }

      if (membership.fleetId !== fleet.esiFleetId) {
        throw new NotInFleetError();
      }
      eveRole = membership.role;
      fleetBossId = membership.fleetBossId;
    } else {
      // No token = minimum scope flow; cannot verify membership
      // The join token itself is the authorization mechanism in this case
    }

    // Check for existing delegate grant to set role
    const delegate = await db.fleetDelegate.findUnique({
      where: {
        fleetId_characterId: { fleetId: fleet.id, characterId },
      },
    });

    const role: SessionRole =
      characterId === fleetBossId || characterId === fleet.fcCharacterId
        ? "FLEET_BOSS"
        : eveRole === "fleet_commander"
          ? "FLEET_COMMANDER"
        : delegate
          ? "FC_DELEGATE"
          : "LINE_MEMBER";

    const sessionExpiry = new Date();
    sessionExpiry.setHours(sessionExpiry.getHours() + 24);

    const session = await db.session.upsert({
      where: {
        fleetId_characterId: { fleetId: fleet.id, characterId },
      },
      update: {
        role,
        grantedScopes,
        expiresAt: sessionExpiry,
      },
      create: {
        fleetId: fleet.id,
        characterId,
        role,
        grantedScopes,
        expiresAt: sessionExpiry,
      },
    });

    logger.info({ fleetId: fleet.id, characterId, role }, "Character joined fleet");

    return { fleetId: fleet.id, sessionId: session.id, role };
  }

  async leave(fleetId: string, characterId: number): Promise<void> {
    await db.session
      .delete({
        where: {
          fleetId_characterId: { fleetId, characterId },
        },
      })
      .catch(() => null); // OK if session doesn't exist

    logger.info({ fleetId, characterId }, "Character left fleet");
  }
}
