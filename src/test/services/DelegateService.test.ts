import { describe, it, expect, vi, beforeEach } from "vitest";
import { DelegateService } from "@/services/DelegateService";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { SessionRole } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  default: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    fleetDelegate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("DelegateService", () => {
  let service: DelegateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DelegateService();
  });

  describe("list", () => {
    it("returns formatted delegate list", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleetDelegate.findMany).mockResolvedValueOnce([
        {
          characterId: 222,
          grantedBy: 100,
          grantedAt: new Date("2026-01-01"),
          character: { characterId: 222, characterName: "Delegate One" },
          grantor: { characterId: 100, characterName: "FC Guy" },
        },
      ] as never);

      const result = await service.list("fleet-uuid");
      expect(result).toHaveLength(1);
      expect(result[0].characterName).toBe("Delegate One");
      expect(result[0].grantedByName).toBe("FC Guy");
    });
  });

  describe("grant", () => {
    it("throws ForbiddenError when delegating to yourself", async () => {
      await expect(service.grant("fleet-uuid", 100, 100)).rejects.toThrow(ForbiddenError);
    });

    it("throws NotFoundError when target is not in fleet", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.session.findUnique).mockResolvedValueOnce(null);
      await expect(service.grant("fleet-uuid", 100, 200)).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when target is already the FC", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.session.findUnique).mockResolvedValueOnce({
        role: SessionRole.FLEET_COMMANDER,
      } as never);
      await expect(service.grant("fleet-uuid", 100, 200)).rejects.toThrow(ForbiddenError);
    });

    it("upserts delegate and elevates session role", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.session.findUnique).mockResolvedValueOnce({
        role: SessionRole.LINE_MEMBER,
      } as never);

      await service.grant("fleet-uuid", 100, 200);

      expect(db.fleetDelegate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fleetId_characterId: { fleetId: "fleet-uuid", characterId: 200 } },
          create: { fleetId: "fleet-uuid", characterId: 200, grantedBy: 100 },
        })
      );
      expect(db.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fleetId_characterId: { fleetId: "fleet-uuid", characterId: 200 } },
          data: { role: SessionRole.FC_DELEGATE },
        })
      );
    });
  });

  describe("revoke", () => {
    it("throws NotFoundError when delegate does not exist", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleetDelegate.findUnique).mockResolvedValueOnce(null);
      await expect(service.revoke("fleet-uuid", 200)).rejects.toThrow(NotFoundError);
    });

    it("deletes delegate record and downgrades session role", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleetDelegate.findUnique).mockResolvedValueOnce({
        id: "delegate-uuid",
        fleetId: "fleet-uuid",
        characterId: 200,
      } as never);

      await service.revoke("fleet-uuid", 200);

      expect(db.fleetDelegate.delete).toHaveBeenCalledOnce();
      expect(db.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            fleetId: "fleet-uuid",
            characterId: 200,
            role: SessionRole.FC_DELEGATE,
          },
          data: { role: SessionRole.LINE_MEMBER },
        })
      );
    });
  });
});
