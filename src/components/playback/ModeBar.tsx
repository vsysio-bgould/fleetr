"use client";

import { useFleet } from "@/contexts/FleetContext";

const MODES = ["CRUISE", "BATTLE"] as const;

export function ModeBar() {
  const { state, fleetId, myRole } = useFleet();
  const { mode } = state.playback;
  const isFc = myRole === "FLEET_COMMANDER" || myRole === "FC_DELEGATE";

  const setMode = async (newMode: typeof MODES[number]) => {
    if (!isFc || newMode === mode) return;
    await fetch(`/api/v1/fleets/${fleetId}/playback`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: newMode }),
    });
  };

  return (
    <div className="flex gap-1">
      {MODES.map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          disabled={!isFc}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            mode === m
              ? m === "BATTLE"
                ? "bg-battle-accent text-white"
                : "bg-cruise-accent text-white"
              : "text-fleet-text-muted border border-fleet-border hover:border-fleet-accent disabled:hover:border-fleet-border"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
