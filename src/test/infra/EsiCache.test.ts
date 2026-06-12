import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

describe("EsiCache", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getEtag", () => {
    it("returns null when no cache entry exists", async () => {
      const redis = (await import("@/lib/redis")).default;
      vi.mocked(redis.get).mockResolvedValueOnce(null);

      const { EsiCache } = await import("@/infra/esi/EsiCache");
      const cache = new EsiCache();
      expect(await cache.getEtag("GET:/characters/100/")).toBeNull();
    });

    it("returns etag from stored entry", async () => {
      const redis = (await import("@/lib/redis")).default;
      const entry = { etag: '"abc123"', data: { name: "Test" }, cachedAt: Date.now() };
      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(entry));

      const { EsiCache } = await import("@/infra/esi/EsiCache");
      const cache = new EsiCache();
      expect(await cache.getEtag("GET:/characters/100/")).toBe('"abc123"');
    });
  });

  describe("getCachedData", () => {
    it("returns null on cache miss", async () => {
      const redis = (await import("@/lib/redis")).default;
      vi.mocked(redis.get).mockResolvedValueOnce(null);

      const { EsiCache } = await import("@/infra/esi/EsiCache");
      const cache = new EsiCache();
      expect(await cache.getCachedData("GET:/characters/100/")).toBeNull();
    });

    it("returns data from stored entry", async () => {
      const redis = (await import("@/lib/redis")).default;
      const payload = { name: "Test Char", corporation_id: 999 };
      const entry = { etag: '"abc"', data: payload, cachedAt: Date.now() };
      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(entry));

      const { EsiCache } = await import("@/infra/esi/EsiCache");
      const cache = new EsiCache();
      expect(await cache.getCachedData("GET:/characters/100/")).toEqual(payload);
    });
  });

  describe("store", () => {
    it("sets the entry with the given TTL", async () => {
      const redis = (await import("@/lib/redis")).default;

      const { EsiCache } = await import("@/infra/esi/EsiCache");
      const cache = new EsiCache();
      await cache.store("GET:/characters/100/", '"etag-xyz"', { name: "X" }, 120);

      expect(redis.set).toHaveBeenCalledWith(
        "esi:cache:GET:/characters/100/",
        expect.stringContaining("etag-xyz"),
        "EX",
        120
      );
    });
  });

  describe("invalidate", () => {
    it("deletes the cache key", async () => {
      const redis = (await import("@/lib/redis")).default;

      const { EsiCache } = await import("@/infra/esi/EsiCache");
      const cache = new EsiCache();
      await cache.invalidate("GET:/characters/100/");

      expect(redis.del).toHaveBeenCalledWith("esi:cache:GET:/characters/100/");
    });
  });
});
