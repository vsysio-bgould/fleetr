"use client";

import { useFleet } from "@/contexts/FleetContext";
import { usePlaybackController } from "@/components/playback/PlaybackController";
import { AdPendingBanner } from "@/components/playback/AdPendingBanner";
import { VolumeIndicator } from "@/components/playback/VolumeIndicator";
import { Tooltip } from "@/components/ui/Tooltip";
import { ModeToggle } from "./ModeToggle";
import { MuteToggle } from "./MuteToggle";

interface Props {
  variant?: "panel" | "bar";
}

export function PlayerPanel({ variant = "panel" }: Props) {
  const { state, muted, mediaSource } = useFleet();
  const { nowPlaying, mode, volume, battleVolumePercent } = state;

  const { containerRef, catchUp, adPending, playerError } = usePlaybackController({
    mediaId: nowPlaying?.mediaId ?? null,
    source: mediaSource,
    volume,
    battleVolumePercent,
    muted,
    mode,
    startedAt: nowPlaying?.startedAt ?? null,
  });

  if (variant === "bar") {
    return (
      <div className="flex items-center gap-4 h-full min-w-0">
        <div className="relative h-full aspect-video max-w-64 shrink-0 rounded overflow-hidden bg-black">
          <div
            ref={containerRef}
            className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0"
          />
          {!nowPlaying && (
            <div className="absolute inset-0 flex items-center justify-center text-[#4a5568] text-sm">
              No media playing
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {adPending && <AdPendingBanner mode={mode} />}
          {playerError && (
            <div className="bg-red-900/20 border border-red-700 text-red-400 text-xs rounded px-3 py-2">
              Playback failed - the track is unavailable.
            </div>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[#3fa7ff] shrink-0">
              NOW PLAYING
            </span>
            <span className="text-sm font-medium text-[#e6edf3] truncate">
              {nowPlaying ? nowPlaying.title : "Nothing queued"}
            </span>
            {nowPlaying && (
              <Tooltip content="Seek to the fleet reference position" side="top">
                <button
                  onClick={catchUp}
                  className="text-xs px-2 py-0.5 rounded border border-[#1f2a36] text-[#9aa4b2] hover:text-[#3fa7ff] hover:border-[#3fa7ff] transition-colors shrink-0"
                >
                  Catch Up
                </button>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] uppercase tracking-[0.08em] text-[#9aa4b2] mr-1">
                MODE:
              </span>
              <ModeToggle />
              <MuteToggle />
            </div>
            <VolumeIndicator />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full min-h-0 overflow-hidden">
      {adPending && <AdPendingBanner mode={mode} />}

      {playerError && (
        <div className="bg-red-900/20 border border-red-700 text-red-400 text-xs rounded px-3 py-2">
          Playback failed — the track is unavailable.
        </div>
      )}

      <div className="relative flex-1 min-h-0 flex items-center justify-start overflow-hidden rounded bg-black">
        <div
          ref={containerRef}
          className="relative h-full w-full overflow-hidden bg-black [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0"
        />
        {!nowPlaying && (
          <div className="absolute inset-0 flex items-center justify-center text-[#4a5568] text-sm">
            No media playing
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-1 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {nowPlaying ? (
            <span className="text-sm font-medium text-[#e6edf3] truncate">{nowPlaying.title}</span>
          ) : (
            <span className="text-sm text-[#4a5568]">Nothing queued</span>
          )}
          {nowPlaying && (
            <Tooltip content="Seek to the fleet reference position" side="top">
              <button
                onClick={catchUp}
                className="text-xs px-2 py-0.5 rounded border border-[#1f2a36] text-[#9aa4b2] hover:text-[#3fa7ff] hover:border-[#3fa7ff] transition-colors shrink-0"
              >
                Catch Up
              </button>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#9aa4b2] mr-1">
              MODE:
            </span>
            <ModeToggle />
            <MuteToggle />
          </div>
          <VolumeIndicator />
        </div>
      </div>
    </div>
  );
}
