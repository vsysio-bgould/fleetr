import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    $queryRaw: vi.fn().mockResolvedValue([{ "1": 1 }]),
  },
}));

vi.mock("@/lib/redis", () => ({
  default: {
    ping: vi.fn().mockResolvedValue("PONG"),
  },
}));

describe("GET /api/v1/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function loadRoute() {
    return import("@/app/api/v1/health/route");
  }

  it("returns 200 ok when both DB and Redis are healthy", async () => {
    const { GET } = await loadRoute();
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.db).toBe("ok");
    expect(body.checks.redis).toBe("ok");
  });

  it("returns 503 degraded when DB is down", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.$queryRaw).mockRejectedValueOnce(new Error("connection refused"));

    const { GET } = await loadRoute();
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.db).toBe("error");
    expect(body.checks.redis).toBe("ok");
  });

  it("returns 503 degraded when Redis is down", async () => {
    const redis = (await import("@/lib/redis")).default;
    vi.mocked(redis.ping).mockRejectedValueOnce(new Error("connection refused"));

    const { GET } = await loadRoute();
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.db).toBe("ok");
    expect(body.checks.redis).toBe("error");
  });
});
