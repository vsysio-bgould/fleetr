"use client";

import { useFleet } from "@/contexts/FleetContext";

export function ModeToggle() {
  const { state, send } = useFleet();
  const mode = state.playback.mode ?? "CRUISE";

  function setMode(next: "CRUISE" | "BATTLE") {
    if (next !== mode) {
      send({ type: "fleet:set-mode", payload: { mode: next } });
    }
  }

  return (
    <div className="flex rounded overflow-hidden border border-[#1f2a36] text-xs font-medium shrink-0">
      {(["CRUISE", "BATTLE"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-3 py-1 transition ${
            mode === m
              ? "bg-[#3fa7ff] text-[#0b0f14]"
              : "bg-[#0f141a] text-[#9aa4b2] hover:text-[#e6edf3]"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
