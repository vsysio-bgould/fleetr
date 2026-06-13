import crypto from "crypto";
import db from "@/lib/db";
import type { IEsiClient } from "@/infra/esi/types";
import { ForbiddenError, FleetExpiredError, NotFoundError, NotInFleetError } from "@/lib/errors";
import type { MediaSource, SessionRole } from "@prisma/client";
import logger from "@/lib/logger";
import { hasFleetControl } from "@/lib/roles";

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
    creatorCharacterId: number,
    accessToken: string,
    mediaSource: MediaSource = "YOUTUBE",
    options: { operatorOverride?: boolean } = {}
  ): Promise<FleetCreated> {
    const membership = await this.esiClient.getFleetMembership(
      creatorCharacterId,
      accessToken
    );

    if (!membership) {
      throw new NotInFleetError();
    }

    const isFleetBoss = membership.fleetBossId === creatorCharacterId;
    const isFleetCommander = membership.role === "fleet_commander";

    if (!options.operatorOverride && !isFleetBoss && !isFleetCommander) {
      throw new ForbiddenError(
        "You must be the Fleet Boss or Fleet Commander to create a Fleetr fleet"
      );
    }

    const bossCharacter = await this.esiClient.getCharacter(membership.fleetBossId);
    if (!isFleetBoss) {
      await db.user.upsert({
        where: { characterId: membership.fleetBossId },
        update: { characterName: bossCharacter.name },
        create: {
          characterId: membership.fleetBossId,
          characterName: bossCharacter.name,
        },
      });
    }

    const joinToken = generateJoinToken();

    const fleet = await db.fleet.create({
      data: {
        esiFleetId: membership.fleetId,
        name: bossCharacter.name,
        joinToken,
        mode: "CRUISE",
        mediaSource,
        fcCharacterId: membership.fleetBossId,
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
        characterId: creatorCharacterId,
        role: isFleetBoss
          ? "FLEET_BOSS"
          : isFleetCommander
            ? "FLEET_COMMANDER"
            : "LINE_MEMBER",
        grantedScopes: [],
        expiresAt: sessionExpiry,
      },
    });

    logger.info(
      {
        fleetId: fleet.id,
        creatorCharacterId,
        fleetBossId: membership.fleetBossId,
        mediaSource,
      },
      "Fleet created"
    );

    return {
      fleetId: fleet.id,
      joinToken,
      joinUrl: buildJoinUrl(joinToken),
    };
  }

  async getById(fleetId: string): Promise<FleetDetails> {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      include: { _count: { select: { sessions: true } } },
    });
    if (!fleet) throw new NotFoundError("Fleet");

    return {
      id: fleet.id,
      esiFleetId: fleet.esiFleetId,
      name: fleet.name,
      mode: fleet.mode,
      mediaSource: fleet.mediaSource,
      fcCharacterId: fleet.fcCharacterId,
      memberCount: fleet._count.sessions,
      expiresAt: fleet.expiresAt,
      disbandedAt: fleet.disbandedAt,
      createdAt: fleet.createdAt,
    };
  }

  async disband(fleetId: string, characterId: number, role: SessionRole): Promise<void> {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { disbandedAt: true },
    });

    if (!fleet) throw new NotFoundError("Fleet");
    if (!hasFleetControl(role)) {
      throw new ForbiddenError("This action requires fleet control access");
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
    characterId: number,
    role: SessionRole
  ): Promise<{ joinToken: string; joinUrl: string }> {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { id: true },
    });

    if (!fleet) throw new NotFoundError("Fleet");
    if (!hasFleetControl(role)) {
      throw new ForbiddenError("This action requires fleet control access");
    }

    const joinToken = generateJoinToken();
    await db.fleet.update({ where: { id: fleetId }, data: { joinToken } });

    return { joinToken, joinUrl: buildJoinUrl(joinToken) };
  }

  async getJoinLink(fleetId: string): Promise<{ joinToken: string; joinUrl: string }> {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { joinToken: true },
    });

    if (!fleet) throw new NotFoundError("Fleet");
    return {
      joinToken: fleet.joinToken,
      joinUrl: buildJoinUrl(fleet.joinToken),
    };
  }
}

function generateJoinToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

function buildJoinUrl(joinToken: string): string {
  const appUrl = process.env.APP_URL ?? "https://fleetr.app";
  return `${appUrl}/join/${joinToken}`;
}
