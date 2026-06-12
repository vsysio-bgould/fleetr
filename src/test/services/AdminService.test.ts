import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminService } from "@/services/AdminService";
import { NotFoundError } from "@/lib/errors";

vi.mock("@/lib/redis", () => ({
  default: {
    get: vi.fn().mockResolvedValue("75"),
    ping: vi.fn().mockResolvedValue("PONG"),
  },
}));

vi.mock("@/lib/db", () => ({
  default: {
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    fleet: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(3),
    },
    session: {
      count: vi.fn().mockResolvedValue(12),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn(),
    },
  },
}));

describe("AdminService", () => {
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminService();
  });

  describe("listFleets", () => {
    it("returns active fleets by default", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleet.findMany).mockResolvedValueOnce([
        {
          id: "f1",
          name: "Test Fleet",
          mode: "CRUISE",
          mediaSource: "YOUTUBE",
          fcCharacterId: 100,
          fc: { characterId: 100, characterName: "FC Guy" },
          _count: { sessions: 5, queueEntries: 3 },
          createdAt: new Date(),
          disbandedAt: null,
          expiresAt: null,
        },
      ] as never);

      const result = await service.listFleets();
      expect(result).toHaveLength(1);
      expect(result[0].fcCharacterName).toBe("FC Guy");
      expect(db.fleet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { disbandedAt: null } })
      );
    });

    it("includes expired fleets when requested", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleet.findMany).mockResolvedValueOnce([]);

      await service.listFleets({ includeExpired: true });
      expect(db.fleet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });
  });

  describe("forceDisband", () => {
    it("throws NotFoundError when fleet does not exist", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce(null);

      await expect(service.forceDisband("fleet-uuid", 999)).rejects.toThrow(NotFoundError);
    });

    it("sets disbandedAt and writes audit log", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({ id: "fleet-uuid", disbandedAt: null } as never);

      await service.forceDisband("fleet-uuid", 999);

      expect(db.fleet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "fleet-uuid" },
          data: { disbandedAt: expect.any(Date) },
        })
      );
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: "fleet.force_disbandoned",
            actor: "999",
          }),
        })
      );
    });
  });

  describe("grantOperator / revokeOperator", () => {
    it("throws NotFoundError when user does not exist", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
      await expect(service.grantOperator(200, 999)).rejects.toThrow(NotFoundError);
    });

    it("sets isOperator to true and audits", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({ characterId: 200 } as never);

      await service.grantOperator(200, 999);

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isOperator: true } })
      );
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: "operator.granted" }),
        })
      );
    });

    it("sets isOperator to false and audits", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({ characterId: 200 } as never);

      await service.revokeOperator(200, 999);

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isOperator: false } })
      );
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: "operator.revoked" }),
        })
      );
    });
  });

  describe("getAuditLog", () => {
    it("returns log entries with default limit", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.auditLog.findMany).mockResolvedValueOnce([
        { id: "log-1", event: "fleet.force_disbandoned", actor: "999", payload: {}, createdAt: new Date() },
      ] as never);

      const result = await service.getAuditLog();
      expect(result).toHaveLength(1);
      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, orderBy: { createdAt: "desc" } })
      );
    });

    it("filters by event when provided", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.auditLog.findMany).mockResolvedValueOnce([]);

      await service.getAuditLog({ event: "operator.granted" });
      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { event: "operator.granted" } })
      );
    });
  });
});
