import { describe, it, expect, vi, beforeEach } from "vitest";
import { EsiUnavailableError } from "@/lib/errors";

vi.mock("@/lib/redis", () => ({
  default: {
    pipeline: vi.fn(),
    get: vi.fn(),
    ttl: vi.fn(),
  },
}));

describe("EsiErrorBudget", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("check", () => {
    it("passes when not throttled", async () => {
      const redis = (await import("@/lib/redis")).default;
      // First get: THROTTLE_KEY (null = not throttled)
      // Second get: BUDGET_KEY (null = no budget recorded yet → skip tier check)
      vi.mocked(redis.get).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const { EsiErrorBudget } = await import("@/infra/esi/EsiErrorBudget");
      const budget = new EsiErrorBudget();
      await expect(budget.check()).resolves.toBeUndefined();
    });

    it("throws EsiUnavailableError when throttled", async () => {
      const redis = (await import("@/lib/redis")).default;
      vi.mocked(redis.get).mockResolvedValueOnce("1");
      vi.mocked(redis.ttl).mockResolvedValueOnce(42);

      const { EsiErrorBudget } = await import("@/infra/esi/EsiErrorBudget");
      const budget = new EsiErrorBudget();
      await expect(budget.check()).rejects.toThrow(EsiUnavailableError);
    });
  });

  describe("record", () => {
    it("engages throttle when budget is below threshold", async () => {
      const redis = (await import("@/lib/redis")).default;
      const mockExec = vi.fn().mockResolvedValue([]);
      const mockSet = vi.fn().mockReturnThis();
      const mockDel = vi.fn().mockReturnThis();
      vi.mocked(redis.pipeline).mockReturnValue({
        set: mockSet,
        del: mockDel,
        exec: mockExec,
      } as never);

      const { EsiErrorBudget } = await import("@/infra/esi/EsiErrorBudget");
      const budget = new EsiErrorBudget();

      // remain=5 is below PROACTIVE_THRESHOLD=10
      await budget.record(5, 30);

      // Should have called set twice (budget + throttle key), not del
      expect(mockSet).toHaveBeenCalledTimes(2);
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("clears throttle when budget has recovered", async () => {
      const redis = (await import("@/lib/redis")).default;
      const mockExec = vi.fn().mockResolvedValue([]);
      const mockSet = vi.fn().mockReturnThis();
      const mockDel = vi.fn().mockReturnThis();
      vi.mocked(redis.pipeline).mockReturnValue({
        set: mockSet,
        del: mockDel,
        exec: mockExec,
      } as never);

      const { EsiErrorBudget } = await import("@/infra/esi/EsiErrorBudget");
      const budget = new EsiErrorBudget();

      // remain=50 is above threshold
      await budget.record(50, 30);

      expect(mockSet).toHaveBeenCalledOnce(); // only budget key
      expect(mockDel).toHaveBeenCalledOnce(); // clear throttle
    });
  });

  describe("remaining", () => {
    it("returns null when no budget recorded", async () => {
      const redis = (await import("@/lib/redis")).default;
      vi.mocked(redis.get).mockResolvedValueOnce(null);

      const { EsiErrorBudget } = await import("@/infra/esi/EsiErrorBudget");
      const budget = new EsiErrorBudget();
      expect(await budget.remaining()).toBeNull();
    });

    it("returns parsed integer when budget is recorded", async () => {
      const redis = (await import("@/lib/redis")).default;
      vi.mocked(redis.get).mockResolvedValueOnce("75");

      const { EsiErrorBudget } = await import("@/infra/esi/EsiErrorBudget");
      const budget = new EsiErrorBudget();
      expect(await budget.remaining()).toBe(75);
    });
  });
});
