"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFleet } from "@/contexts/FleetContext";
import { NowPlaying } from "@/components/playback/NowPlaying";
import { ModeBar } from "@/components/playback/ModeBar";
import { VolumeIndicator } from "@/components/playback/VolumeIndicator";
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
      {/* Playback bar */}
      <div className="border-b border-fleet-border bg-fleet-surface p-4 flex flex-col gap-3">
        <NowPlaying />
        <div className="flex items-center justify-between">
          <ModeBar />
          <VolumeIndicator />
        </div>
      </div>

      {/* Queue */}
      <div className="flex-1 overflow-hidden">
        <QueuePanel />
      </div>
    </div>
  );
}
