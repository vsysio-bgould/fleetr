"use client";

import { useFleet } from "@/contexts/FleetContext";
import { usePlaybackController } from "@/components/playback/PlaybackController";
import { AdPendingBanner } from "@/components/playback/AdPendingBanner";

function errorMessage(code: string): string {
  switch (code) {
    case "EMBEDDING_DISABLED":
      return "This track cannot be embedded — the FC should skip it.";
    case "NOT_FOUND":
      return "Track not found — it may have been removed from the platform.";
    default:
      return "Playback failed — the track is unavailable.";
  }
}

export function NowPlaying() {
  const { state, muted } = useFleet();
  const { currentMediaId, source, volume, startedAt, currentTitle, mode } = state.playback;

  const { containerRef, catchUp, adPending, playerError } = usePlaybackController({
    mediaId: currentMediaId,
    source,
    volume,
    muted,
    startedAt,
  });

  if (!currentMediaId) {
    return (
      <div className="text-[#9aa4b2] text-sm">
        Nothing playing — queue a track to get started
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-[#9aa4b2] uppercase tracking-wide">Now Playing</div>
        <div className="flex items-center gap-2">
          {startedAt && (
            <button
              onClick={catchUp}
              className="text-xs px-2 py-1 rounded border border-[#1f2a36] text-[#9aa4b2] hover:text-[#3fa7ff] hover:border-[#3fa7ff] transition-colors"
            >
              Catch Up
            </button>
          )}
        </div>
      </div>

      {adPending && <AdPendingBanner mode={mode} />}

      {playerError && (
        <div className="bg-red-900/20 border border-red-700 text-red-400 text-xs rounded px-3 py-2">
          {errorMessage(playerError.code)}
        </div>
      )}

      {currentTitle && (
        <div className="text-sm font-medium text-[#e6edf3] truncate">{currentTitle}</div>
      )}

      <div ref={containerRef} className="w-full rounded overflow-hidden" />
    </div>
  );
}
