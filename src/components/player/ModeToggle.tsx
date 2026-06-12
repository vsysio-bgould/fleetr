"use client";

import { useFleet } from "@/contexts/FleetContext";

export function ModeToggle() {
  const { state, send, myRole } = useFleet();
  const mode = state.mode;
  const isFc = myRole === "FLEET_COMMANDER" || myRole === "FC_DELEGATE";

  function setMode(next: "CRUISE" | "BATTLE") {
    if (isFc && next !== mode) {
      send({ type: "fleet:set-mode", mode: next });
    }
  }

  return (
    <div className="flex rounded overflow-hidden border border-[#1f2a36] text-xs font-medium shrink-0">
      {(["CRUISE", "BATTLE"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          disabled={!isFc}
          className={`px-3 py-1 transition disabled:cursor-default ${
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
