"use client";

import { useFleet } from "@/contexts/FleetContext";

export function VolumeIndicator() {
  const { state, send, myRole } = useFleet();
  const volume = state.volume;
  const isFc = myRole === "FLEET_COMMANDER" || myRole === "FC_DELEGATE";

  const setVolume = (v: number) => {
    if (!isFc) return;
    send({ type: "fleet:set-volume", volume: v });
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
