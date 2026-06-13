import { describe, it, expect, vi, beforeEach } from "vitest";
import { FleetService } from "@/services/FleetService";
import { createMockEsiClient } from "@/test/factories/esi";
import { SessionRole } from "@prisma/client";
import {
  ForbiddenError,
  NotFoundError,
  NotInFleetError,
  FleetExpiredError,
} from "@/lib/errors";

vi.mock("@/lib/db", () => ({
  default: {
    fleet: {
      create: vi.fn().mockResolvedValue({
        id: "fleet-uuid",
        esiFleetId: "fleet-123",
        name: "Test Pilot",
        joinToken: "abc123",
        mode: "CRUISE",
        mediaSource: "YOUTUBE",
        fcCharacterId: 12345,
        expiresAt: null,
        disbandedAt: null,
        createdAt: new Date(),
      }),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    playback: {
      create: vi.fn().mockResolvedValue({}),
    },
    session: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("FleetService", () => {
  let service: FleetService;
  let mockEsi: ReturnType<typeof createMockEsiClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEsi = createMockEsiClient();
    service = new FleetService(mockEsi);
  });

  describe("create", () => {
    it("creates a fleet for a fleet_commander role", async () => {
      const fleet = await service.create(12345, "access-token");

      expect(mockEsi.getFleetMembership).toHaveBeenCalledWith(12345, "access-token");
      expect(mockEsi.getCharacter).toHaveBeenCalledWith(12345);

      const db = (await import("@/lib/db")).default;
      expect(db.fleet.create).toHaveBeenCalledOnce();
      expect(db.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: SessionRole.FLEET_BOSS }),
        })
      );
      expect(fleet.fleetId).toBe("fleet-uuid");
    });

    it("creates a fleet for the top hierarchy commander when the boss is different", async () => {
      vi.mocked(mockEsi.getFleetMembership).mockResolvedValueOnce({
        fleetId: "fleet-123",
        fleetBossId: 99999,
        role: "fleet_commander",
      });
      vi.mocked(mockEsi.getCharacter).mockResolvedValueOnce({
        name: "Fleet Boss",
        corporationId: 98765,
      });

      await service.create(12345, "access-token");

      const db = (await import("@/lib/db")).default;
      expect(db.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { characterId: 99999 },
          create: expect.objectContaining({ characterName: "Fleet Boss" }),
        })
      );
      expect(db.fleet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fcCharacterId: 99999,
            name: "Fleet Boss",
          }),
        })
      );
      expect(db.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            characterId: 12345,
            role: SessionRole.FLEET_COMMANDER,
          }),
        })
      );
    });

    it("creates a fleet for the fleet boss even when hierarchy role is not commander", async () => {
      vi.mocked(mockEsi.getFleetMembership).mockResolvedValueOnce({
        fleetId: "fleet-123",
        fleetBossId: 12345,
        role: "squad_member",
      });

      await service.create(12345, "access-token");

      const db = (await import("@/lib/db")).default;
      expect(db.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: SessionRole.FLEET_BOSS }),
        })
      );
    });

    it("throws NotInFleetError when character is not in a fleet", async () => {
      vi.mocked(mockEsi.getFleetMembership).mockResolvedValueOnce(null);

      await expect(service.create(12345, "access-token")).rejects.toThrow(
        NotInFleetError
      );
    });

    it("throws ForbiddenError when character has squad_member role", async () => {
      vi.mocked(mockEsi.getFleetMembership).mockResolvedValueOnce({
        fleetId: "fleet-123",
        fleetBossId: 99999,
        role: "squad_member",
      });

      await expect(service.create(12345, "access-token")).rejects.toThrow(
        ForbiddenError
      );
    });

    it("throws ForbiddenError for wing_commander and squad_commander roles", async () => {
      for (const role of ["wing_commander", "squad_commander"] as const) {
        vi.mocked(mockEsi.getFleetMembership).mockResolvedValueOnce({
          fleetId: "fleet-123",
          fleetBossId: 99999,
          role,
        });
        await expect(service.create(12345, "access-token")).rejects.toThrow(
          ForbiddenError
        );
      }
    });
  });

  describe("disband", () => {
    it("disbands a fleet when called by the FC", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
        fcCharacterId: 12345,
        disbandedAt: null,
      } as never);

      await service.disband("fleet-uuid", 12345, SessionRole.FLEET_BOSS);
      expect(db.fleet.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "fleet-uuid" } })
      );
    });

    it("throws ForbiddenError when non-FC tries to disband", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
        fcCharacterId: 12345,
        disbandedAt: null,
      } as never);

      await expect(
        service.disband("fleet-uuid", 99999, SessionRole.LINE_MEMBER)
      ).rejects.toThrow(
        ForbiddenError
      );
    });

    it("throws NotFoundError when fleet does not exist", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce(null);

      await expect(
        service.disband("nonexistent", 12345, SessionRole.FLEET_BOSS)
      ).rejects.toThrow(
        NotFoundError
      );
    });

    it("throws FleetExpiredError when fleet is already disbanded", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
        fcCharacterId: 12345,
        disbandedAt: new Date(),
      } as never);

      await expect(
        service.disband("fleet-uuid", 12345, SessionRole.FLEET_BOSS)
      ).rejects.toThrow(
        FleetExpiredError
      );
    });
  });
});
