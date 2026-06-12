"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFleet } from "@/contexts/FleetContext";
import { QueuePanel } from "@/components/queue/QueuePanel";

export default function FleetDashboardPage() {
  const { myCharacterId, state } = useFleet();
  const router = useRouter();

  // Handle being kicked — member no longer in members map
  // We give a short grace period for the initial snapshot to load
  useEffect(() => {
    const memberCount = Object.keys(state.members).length;
    if (memberCount > 0 && !state.members[myCharacterId]) {
      router.push("/kicked");
    }
  }, [state.members, myCharacterId, router]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <QueuePanel />
      </div>
    </div>
  );
}
