import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemberService } from "@/services/MemberService";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { SessionRole } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  default: {
    session: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/broadcast", () => ({ broadcastToFleet: vi.fn().mockResolvedValue(undefined) }));

describe("MemberService", () => {
  let service: MemberService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MemberService();
  });

  describe("list", () => {
    it("returns all sessions with character info", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.session.findMany).mockResolvedValueOnce([
        {
          characterId: 111,
          role: SessionRole.FLEET_COMMANDER,
          createdAt: new Date("2026-01-01"),
          character: { characterId: 111, characterName: "FC Character" },
        },
        {
          characterId: 222,
          role: SessionRole.LINE_MEMBER,
          createdAt: new Date("2026-01-02"),
          character: { characterId: 222, characterName: "Line Guy" },
        },
      ] as never);

      const result = await service.list("fleet-uuid");
      expect(result).toHaveLength(2);
      expect(result[0].characterName).toBe("FC Character");
      expect(result[1].role).toBe(SessionRole.LINE_MEMBER);
    });
  });

  describe("kick", () => {
    it("throws ForbiddenError when kicking yourself", async () => {
      await expect(service.kick("fleet-uuid", 100, 100)).rejects.toThrow(ForbiddenError);
    });

    it("throws NotFoundError when target is not in fleet", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.session.findUnique).mockResolvedValueOnce(null);
      await expect(service.kick("fleet-uuid", 100, 200)).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when trying to kick the FC", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.session.findUnique).mockResolvedValueOnce({
        role: SessionRole.FLEET_COMMANDER,
      } as never);
      await expect(service.kick("fleet-uuid", 100, 200)).rejects.toThrow(ForbiddenError);
    });

    it("deletes session when kicking a line member", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.session.findUnique).mockResolvedValueOnce({
        role: SessionRole.LINE_MEMBER,
        character: { characterName: "Target Guy" },
      } as never);

      await service.kick("fleet-uuid", 100, 200);
      expect(db.session.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fleetId_characterId: { fleetId: "fleet-uuid", characterId: 200 } },
        })
      );
    });

    it("allows kicking an FC_DELEGATE", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.session.findUnique).mockResolvedValueOnce({
        role: SessionRole.FC_DELEGATE,
        character: { characterName: "Delegate Guy" },
      } as never);

      await service.kick("fleet-uuid", 100, 200);
      expect(db.session.delete).toHaveBeenCalledOnce();
    });
  });
});
