"use client";

import { AppSidebar } from "./AppSidebar";
import { FleetHeader } from "./FleetHeader";

interface Props {
  fleetId: string;
  fleetName: string;
  fcName: string;
  children: React.ReactNode;
}

export function AppShell({ fleetId, fleetName, fcName, children }: Props) {
  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 20% 40%, #0e1929 0%, #0b0f14 60%, #060a0f 100%)",
      }}
    >
      <FleetHeader fleetName={fleetName} fcName={fcName} />
      <div className="flex flex-1 min-h-0">
        <AppSidebar fleetId={fleetId} />
        <main className="flex-1 flex flex-col min-w-0 p-4 gap-4 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
