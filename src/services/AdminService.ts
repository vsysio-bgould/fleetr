import db from "@/lib/db";
import redis from "@/lib/redis";
import { NotFoundError } from "@/lib/errors";

export class AdminService {
  async getStats() {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      activeFleets,
      connectedMembers,
      fleetsWithMembers,
      esiErrorBudget,
      tokenRefreshFailures24h,
      dbOk,
      redisOk,
    ] = await Promise.all([
      db.fleet.count({ where: { disbandedAt: null } }),
      db.session.count({ where: { expiresAt: { gt: new Date() } } }),
      // Fleets with at least one live session — proxy for PartyKit room count
      db.session
        .groupBy({ by: ["fleetId"], where: { expiresAt: { gt: new Date() } } })
        .then((rows) => rows.length),
      redis.get("esi:error-budget").then((v) => (v !== null ? parseInt(v, 10) : null)),
      db.auditLog.count({
        where: { event: "esi.token-refresh-failed", createdAt: { gte: dayAgo } },
      }),
      db.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      redis.ping().then(() => true).catch(() => false),
    ]);

    return {
      activeFleets,
      connectedMembers,
      partyKitRooms: fleetsWithMembers,
      esiErrorBudget,
      tokenRefreshFailures24h,
      dbStatus: dbOk ? "ok" : "down",
      redisStatus: redisOk ? "ok" : "down",
    };
  }

  async listFleets(options: { includeExpired?: boolean } = {}) {
    const where = options.includeExpired
      ? {}
      : { disbandedAt: null };

    const fleets = await db.fleet.findMany({
      where,
      include: {
        fc: { select: { characterId: true, characterName: true } },
        _count: { select: { sessions: true, queueEntries: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return fleets.map((f) => ({
      id: f.id,
      name: f.name,
      mode: f.mode,
      mediaSource: f.mediaSource,
      fcCharacterId: f.fcCharacterId,
      fcCharacterName: f.fc.characterName,
      sessionCount: f._count.sessions,
      queueEntryCount: f._count.queueEntries,
      createdAt: f.createdAt,
      disbandedAt: f.disbandedAt,
      expiresAt: f.expiresAt,
    }));
  }

  async getFleet(fleetId: string) {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      include: {
        fc: { select: { characterId: true, characterName: true } },
        sessions: {
          include: { character: { select: { characterId: true, characterName: true } } },
        },
        delegates: {
          include: { character: { select: { characterId: true, characterName: true } } },
        },
        _count: { select: { queueEntries: true } },
      },
    });

    if (!fleet) throw new NotFoundError("Fleet");
    return fleet;
  }

  async forceDisband(fleetId: string, operatorCharacterId: number) {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { id: true, disbandedAt: true },
    });

    if (!fleet) throw new NotFoundError("Fleet");

    await db.fleet.update({
      where: { id: fleetId },
      data: { disbandedAt: new Date() },
    });

    await this.audit("fleet.force_disbandoned", String(operatorCharacterId), { fleetId });
  }

  async grantOperator(targetCharacterId: number, operatorCharacterId: number) {
    const user = await db.user.findUnique({
      where: { characterId: targetCharacterId },
      select: { characterId: true },
    });
    if (!user) throw new NotFoundError("User");

    await db.user.update({
      where: { characterId: targetCharacterId },
      data: { isOperator: true },
    });

    await this.audit("operator.granted", String(operatorCharacterId), {
      targetCharacterId,
    });
  }

  async revokeOperator(targetCharacterId: number, operatorCharacterId: number) {
    const user = await db.user.findUnique({
      where: { characterId: targetCharacterId },
      select: { characterId: true },
    });
    if (!user) throw new NotFoundError("User");

    await db.user.update({
      where: { characterId: targetCharacterId },
      data: { isOperator: false },
    });

    await this.audit("operator.revoked", String(operatorCharacterId), {
      targetCharacterId,
    });
  }

  async getAuditLog(options: { limit?: number; event?: string } = {}) {
    const { limit = 50, event } = options;

    return db.auditLog.findMany({
      where: event ? { event } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async audit(event: string, actor: string, payload: object, ip?: string) {
    await db.auditLog.create({
      data: { event, actor, payload, ip },
    });
  }
}
