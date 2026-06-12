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
    consequence: "Required to verify you are in an EVE fleet",
  },
  LOCATION: {
    scope: "esi-location.read_location.v1",
    key: "LOCATION",
    label: "Location",
    consequence: "Required to show solar system in the member roster",
  },
  FLEET_MEMBERS: {
    scope: "esi-fleets.read_fleet.v1",
    key: "FLEET_MEMBERS",
    label: "Fleet Members",
    consequence: "Required for fleet member roster and kick functionality",
  },
  FLEET_WRITE: {
    scope: "esi-fleets.write_fleet.v1",
    key: "FLEET_WRITE",
    label: "Fleet Sync",
    consequence: "FC only — lets Fleetr kick members from the EVE fleet and set the fleet MOTD",
  },
} as const satisfies Record<string, ScopeGate>;

export type ScopeGateKey = keyof typeof SCOPE_GATES;
