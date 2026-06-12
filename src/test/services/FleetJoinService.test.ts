import { describe, it, expect, vi, beforeEach } from "vitest";
import { FleetJoinService } from "@/services/FleetJoinService";
import { createMockEsiClient } from "@/test/factories/esi";
import {
  NotFoundError,
  FleetExpiredError,
  NotInFleetError,
} from "@/lib/errors";

const FUTURE_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24);

vi.mock("@/lib/db", () => ({
  default: {
    fleet: {
      findUnique: vi.fn(),
    },
    fleetDelegate: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    session: {
      upsert: vi.fn().mockResolvedValue({
        id: "session-uuid",
        role: "LINE_MEMBER",
        fleetId: "fleet-uuid",
        characterId: 12345,
      }),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("FleetJoinService", () => {
  let service: FleetJoinService;
  let mockEsi: ReturnType<typeof createMockEsiClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEsi = createMockEsiClient();
    // Default mock: character is in fleet-123
    vi.mocked(mockEsi.getFleetMembership).mockResolvedValue({
      fleetId: "fleet-123",
      role: "squad_member",
    });
    service = new FleetJoinService(mockEsi);
  });

  async function mockFleet(overrides: object = {}) {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
      id: "fleet-uuid",
      esiFleetId: "fleet-123",
      disbandedAt: null,
      expiresAt: null,
      ...overrides,
    } as never);
  }

  describe("join", () => {
    it("creates a session for a valid member", async () => {
      await mockFleet();
      const result = await service.join("join-token", 12345, "access-token");

      expect(result.fleetId).toBe("fleet-uuid");
      expect(result.role).toBe("LINE_MEMBER");
    });

    it("throws NotFoundError when join token is invalid", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleet.findUnique).mockResolvedValueOnce(null);

      await expect(service.join("bad-token", 12345, "access-token")).rejects.toThrow(
        NotFoundError
      );
    });

    it("throws FleetExpiredError when fleet is disbanded", async () => {
      await mockFleet({ disbandedAt: new Date() });

      await expect(service.join("join-token", 12345, "access-token")).rejects.toThrow(
        FleetExpiredError
      );
    });

    it("throws FleetExpiredError when fleet has expired", async () => {
      await mockFleet({ expiresAt: new Date(Date.now() - 1000) });

      await expect(service.join("join-token", 12345, "access-token")).rejects.toThrow(
        FleetExpiredError
      );
    });

    it("throws NotInFleetError when character is not in the EVE fleet", async () => {
      await mockFleet();
      vi.mocked(mockEsi.getFleetMembership).mockResolvedValueOnce(null);

      await expect(service.join("join-token", 12345, "access-token")).rejects.toThrow(
        NotInFleetError
      );
    });

    it("throws NotInFleetError when character is in a different EVE fleet", async () => {
      await mockFleet({ esiFleetId: "fleet-999" });

      await expect(service.join("join-token", 12345, "access-token")).rejects.toThrow(
        NotInFleetError
      );
    });

    it("grants FC_DELEGATE role when delegate row exists", async () => {
      await mockFleet();
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.fleetDelegate.findUnique).mockResolvedValueOnce({
        id: "delegate-uuid",
      } as never);

      const result = await service.join("join-token", 12345, "access-token");
      expect(result.role).toBe("FC_DELEGATE");
    });
  });

  describe("leave", () => {
    it("deletes the session", async () => {
      const db = (await import("@/lib/db")).default;
      await service.leave("fleet-uuid", 12345);
      expect(db.session.delete).toHaveBeenCalledOnce();
    });
  });
});
