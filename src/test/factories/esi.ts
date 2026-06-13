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
    refreshAccessToken: vi.fn().mockResolvedValue({
      accessToken: "mock-refreshed-access-token",
      refreshToken: "mock-refreshed-refresh-token",
      expiresIn: 1199,
      scopes: ["esi-fleets.read_fleet.v1"],
      characterId: 12345,
      characterName: "Test Pilot",
    }),
    getFleetMembership: vi.fn().mockResolvedValue({
      fleetId: "fleet-123",
      fleetBossId: 12345,
      role: "fleet_commander",
    }),
    getCharacter: vi.fn().mockResolvedValue({
      name: "Test Pilot",
      corporationId: 98765,
    }),
    getLocation: vi.fn().mockResolvedValue({ solarSystemId: 30000142 }),
    getFleetMembers: vi.fn().mockResolvedValue([]),
    getFleetInfo: vi.fn().mockResolvedValue({
      isFreeMove: false,
      isRegistered: false,
      isVoiceEnabled: true,
      motd: "Fleet MOTD",
    }),
    updateFleetSettings: vi.fn().mockResolvedValue(undefined),
  };
}
