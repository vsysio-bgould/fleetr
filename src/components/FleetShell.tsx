"use client";

import { useState } from "react";
import type { MediaSource, SessionRole } from "@prisma/client";
import { FleetProvider, useFleet } from "@/contexts/FleetContext";
import { AppShell } from "@/components/shell/AppShell";
import { PlayerPanel } from "@/components/player/PlayerPanel";
import { QueuePanel } from "@/components/queue/QueuePanel";
import { ConnectionPill } from "@/components/ConnectionPill";
import { InstructionsDialog } from "@/components/InstructionsButton";
import { LogoutButton } from "@/components/LogoutButton";
import { EventFeed } from "@/components/EventFeed";
import { hasFleetControl } from "@/lib/roles";

interface Props {
  children: React.ReactNode;
  fleetId: string;
  characterId: number;
  role: SessionRole;
  isOperator: boolean;
  activeFleets: Array<{ id: string; name: string; bossName: string }>;
  grantedScopes: string[];
  mediaSource: MediaSource;
  battleVolumePercent: number;
  downvoteDeletePercent: number;
  fleetName: string;
  fcName: string;
  partyKitHost: string;
  partyKitToken: string;
}

export function FleetShell({
  children,
  fleetId,
  characterId,
  role,
  isOperator,
  activeFleets,
  grantedScopes,
  mediaSource,
  battleVolumePercent,
  downvoteDeletePercent,
  fleetName,
  fcName,
  partyKitHost,
  partyKitToken,
}: Props) {
  return (
    <FleetProvider
      fleetId={fleetId}
      characterId={characterId}
      grantedScopes={grantedScopes}
      mediaSource={mediaSource}
      battleVolumePercent={battleVolumePercent}
      downvoteDeletePercent={downvoteDeletePercent}
      partyKitHost={partyKitHost}
      partyKitToken={partyKitToken}
      isOperator={isOperator}
    >
      <FleetChrome
        fleetId={fleetId}
        fleetName={fleetName}
        fcName={fcName}
        initialRole={role}
        isOperator={isOperator}
        activeFleets={activeFleets}
      >
        {children}
      </FleetChrome>
    </FleetProvider>
  );
}

function FleetChrome({
  children,
  fleetId,
  fleetName,
  fcName,
  initialRole,
  isOperator,
  activeFleets,
}: {
  children: React.ReactNode;
  fleetId: string;
  fleetName: string;
  fcName: string;
  initialRole: SessionRole;
  isOperator: boolean;
  activeFleets: Array<{ id: string; name: string; bossName: string }>;
}) {
  const { myRole } = useFleet();
  const effectiveRole = isOperator ? "FLEET_BOSS" : myRole ?? initialRole;

  return hasFleetControl(effectiveRole) ? (
    <AppShell
      fleetId={fleetId}
      fleetName={fleetName}
      fcName={fcName}
      isOperator={isOperator}
      activeFleets={activeFleets}
    >
      {children}
    </AppShell>
  ) : (
    <LineMemberShell fleetName={fleetName} fcName={fcName} />
  );
}

function LineMemberShell({ fleetName, fcName }: { fleetName: string; fcName: string }) {
  const { state, connection } = useFleet();
  const [helpOpen, setHelpOpen] = useState(false);
  const memberCount = Object.keys(state.members).length;

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 20% 40%, #0e1929 0%, #0b0f14 60%, #060a0f 100%)",
      }}
    >
      <header className="flex items-center h-10 px-4 bg-[#0b0f14] border-b border-[#1f2a36] shrink-0 gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-sm font-semibold text-[#e6edf3] truncate">{fleetName}</span>
          <span className="text-[11px] text-[#9aa4b2] truncate">Boss: {fcName}</span>
        </div>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="text-[11px] text-[#9aa4b2]">
            {memberCount} member{memberCount !== 1 ? "s" : ""}
          </span>
          <ConnectionPill status={connection} />
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="text-[11px] text-[#9aa4b2] hover:text-[#e6edf3] border border-[#1f2a36] hover:border-[#3fa7ff] rounded px-2 py-1 transition-colors"
          >
            Help
          </button>
          <LogoutButton />
        </div>
      </header>

      <div className="flex flex-1 min-h-0 gap-4 p-4 overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          <PlayerPanel />
        </div>
        <div className="w-[30rem] max-w-[45%] shrink-0 min-h-0 rounded border border-[#1f2a36] bg-[#121821]/80 backdrop-blur-sm overflow-hidden flex flex-col">
          <QueuePanel />
        </div>
      </div>
      <EventFeed />
      {helpOpen && <InstructionsDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
