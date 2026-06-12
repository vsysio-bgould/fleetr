import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "@/services/AuthService";
import { createMockEsiClient } from "@/test/factories/esi";
import { UnauthorizedError } from "@/lib/errors";
import type { EsiTokenStore } from "@/infra/esi/EsiTokenStore";

vi.mock("@/lib/db", () => ({
  default: {
    user: {
      upsert: vi.fn().mockResolvedValue({ characterId: 12345, characterName: "Test Pilot" }),
    },
    esiToken: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    userScopePreference: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    apiToken: {
      create: vi.fn().mockResolvedValue({ id: "test-api-token-uuid" }),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  default: {
    setex: vi.fn().mockResolvedValue("OK"),
    get: vi.fn(),
    del: vi.fn().mockResolvedValue(1),
  },
}));

describe("AuthService", () => {
  let service: AuthService;
  let mockEsi: ReturnType<typeof createMockEsiClient>;
  let mockTokenStore: EsiTokenStore;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ESI_CLIENT_ID", "test-client-id");
    vi.stubEnv("ESI_CALLBACK_URL", "http://localhost:3000/api/v1/auth/callback");
    mockEsi = createMockEsiClient();
    mockTokenStore = { upsert: vi.fn().mockResolvedValue(undefined) } as unknown as EsiTokenStore;
    service = new AuthService(mockEsi, mockTokenStore);
  });

  describe("beginFlow", () => {
    it("stores OAuth state in Redis and returns ESI redirect URL", async () => {
      const redis = (await import("@/lib/redis")).default;
      const result = await service.beginFlow(
        ["esi-fleets.read_fleet.v1"],
        "/fleet/create"
      );

      expect(redis.setex).toHaveBeenCalledOnce();
      const [key, ttl, value] = vi.mocked(redis.setex).mock.calls[0];
      expect(key).toMatch(/^oauth:state:/);
      expect(ttl).toBe(300);
      const stateData = JSON.parse(value as string);
      expect(stateData.returnUrl).toBe("/fleet/create");
      expect(stateData.scopes).toEqual(["esi-fleets.read_fleet.v1"]);

      expect(result.redirectUrl).toContain("https://login.eveonline.com");
      expect(result.redirectUrl).toContain("esi-fleets.read_fleet.v1");
    });
  });

  describe("handleCallback", () => {
    it("exchanges code, upserts user, stores token, issues API token", async () => {
      const redis = (await import("@/lib/redis")).default;
      const db = (await import("@/lib/db")).default;

      vi.mocked(redis.get).mockResolvedValueOnce(
        JSON.stringify({
          returnUrl: "/",
          scopes: ["esi-fleets.read_fleet.v1"],
          nonce: "abc",
        })
      );

      const result = await service.handleCallback("auth-code", "state-key");

      expect(mockEsi.exchangeCode).toHaveBeenCalledWith("auth-code");
      expect(db.user.upsert).toHaveBeenCalledOnce();
      expect(db.apiToken.create).toHaveBeenCalledOnce();
      expect(result.apiToken).toBe("test-api-token-uuid");
      expect(result.characterId).toBe(12345);
    });

    it("throws UnauthorizedError when state key is expired or invalid", async () => {
      const redis = (await import("@/lib/redis")).default;
      vi.mocked(redis.get).mockResolvedValueOnce(null);

      await expect(
        service.handleCallback("auth-code", "bad-state")
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});
