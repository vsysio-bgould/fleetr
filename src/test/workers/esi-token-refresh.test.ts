import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import workerDef from "@/workers/esi-token-refresh.worker";

vi.mock("@/lib/db", () => ({
  default: {
    esiToken: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeJob(data: object): Job {
  return { id: "test-job", data } as Job;
}

describe("esi-token-refresh worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ESI_CLIENT_ID", "test-client-id");
    vi.stubEnv("ESI_CLIENT_SECRET", "test-secret");
  });

  it("skips when no ESI token found", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.esiToken.findUnique).mockResolvedValueOnce(null);

    await workerDef.process(makeJob({ characterId: 100 }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips when token is not near expiry", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.esiToken.findUnique).mockResolvedValueOnce({
      accessTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min from now
      refreshToken: "refresh-token",
    } as never);

    await workerDef.process(makeJob({ characterId: 100 }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refreshes token when near expiry", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.esiToken.findUnique).mockResolvedValueOnce({
      accessTokenExpiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 min from now
      refreshToken: "my-refresh-token",
    } as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 1200,
      }),
    });

    await workerDef.process(makeJob({ characterId: 100 }));

    expect(mockFetch).toHaveBeenCalledWith(
      "https://login.eveonline.com/v2/oauth/token",
      expect.objectContaining({ method: "POST" })
    );
    expect(db.esiToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { characterId: 100 },
        data: expect.objectContaining({ accessToken: "new-access-token" }),
      })
    );
  });

  it("logs error but does not throw when ESI refresh fails", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.esiToken.findUnique).mockResolvedValueOnce({
      accessTokenExpiresAt: new Date(Date.now() + 60 * 1000),
      refreshToken: "token",
    } as never);

    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    await expect(workerDef.process(makeJob({ characterId: 100 }))).resolves.toBeUndefined();
    expect(db.esiToken.update).not.toHaveBeenCalled();
  });
});
