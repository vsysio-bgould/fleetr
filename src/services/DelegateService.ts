import db from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { SessionRole } from "@prisma/client";
import { broadcastToFleet } from "@/lib/broadcast";
import { canManageDelegation } from "@/lib/roles";

export class DelegateService {
  async list(fleetId: string) {
    const delegates = await db.fleetDelegate.findMany({
      where: { fleetId },
      include: {
        character: { select: { characterId: true, characterName: true } },
        grantor: { select: { characterId: true, characterName: true } },
      },
      orderBy: { grantedAt: "asc" },
    });

    return delegates.map((d) => ({
      characterId: d.characterId,
      characterName: d.character.characterName,
      grantedBy: d.grantedBy,
      grantedByName: d.grantor.characterName,
      grantedAt: d.grantedAt,
    }));
  }

  async grant(fleetId: string, grantorCharacterId: number, targetCharacterId: number) {
    if (grantorCharacterId === targetCharacterId) {
      throw new ForbiddenError("Cannot delegate to yourself");
    }

    const targetSession = await db.session.findUnique({
      where: { fleetId_characterId: { fleetId, characterId: targetCharacterId } },
    });

    if (!targetSession) {
      throw new NotFoundError("Target character is not in the fleet");
    }

    if (canManageDelegation(targetSession.role)) {
      throw new ForbiddenError("Target already has boss or commander access");
    }

    await db.fleetDelegate.upsert({
      where: { fleetId_characterId: { fleetId, characterId: targetCharacterId } },
      create: { fleetId, characterId: targetCharacterId, grantedBy: grantorCharacterId },
      update: { grantedBy: grantorCharacterId, grantedAt: new Date() },
    });

    await db.session.update({
      where: { fleetId_characterId: { fleetId, characterId: targetCharacterId } },
      data: { role: SessionRole.FC_DELEGATE },
    });

    void broadcastToFleet(fleetId, {
      type: "member:role-changed",
      characterId: targetCharacterId,
      role: SessionRole.FC_DELEGATE,
    });
  }

  async revoke(fleetId: string, targetCharacterId: number) {
    const delegate = await db.fleetDelegate.findUnique({
      where: { fleetId_characterId: { fleetId, characterId: targetCharacterId } },
    });

    if (!delegate) {
      throw new NotFoundError("Delegate not found");
    }

    await db.fleetDelegate.delete({
      where: { fleetId_characterId: { fleetId, characterId: targetCharacterId } },
    });

    await db.session.updateMany({
      where: {
        fleetId,
        characterId: targetCharacterId,
        role: SessionRole.FC_DELEGATE,
      },
      data: { role: SessionRole.LINE_MEMBER },
    });

    void broadcastToFleet(fleetId, {
      type: "member:role-changed",
      characterId: targetCharacterId,
      role: SessionRole.LINE_MEMBER,
    });
  }
}
