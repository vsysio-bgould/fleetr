"use client";

import { AppSidebar } from "./AppSidebar";
import { FleetHeader } from "./FleetHeader";
import { PlayerPanel } from "@/components/player/PlayerPanel";
import { EventFeed } from "@/components/EventFeed";

interface Props {
  fleetId: string;
  fleetName: string;
  fcName: string;
  isOperator: boolean;
  activeFleets: Array<{ id: string; name: string; bossName: string }>;
  children: React.ReactNode;
}

export function AppShell({
  fleetId,
  fleetName,
  fcName,
  isOperator,
  activeFleets,
  children,
}: Props) {
  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 20% 40%, #0e1929 0%, #0b0f14 60%, #060a0f 100%)",
      }}
    >
      <FleetHeader
        fleetId={fleetId}
        fleetName={fleetName}
        fcName={fcName}
        isOperator={isOperator}
        activeFleets={activeFleets}
      />
      <div className="flex flex-1 min-h-0">
        <AppSidebar fleetId={fleetId} />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-40 shrink-0 border-b border-fleet-border bg-fleet-surface p-4">
            <PlayerPanel variant="bar" />
          </div>
          <main className="flex-1 flex flex-col min-w-0 p-4 gap-4 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <EventFeed />
    </div>
  );
}
