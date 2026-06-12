import crypto from "crypto";
import db from "@/lib/db";
import type { IEsiClient } from "@/infra/esi/types";
import {
  ForbiddenError,
  FleetExpiredError,
  NotFoundError,
  NotInFleetError,
} from "@/lib/errors";
import type { MediaSource } from "@prisma/client";
import logger from "@/lib/logger";

const FC_ROLES: ReadonlySet<string> = new Set([
  "fleet_commander",
  "wing_commander",
  "squad_commander",
]);

/** Returned when creating a fleet — includes the join token for the FC. */
export interface FleetCreated {
  fleetId: string;
  joinToken: string;
  joinUrl: string;
}

/** Returned from GET /fleets/:id — omits the join token, includes member count. */
export interface FleetDetails {
  id: string;
  esiFleetId: string;
  name: string;
  mode: string;
  mediaSource: string;
  fcCharacterId: number;
  memberCount: number;
  expiresAt: Date | null;
  disbandedAt: Date | null;
  createdAt: Date;
}

export class FleetService {
  constructor(private readonly esiClient: IEsiClient) {}

  async create(
    fcCharacterId: number,
    accessToken: string,
    mediaSource: MediaSource = "YOUTUBE"
  ): Promise<FleetCreated> {
    const membership = await this.esiClient.getFleetMembership(
      fcCharacterId,
      accessToken
    );

    if (!membership) {
      throw new NotInFleetError();
    }

    if (!FC_ROLES.has(membership.role)) {
      throw new ForbiddenError(
        "You must be a Fleet Commander, Wing Commander, or Squad Commander to create a Fleetr fleet"
      );
    }

    const character = await this.esiClient.getCharacter(fcCharacterId);

    const joinToken = generateJoinToken();

    const fleet = await db.fleet.create({
      data: {
        esiFleetId: membership.fleetId,
        name: character.name,
        joinToken,
        mode: "CRUISE",
        mediaSource,
        fcCharacterId,
      },
    });

    // Initialize empty playback reference
    await db.playback.create({
      data: { fleetId: fleet.id },
    });

    // Create FC session
    const sessionExpiry = new Date();
    sessionExpiry.setHours(sessionExpiry.getHours() + 24);

    await db.session.create({
      data: {
        fleetId: fleet.id,
        characterId: fcCharacterId,
        role: "FLEET_COMMANDER",
        grantedScopes: [],
        expiresAt: sessionExpiry,
      },
    });

    logger.info(
      { fleetId: fleet.id, fcCharacterId, mediaSource },
      "Fleet created"
    );

    const appUrl = process.env.APP_URL ?? "https://fleetr.app";
    return {
      fleetId: fleet.id,
      joinToken,
      joinUrl: `${appUrl}/join/${joinToken}`,
    };
  }

  async getById(fleetId: string): Promise<FleetDetails> {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      include: { _count: { select: { sessions: true } } },
    });
    if (!fleet) throw new NotFoundError("Fleet");

    const { joinToken: _omit, _count, ...rest } = fleet;
    return { ...rest, memberCount: _count.sessions };
  }

  async disband(fleetId: string, characterId: number): Promise<void> {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { fcCharacterId: true, disbandedAt: true },
    });

    if (!fleet) throw new NotFoundError("Fleet");
    if (fleet.fcCharacterId !== characterId) {
      throw new ForbiddenError("Only the Fleet Commander can disband a fleet");
    }
    if (fleet.disbandedAt) {
      throw new FleetExpiredError();
    }

    await db.fleet.update({
      where: { id: fleetId },
      data: { disbandedAt: new Date() },
    });

    logger.info({ fleetId, characterId }, "Fleet disbanded");
  }

  async regenerateToken(
    fleetId: string,
    characterId: number
  ): Promise<{ joinToken: string; joinUrl: string }> {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { fcCharacterId: true },
    });

    if (!fleet) throw new NotFoundError("Fleet");
    if (fleet.fcCharacterId !== characterId) {
      throw new ForbiddenError(
        "Only the Fleet Commander can regenerate the join token"
      );
    }

    const joinToken = generateJoinToken();
    await db.fleet.update({ where: { id: fleetId }, data: { joinToken } });

    const appUrl = process.env.APP_URL ?? "https://fleetr.app";
    return { joinToken, joinUrl: `${appUrl}/join/${joinToken}` };
  }
}

function generateJoinToken(): string {
  return crypto.randomBytes(16).toString("hex");
}
