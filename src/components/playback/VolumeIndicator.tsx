"use client";

import { useState } from "react";
import { useFleet } from "@/contexts/FleetContext";

export function VolumeIndicator() {
  const { state, fleetId, myRole } = useFleet();
  const { volume } = state.playback;
  const isFc = myRole === "FLEET_COMMANDER" || myRole === "FC_DELEGATE";
  const [pending, setPending] = useState(false);

  const setVolume = async (v: number) => {
    if (!isFc || pending) return;
    setPending(true);
    try {
      await fetch(`/api/v1/fleets/${fleetId}/playback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: v }),
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-fleet-text-muted">Vol</span>
      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        disabled={!isFc}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="w-24 accent-fleet-accent disabled:opacity-50"
      />
      <span className="text-xs text-fleet-text-muted w-6 text-right">{volume}</span>
    </div>
  );
}
