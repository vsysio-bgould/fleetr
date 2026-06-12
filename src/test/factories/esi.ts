import { vi } from "vitest";
import type { IEsiClient } from "@/infra/esi/types";

export function createMockEsiClient(): IEsiClient {
  return {
    exchangeCode: vi.fn().mockResolvedValue({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expiresIn: 1199,
      scopes: ["esi-fleets.read_fleet.v1"],
      characterId: 12345,
      characterName: "Test Pilot",
    }),
    getFleetMembership: vi.fn().mockResolvedValue({
      fleetId: "fleet-123",
      role: "fleet_commander",
    }),
    getCharacter: vi.fn().mockResolvedValue({
      name: "Test Pilot",
      corporationId: 98765,
    }),
    getLocation: vi.fn().mockResolvedValue({ solarSystemId: 30000142 }),
    getFleetMembers: vi.fn().mockResolvedValue([]),
  };
}
