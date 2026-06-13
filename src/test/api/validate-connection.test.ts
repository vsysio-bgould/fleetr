import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const VALID_SECRET = "test-secret-32-chars-long-enough!";

vi.mock("@/lib/db", () => ({
  default: {
    apiToken: { findUnique: vi.fn() },
    session: { findUnique: vi.fn(), findFirst: vi.fn() },
    fleet: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

describe("POST /api/v1/internal/fleets/:id/validate-connection", () => {
  let POST: (req: NextRequest, ctx: { params: { fleetId: string } }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("PARTYKIT_SECRET", VALID_SECRET);
    vi.resetModules();
    const mod = await import("@/app/api/v1/internal/fleets/[fleetId]/validate-connection/route");
    POST = mod.POST;
  });

  function makeRequest(body: object, secret?: string): NextRequest {
    return new NextRequest(
      "http://localhost/api/v1/internal/fleets/fleet-uuid/validate-connection",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "X-PartyKit-Secret": secret } : {}),
        },
        body: JSON.stringify(body),
      }
    );
  }

  it("returns 401 when secret is missing", async () => {
    const res = await POST(makeRequest({ token: "abc" }), { params: { fleetId: "fleet-uuid" } });
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is wrong", async () => {
    const res = await POST(
      makeRequest({ token: "abc" }, "wrong-secret"),
      { params: { fleetId: "fleet-uuid" } }
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.apiToken.findUnique).mockResolvedValueOnce(null);

    const res = await POST(
      makeRequest({ token: "invalid-token" }, VALID_SECRET),
      { params: { fleetId: "fleet-uuid" } }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when character has no active session", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.apiToken.findUnique).mockResolvedValueOnce({
      characterId: 12345,
      expiresAt: new Date(Date.now() + 1000 * 60),
    } as never);
    vi.mocked(db.session.findUnique).mockResolvedValueOnce(null);
    vi.mocked(db.session.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
      battleVolumePercent: 25,
      downvoteDeletePercent: 50,
      disbandedAt: null,
      expiresAt: null,
    } as never);

    const res = await POST(
      makeRequest({ token: "valid-token" }, VALID_SECRET),
      { params: { fleetId: "fleet-uuid" } }
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with connection state for a valid request", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.apiToken.findUnique).mockResolvedValueOnce({
      characterId: 12345,
      expiresAt: new Date(Date.now() + 1000 * 60),
    } as never);
    vi.mocked(db.session.findUnique).mockResolvedValueOnce({
      role: "FLEET_COMMANDER",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    } as never);
    vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
      battleVolumePercent: 25,
      downvoteDeletePercent: 50,
      disbandedAt: null,
      expiresAt: null,
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      characterName: "Test Pilot",
      isOperator: false,
    } as never);

    const res = await POST(
      makeRequest({ token: "valid-token" }, VALID_SECRET),
      { params: { fleetId: "fleet-uuid" } }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.characterId).toBe(12345);
    expect(body.characterName).toBe("Test Pilot");
    expect(body.role).toBe("FLEET_COMMANDER");
    expect(body.isOperator).toBe(false);
    expect(body.fleetId).toBe("fleet-uuid");
  });

  it("returns 200 for an operator without a fleet session", async () => {
    const db = (await import("@/lib/db")).default;
    vi.mocked(db.apiToken.findUnique).mockResolvedValueOnce({
      characterId: 12345,
      expiresAt: new Date(Date.now() + 1000 * 60),
    } as never);
    vi.mocked(db.session.findUnique).mockResolvedValueOnce(null);
    vi.mocked(db.session.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.fleet.findUnique).mockResolvedValueOnce({
      battleVolumePercent: 25,
      downvoteDeletePercent: 50,
      disbandedAt: null,
      expiresAt: null,
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      characterName: "Operator Pilot",
      isOperator: true,
    } as never);

    const res = await POST(
      makeRequest({ token: "valid-token" }, VALID_SECRET),
      { params: { fleetId: "fleet-uuid" } }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.characterName).toBe("Operator Pilot");
    expect(body.role).toBe("FLEET_BOSS");
    expect(body.isOperator).toBe(true);
  });
});
