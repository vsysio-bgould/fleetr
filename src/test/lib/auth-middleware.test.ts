import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { UnauthorizedError } from "@/lib/errors";

const FUTURE_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24);
const PAST_DATE = new Date(Date.now() - 1000);

vi.mock("@/lib/db", () => ({
  default: {
    apiToken: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRequest(token?: string, cookieToken?: string): NextRequest {
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (cookieToken) headers.set("Cookie", `fleetr_token=${cookieToken}`);
    return new NextRequest("http://localhost/api/test", { headers });
  }

  it("returns auth context for a valid Bearer token", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.apiToken.findUnique).mockResolvedValueOnce({
      id: "token-123",
      characterId: 12345,
      expiresAt: FUTURE_DATE,
    } as never);

    const req = makeRequest("token-123");
    const ctx = await requireAuth(req);

    expect(ctx.characterId).toBe(12345);
    expect(ctx.apiTokenId).toBe("token-123");
    expect(db.apiToken.findUnique).toHaveBeenCalledWith({
      where: { id: "token-123" },
      select: { id: true, characterId: true, expiresAt: true },
    });
  });

  it("falls back to cookie when no Authorization header", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.apiToken.findUnique).mockResolvedValueOnce({
      id: "cookie-token",
      characterId: 99999,
      expiresAt: FUTURE_DATE,
    } as never);

    const req = makeRequest(undefined, "cookie-token");
    const ctx = await requireAuth(req);

    expect(ctx.characterId).toBe(99999);
  });

  it("throws UnauthorizedError when no token provided", async () => {
    const req = makeRequest();
    await expect(requireAuth(req)).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when token does not exist in DB", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.apiToken.findUnique).mockResolvedValueOnce(null);

    const req = makeRequest("nonexistent-token");
    await expect(requireAuth(req)).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when token is expired", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.apiToken.findUnique).mockResolvedValueOnce({
      id: "expired-token",
      characterId: 12345,
      expiresAt: PAST_DATE,
    } as never);

    const req = makeRequest("expired-token");
    await expect(requireAuth(req)).rejects.toThrow(UnauthorizedError);
  });
});
