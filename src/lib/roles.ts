import type { SessionRole } from "@prisma/client";

export function hasFleetControl(role: SessionRole | null | undefined): boolean {
  return role === "FLEET_BOSS" || role === "FLEET_COMMANDER" || role === "FC_DELEGATE";
}

export function canManageDelegation(role: SessionRole | null | undefined): boolean {
  return role === "FLEET_BOSS" || role === "FLEET_COMMANDER";
}

export function roleLabel(role: SessionRole): string {
  switch (role) {
    case "FLEET_BOSS":
      return "Boss";
    case "FLEET_COMMANDER":
      return "FC";
    case "FC_DELEGATE":
      return "Delegate";
    case "LINE_MEMBER":
      return "Member";
  }
}
