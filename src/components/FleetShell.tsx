"use client";

import type { SessionRole } from "@prisma/client";
import { FleetProvider } from "@/contexts/FleetContext";
import { AppShell } from "@/components/shell/AppShell";
import { PlayerPanel } from "@/components/player/PlayerPanel";
import { QueuePanel } from "@/components/queue/QueuePanel";

interface Props {
  children: React.ReactNode;
  fleetId: string;
  characterId: number;
  role: SessionRole;
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
  fleetName,
  fcName,
  partyKitHost,
  partyKitToken,
}: Props) {
  const isFc = role === "FLEET_COMMANDER" || role === "FC_DELEGATE";

  return (
    <FleetProvider
      fleetId={fleetId}
      characterId={characterId}
      partyKitHost={partyKitHost}
      partyKitToken={partyKitToken}
    >
      {isFc ? (
        <AppShell fleetId={fleetId} fleetName={fleetName} fcName={fcName}>
          {children}
        </AppShell>
      ) : (
        <LineMemberShell fleetName={fleetName} fcName={fcName} />
      )}
    </FleetProvider>
  );
}

function LineMemberShell({ fleetName, fcName }: { fleetName: string; fcName: string }) {
  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 20% 40%, #0e1929 0%, #0b0f14 60%, #060a0f 100%)",
      }}
    >
      {/* Minimal header */}
      <header className="flex items-center h-10 px-4 bg-[#0b0f14] border-b border-[#1f2a36] shrink-0 gap-3">
        <span className="text-sm font-semibold text-[#e6edf3]">{fleetName}</span>
        <span className="text-[11px] text-[#9aa4b2]">FC: {fcName}</span>
      </header>

      {/* Two-column: player left, queue right */}
      <div className="flex flex-1 min-h-0 gap-4 p-4">
        <div className="flex-1 min-w-0">
          <PlayerPanel />
        </div>
        <div className="w-80 shrink-0 rounded border border-[#1f2a36] bg-[#121821]/80 backdrop-blur-sm overflow-hidden flex flex-col">
          <QueuePanel />
        </div>
      </div>
    </div>
  );
}
