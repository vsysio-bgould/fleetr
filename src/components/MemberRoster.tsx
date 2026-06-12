"use client";

import { useFleet, type MemberSnapshot } from "@/contexts/FleetContext";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { StatusBadge, type BadgeState } from "@/components/ui/StatusBadge";
import { Tooltip } from "@/components/ui/Tooltip";

function roleToBadgeState(role: MemberSnapshot["role"]): BadgeState {
  switch (role) {
    case "FLEET_COMMANDER": return "active";
    case "FC_DELEGATE":     return "cruise";
    case "LINE_MEMBER":     return "idle";
  }
}

function roleLabel(role: MemberSnapshot["role"]): string {
  switch (role) {
    case "FLEET_COMMANDER": return "FC";
    case "FC_DELEGATE":     return "Delegate";
    case "LINE_MEMBER":     return "Member";
  }
}

interface Props {
  className?: string;
}

export function MemberRoster({ className = "" }: Props) {
  const { state, myCharacterId, myRole, fleetId } = useFleet();
  const members = Object.values(state.members);
  const isFc = myRole === "FLEET_COMMANDER" || myRole === "FC_DELEGATE";

  const handleKick = async (target: MemberSnapshot) => {
    if (!confirm(`Kick ${target.characterName}?`)) return;
    await fetch(`/api/v1/fleets/${fleetId}/members/${target.characterId}`, {
      method: "DELETE",
    });
  };

  const handleDelegate = async (target: MemberSnapshot) => {
    const isDelegate = target.role === "FC_DELEGATE";
    await fetch(
      isDelegate
        ? `/api/v1/fleets/${fleetId}/delegates/${target.characterId}`
        : `/api/v1/fleets/${fleetId}/delegates`,
      {
        method: isDelegate ? "DELETE" : "POST",
        headers: isDelegate ? undefined : { "Content-Type": "application/json" },
        body: isDelegate ? undefined : JSON.stringify({ characterId: target.characterId }),
      }
    );
  };

  if (members.length === 0) {
    return (
      <div className={`text-[#9aa4b2] text-sm text-center py-8 ${className}`}>
        No members yet
      </div>
    );
  }

  return (
    <div className={`flex flex-col divide-y divide-[#1f2a36] ${className}`}>
      {members.map((member) => (
        <div key={member.characterId} className="flex items-center gap-3 px-4 py-3 hover:bg-[#18212c]/50">
          <CharacterAvatar
            characterId={member.characterId}
            characterName={member.characterName}
            size={32}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#e6edf3] truncate">
                {member.characterName}
              </span>
              {member.characterId === myCharacterId && (
                <span className="text-xs text-[#9aa4b2]">(you)</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge
                state={roleToBadgeState(member.role)}
                label={roleLabel(member.role)}
              />
              {state.locations[member.characterId] && (
                <span className="text-xs text-[#9aa4b2]">
                  {state.locations[member.characterId]}
                </span>
              )}
            </div>
          </div>

          {isFc && member.characterId !== myCharacterId && myRole === "FLEET_COMMANDER" && (
            <div className="flex gap-1 shrink-0">
              <Tooltip content={member.role === "FC_DELEGATE" ? "Remove fleet control delegation" : "Delegate fleet control"} side="top">
                <button
                  onClick={() => handleDelegate(member)}
                  className="text-xs px-2 py-1 rounded border border-[#1f2a36] text-[#9aa4b2] hover:text-[#e6edf3] hover:border-[#3fa7ff] transition-colors"
                >
                  {member.role === "FC_DELEGATE" ? "Undelegate" : "Delegate"}
                </button>
              </Tooltip>
              <Tooltip content="Kick this member from Fleetr" side="top">
                <button
                  onClick={() => handleKick(member)}
                  className="text-xs px-2 py-1 rounded border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors"
                >
                  Kick
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
