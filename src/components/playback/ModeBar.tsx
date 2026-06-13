"use client";

import { useFleet } from "@/contexts/FleetContext";
import { hasFleetControl } from "@/lib/roles";

const MODES = ["CRUISE", "BATTLE"] as const;

export function ModeBar() {
  const { state, send, myRole } = useFleet();
  const mode = state.mode;
  const isFc = hasFleetControl(myRole);

  const setMode = (newMode: (typeof MODES)[number]) => {
    if (!isFc || newMode === mode) return;
    send({ type: "fleet:set-mode", mode: newMode });
  };

  return (
    <div className="flex gap-1 items-center">
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
      {isFc && (
        <button
          onClick={() => send({ type: "fleet:advance" })}
          className="ml-1 px-3 py-1 text-xs font-medium rounded border border-fleet-border text-fleet-text-muted hover:border-fleet-accent hover:text-fleet-text transition-colors"
          title="Skip to the next track"
        >
          Skip ▸
        </button>
      )}
    </div>
  );
}
