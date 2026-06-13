import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetOrRefresh = vi.fn();
const mockGetFleetMembership = vi.fn();

vi.mock("@/lib/db", () => ({
  default: {
    apiToken: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    fleet: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/infra/esi/EsiTokenStore", () => ({
  EsiTokenStore: vi.fn().mockImplementation(() => ({
    getOrRefresh: mockGetOrRefresh,
  })),
}));

vi.mock("@/infra/esi/EsiClient", () => ({
  EsiClient: vi.fn().mockImplementation(() => ({
    getFleetMembership: mockGetFleetMembership,
  })),
}));

describe("GET /api/v1/users/me/current-fleet", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import("@/app/api/v1/users/me/current-fleet/route");
    GET = mod.GET;
  });

  function makeRequest(): NextRequest {
    return new NextRequest("http://localhost/api/v1/users/me/current-fleet", {
      headers: { Authorization: "Bearer token-uuid" },
    });
  }

  it("returns the matching active Fleetr fleet for the user's current EVE fleet", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.apiToken.findUnique).mockResolvedValueOnce({
      id: "token-uuid",
      characterId: 12345,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    mockGetOrRefresh.mockResolvedValueOnce({
      accessToken: "esi-token",
      refreshToken: "refresh",
      accessTokenExpiresAt: new Date(Date.now() + 60_000),
      scopes: ["esi-fleets.read_fleet.v1"],
    });
    mockGetFleetMembership.mockResolvedValueOnce({
      fleetId: "eve-fleet-123",
      fleetBossId: 12345,
      role: "fleet_commander",
    });
    vi.mocked(db.fleet.findFirst).mockResolvedValueOnce({
      id: "fleetr-fleet-uuid",
    } as never);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      esiFleetId: "eve-fleet-123",
      fleetrFleetId: "fleetr-fleet-uuid",
    });
  });

  it("returns nulls when the token lacks fleet read scope", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.apiToken.findUnique).mockResolvedValueOnce({
      id: "token-uuid",
      characterId: 12345,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    mockGetOrRefresh.mockResolvedValueOnce({
      accessToken: "esi-token",
      refreshToken: "refresh",
      accessTokenExpiresAt: new Date(Date.now() + 60_000),
      scopes: [],
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ esiFleetId: null, fleetrFleetId: null });
    expect(mockGetFleetMembership).not.toHaveBeenCalled();
  });
});
