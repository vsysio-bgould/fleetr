"use client";

import { useFleet } from "@/contexts/FleetContext";

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polygon points="2,5 6,5 10,2 10,14 6,11 2,11" />
      {muted ? (
        <>
          <line x1="13" y1="5" x2="16" y2="8" />
          <line x1="16" y1="5" x2="13" y2="8" />
        </>
      ) : (
        <path d="M13 4.5a5 5 0 0 1 0 7" />
      )}
    </svg>
  );
}

export function MuteToggle() {
  const { muted, toggleMute } = useFleet();

  return (
    <button
      onClick={toggleMute}
      title={muted ? "Unmute" : "Mute"}
      className={`w-8 h-8 flex items-center justify-center rounded transition ${
        muted
          ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20"
          : "text-[#9aa4b2] hover:bg-[#18212c] hover:text-[#e6edf3]"
      }`}
    >
      <SpeakerIcon muted={muted} />
    </button>
  );
}
