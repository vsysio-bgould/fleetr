"use client";

import { useFleet } from "@/contexts/FleetContext";
import type { MemberSnapshot } from "@/contexts/FleetContext";
import { canManageDelegation, hasFleetControl } from "@/lib/roles";

export interface FleetSessionInfo {
  fleetId: string;
  myCharacterId: number;
  myRole: MemberSnapshot["role"] | null;
  isFc: boolean;
  isFleetBoss: boolean;
  isFleetCommander: boolean;
  isDelegate: boolean;
  canManageDelegation: boolean;
  hasElevatedAccess: boolean;
  connection: import("@/components/ConnectionPill").ConnectionStatus;
}

/**
 * Reads the current user's role and session info from the FleetProvider.
 * Use this in any component that needs to gate UI by role.
 */
export function useFleetSession(): FleetSessionInfo {
  const { fleetId, myCharacterId, myRole, connection } = useFleet();

  const isFleetBoss = myRole === "FLEET_BOSS";
  const isFleetCommander = myRole === "FLEET_COMMANDER";
  const isDelegate = myRole === "FC_DELEGATE";
  const isFc = hasFleetControl(myRole);

  return {
    fleetId,
    myCharacterId,
    myRole,
    isFleetBoss,
    isFleetCommander,
    isFc,
    isDelegate,
    canManageDelegation: canManageDelegation(myRole),
    hasElevatedAccess: isFc,
    connection,
  };
}
