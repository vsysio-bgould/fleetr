"use client";

import { useFleet } from "@/contexts/FleetContext";
import { usePlaybackController } from "@/components/playback/PlaybackController";
import { AdPendingBanner } from "@/components/playback/AdPendingBanner";
import { ModeToggle } from "./ModeToggle";
import { MuteToggle } from "./MuteToggle";

export function PlayerPanel() {
  const { state, muted, mediaSource } = useFleet();
  const { nowPlaying, mode, volume } = state;

  const { containerRef, catchUp, adPending, playerError } = usePlaybackController({
    mediaId: nowPlaying?.mediaId ?? null,
    source: mediaSource,
    volume,
    muted,
    mode,
    startedAt: nowPlaying?.startedAt ?? null,
  });

  return (
    <div className="flex flex-col gap-2 h-full">
      {adPending && <AdPendingBanner mode={mode} />}

      {playerError && (
        <div className="bg-red-900/20 border border-red-700 text-red-400 text-xs rounded px-3 py-2">
          Playback failed — the track is unavailable.
        </div>
      )}

      {/* 16:9 embed container */}
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
        <div
          ref={containerRef}
          className="absolute inset-0 rounded overflow-hidden bg-black"
        />
        {!nowPlaying && (
          <div className="absolute inset-0 flex items-center justify-center text-[#4a5568] text-sm">
            No media playing
          </div>
        )}
      </div>

      {/* Controls strip */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          {nowPlaying ? (
            <span className="text-sm font-medium text-[#e6edf3] truncate">{nowPlaying.title}</span>
          ) : (
            <span className="text-sm text-[#4a5568]">Nothing queued</span>
          )}
          {nowPlaying && (
            <button
              onClick={catchUp}
              className="text-xs px-2 py-0.5 rounded border border-[#1f2a36] text-[#9aa4b2] hover:text-[#3fa7ff] hover:border-[#3fa7ff] transition-colors shrink-0"
            >
              Catch Up
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] uppercase tracking-[0.08em] text-[#9aa4b2] mr-1">{mode}</span>
          <ModeToggle />
          <MuteToggle />
        </div>
      </div>
    </div>
  );
}
