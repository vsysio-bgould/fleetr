import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserService } from "@/services/UserService";
import { NotFoundError } from "@/lib/errors";

vi.mock("@/lib/db", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    userScopePreference: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("UserService", () => {
  let service: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserService();
  });

  describe("getMe", () => {
    it("returns user profile with active sessions and scopes", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        characterId: 12345,
        characterName: "Test Pilot",
        isOperator: false,
        sessions: [{ fleetId: "fleet-abc", role: "LINE_MEMBER" }],
        esiToken: { scopes: ["esi-fleets.read_fleet.v1"] },
      } as never);

      const profile = await service.getMe(12345);

      expect(profile.characterId).toBe(12345);
      expect(profile.characterName).toBe("Test Pilot");
      expect(profile.activeSessions).toEqual([
        { fleetId: "fleet-abc", role: "LINE_MEMBER" },
      ]);
      expect(profile.grantedScopes).toEqual(["esi-fleets.read_fleet.v1"]);
    });

    it("throws NotFoundError when user does not exist", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);

      await expect(service.getMe(99999)).rejects.toThrow(NotFoundError);
    });

    it("returns empty scopes when user has no ESI token", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        characterId: 12345,
        characterName: "No Scopes Pilot",
        isOperator: false,
        sessions: [],
        esiToken: null,
      } as never);

      const profile = await service.getMe(12345);
      expect(profile.grantedScopes).toEqual([]);
    });
  });

  describe("updateScopePreference", () => {
    it("upserts scope preference for the character", async () => {
      const db = (await import("@/lib/db")).default;
      await service.updateScopePreference(12345, [
        "esi-fleets.read_fleet.v1",
        "esi-location.read_location.v1",
      ]);

      expect(db.userScopePreference.upsert).toHaveBeenCalledOnce();
    });
  });
});
