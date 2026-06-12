"use client";

import { useFleet } from "@/contexts/FleetContext";
import { ConnectionPill } from "@/components/ConnectionPill";

interface Props {
  fleetName: string;
  fcName: string;
}

export function FleetHeader({ fleetName, fcName }: Props) {
  const { state, connection } = useFleet();
  const { nowPlaying, members } = state;
  const memberCount = Object.keys(members).length;

  return (
    <header className="flex items-center h-12 px-4 bg-[#0b0f14] border-b border-[#1f2a36] shrink-0 gap-4">
      {/* Left: fleet identity */}
      <div className="flex flex-col justify-center min-w-0 w-48 shrink-0">
        <span className="text-sm font-semibold text-[#e6edf3] truncate">{fleetName}</span>
        <span className="text-[11px] text-[#9aa4b2] truncate">FC: {fcName}</span>
      </div>

      {/* Center: now playing */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-4">
        {nowPlaying ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[#3fa7ff] shrink-0">NOW PLAYING</span>
            <span className="text-sm text-[#e6edf3] truncate">{nowPlaying.title}</span>
          </div>
        ) : (
          <span className="text-[11px] text-[#4a5568]">No media playing</span>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-[11px] text-[#9aa4b2]">
          {memberCount} member{memberCount !== 1 ? "s" : ""}
        </div>
        <ConnectionPill status={connection} />
      </div>
    </header>
  );
}
