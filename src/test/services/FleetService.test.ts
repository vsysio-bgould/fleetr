import { describe, it, expect, vi, beforeEach } from "vitest";
import { FleetService } from "@/services/FleetService";
import { createMockEsiClient } from "@/test/factories/esi";
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
      expect(fleet.id).toBe("fleet-uuid");
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
        role: "squad_member",
      });

      await expect(service.create(12345, "access-token")).rejects.toThrow(
        ForbiddenError
      );
    });

    it("allows wing_commander and squad_commander roles", async () => {
      for (const role of ["wing_commander", "squad_commander"] as const) {
        vi.mocked(mockEsi.getFleetMembership).mockResolvedValueOnce({
          fleetId: "fleet-123",
          role,
        });
        await expect(service.create(12345, "access-token")).resolves.toBeDefined();
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

      await service.disband("fleet-uuid", 12345);
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

      await expect(service.disband("fleet-uuid", 99999)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("throws NotFoundError when fleet does not exist", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce(null);

      await expect(service.disband("nonexistent", 12345)).rejects.toThrow(
        NotFoundError
      );
    });

    it("throws FleetExpiredError when fleet is already disbanded", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
        fcCharacterId: 12345,
        disbandedAt: new Date(),
      } as never);

      await expect(service.disband("fleet-uuid", 12345)).rejects.toThrow(
        FleetExpiredError
      );
    });
  });
});
