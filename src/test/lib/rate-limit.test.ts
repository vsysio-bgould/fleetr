import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitError } from "@/lib/errors";
import { NextRequest } from "next/server";

vi.mock("@/lib/redis", () => ({
  default: {
    incr: vi.fn(),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(30),
  },
}));

function makeRequest(ip = "1.2.3.4"): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("rateLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes when count is within limit", async () => {
    const redis = (await import("@/lib/redis")).default;
    vi.mocked(redis.incr).mockResolvedValueOnce(1);

    const { rateLimit } = await import("@/lib/rate-limit");
    await expect(
      rateLimit(makeRequest(), null, { limit: 10, windowSeconds: 60, namespace: "test" })
    ).resolves.toBeUndefined();

    expect(redis.expire).toHaveBeenCalledOnce();
  });

  it("does not reset expiry on subsequent requests in the same window", async () => {
    const redis = (await import("@/lib/redis")).default;
    vi.mocked(redis.incr).mockResolvedValueOnce(5); // already 5 in window

    const { rateLimit } = await import("@/lib/rate-limit");
    await rateLimit(makeRequest(), null, { limit: 10, windowSeconds: 60, namespace: "test" });

    expect(redis.expire).not.toHaveBeenCalled();
  });

  it("throws RateLimitError when limit is exceeded", async () => {
    const redis = (await import("@/lib/redis")).default;
    vi.mocked(redis.incr).mockResolvedValueOnce(11); // over limit of 10

    const { rateLimit } = await import("@/lib/rate-limit");
    await expect(
      rateLimit(makeRequest(), null, { limit: 10, windowSeconds: 60, namespace: "test" })
    ).rejects.toThrow(RateLimitError);
  });

  it("uses characterId in the key when authenticated", async () => {
    const redis = (await import("@/lib/redis")).default;
    vi.mocked(redis.incr).mockResolvedValueOnce(1);

    const { rateLimit } = await import("@/lib/rate-limit");
    await rateLimit(makeRequest(), 12345, { limit: 5, windowSeconds: 60, namespace: "test" });

    expect(redis.incr).toHaveBeenCalledWith(
      expect.stringContaining("char:12345")
    );
  });
});
