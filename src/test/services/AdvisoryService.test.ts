import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdvisoryService } from "@/services/AdvisoryService";

vi.mock("@/lib/db", () => ({
  default: {
    advisoryDismissal: {
      findMany: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

describe("AdvisoryService", () => {
  let service: AdvisoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdvisoryService();
  });

  describe("list", () => {
    it("returns all advisories when none are dismissed", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.advisoryDismissal.findMany).mockResolvedValueOnce([]);

      const result = await service.list(100);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((a) => !a.permanent)).toBe(true);
    });

    it("excludes permanently dismissed advisories", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.advisoryDismissal.findMany).mockResolvedValueOnce([
        { key: "youtube-premium", permanent: true, lastShownAt: new Date() },
      ] as never);

      const result = await service.list(100);
      expect(result.find((a) => a.key === "youtube-premium")).toBeUndefined();
    });

    it("includes non-permanently-dismissed advisories", async () => {
      const db = (await import("@/lib/db")).default;
      vi.mocked(db.advisoryDismissal.findMany).mockResolvedValueOnce([
        { key: "youtube-premium", permanent: false, lastShownAt: new Date("2026-01-01") },
      ] as never);

      const result = await service.list(100);
      const advisory = result.find((a) => a.key === "youtube-premium");
      expect(advisory).toBeDefined();
      expect(advisory?.lastShownAt).toEqual(new Date("2026-01-01"));
    });
  });

  describe("dismiss", () => {
    it("upserts a dismissal record", async () => {
      const db = (await import("@/lib/db")).default;
      await service.dismiss(100, "youtube-premium", true);
      expect(db.advisoryDismissal.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { characterId_key: { characterId: 100, key: "youtube-premium" } },
          create: { characterId: 100, key: "youtube-premium", permanent: true },
        })
      );
    });
  });

  describe("undismiss", () => {
    it("deletes the dismissal record", async () => {
      const db = (await import("@/lib/db")).default;
      await service.undismiss(100, "soundcloud-quality");
      expect(db.advisoryDismissal.deleteMany).toHaveBeenCalledWith({
        where: { characterId: 100, key: "soundcloud-quality" },
      });
    });
  });
});
