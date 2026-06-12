"use client";

import { useFleet } from "@/contexts/FleetContext";
import type { MemberSnapshot } from "@/contexts/FleetContext";

export interface FleetSessionInfo {
  fleetId: string;
  myCharacterId: number;
  myRole: MemberSnapshot["role"] | null;
  isFc: boolean;
  isDelegate: boolean;
  hasElevatedAccess: boolean;
  connection: import("@/components/ConnectionPill").ConnectionStatus;
}

/**
 * Reads the current user's role and session info from the FleetProvider.
 * Use this in any component that needs to gate UI by role.
 */
export function useFleetSession(): FleetSessionInfo {
  const { fleetId, myCharacterId, myRole, connection } = useFleet();

  const isFc = myRole === "FLEET_COMMANDER";
  const isDelegate = myRole === "FC_DELEGATE";

  return {
    fleetId,
    myCharacterId,
    myRole,
    isFc,
    isDelegate,
    hasElevatedAccess: isFc || isDelegate,
    connection,
  };
}
