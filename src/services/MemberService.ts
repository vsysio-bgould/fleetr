import db from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { SessionRole } from "@prisma/client";
import { broadcastToFleet } from "@/lib/broadcast";
import logger from "@/lib/logger";

export class MemberService {
  async list(fleetId: string) {
    const sessions = await db.session.findMany({
      where: { fleetId },
      include: {
        character: {
          select: { characterId: true, characterName: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return sessions.map((s) => ({
      characterId: s.characterId,
      characterName: s.character.characterName,
      role: s.role,
      solarSystem: s.solarSystem,
      joinedAt: s.createdAt,
    }));
  }

  async kick(fleetId: string, fcCharacterId: number, targetCharacterId: number) {
    if (fcCharacterId === targetCharacterId) {
      throw new ForbiddenError("Cannot kick yourself");
    }

    const target = await db.session.findUnique({
      where: { fleetId_characterId: { fleetId, characterId: targetCharacterId } },
      include: { character: { select: { characterName: true } } },
    });

    if (!target) {
      throw new NotFoundError("Member not found in fleet");
    }

    if (target.role === SessionRole.FLEET_COMMANDER) {
      throw new ForbiddenError("Cannot kick the fleet commander");
    }

    await db.session.delete({
      where: { fleetId_characterId: { fleetId, characterId: targetCharacterId } },
    });

    await db.auditLog.create({
      data: {
        event: "member.kicked",
        actor: String(fcCharacterId),
        payload: { fleetId, targetCharacterId, targetName: target.character.characterName },
      },
    });

    void broadcastToFleet(fleetId, {
      type: "member:kicked",
      payload: { characterId: targetCharacterId },
    });

    logger.info({ fleetId, fcCharacterId, targetCharacterId }, "Member kicked");
  }
}
