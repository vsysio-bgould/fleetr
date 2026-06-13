export interface ScopeGate {
  scope: string;
  key: string;
  label: string;
  consequence: string;
}

/**
 * Maps feature gates to the ESI scope they require.
 * Used by requireScope() middleware and ScopePrompt UI.
 */
export const SCOPE_GATES = {
  FLEET_MEMBERSHIP: {
    scope: "esi-fleets.read_fleet.v1",
    key: "FLEET_MEMBERSHIP",
    label: "Fleet Membership",
    consequence: "Required: verifies your EVE fleet, fleet ID, and command role",
  },
  LOCATION: {
    scope: "esi-location.read_location.v1",
    key: "LOCATION",
    label: "Location",
    consequence: "Optional: shows your current solar system in the member roster",
  },
  FLEET_MEMBERS: {
    scope: "esi-fleets.read_fleet.v1",
    key: "FLEET_MEMBERS",
    label: "Fleet Members",
    consequence: "Required: reads fleet membership for roster and access checks",
  },
  FLEET_WRITE: {
    scope: "esi-fleets.write_fleet.v1",
    key: "FLEET_WRITE",
    label: "Fleet Sync",
    consequence: "Optional for Boss/FC: lets Fleetr append the join link to the fleet MOTD",
  },
} as const satisfies Record<string, ScopeGate>;

export type ScopeGateKey = keyof typeof SCOPE_GATES;
