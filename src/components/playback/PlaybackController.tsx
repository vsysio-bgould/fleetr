"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPlayer, type MediaSource } from "@/infra/player/createPlayer";
import type { IEmbedPlayer, PlayerError } from "@/infra/player/IEmbedPlayer";
import type { FleetMode } from "@prisma/client";

interface UsePlaybackControllerOptions {
  mediaId: string | null;
  source: MediaSource;
  volume: number;
  battleVolumePercent: number;
  muted: boolean;
  mode: FleetMode;
  startedAt: string | null;
}

interface PlaybackControllerReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  catchUp: () => void;
  /** True while a load appears blocked by a pre-roll ad (MEDIA-PLAYERS §7.2). */
  adPending: boolean;
  playerError: PlayerError | null;
}

export function usePlaybackController({
  mediaId,
  source,
  volume,
  battleVolumePercent,
  muted,
  mode,
  startedAt,
}: UsePlaybackControllerOptions): PlaybackControllerReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<IEmbedPlayer | null>(null);
  const [adPending, setAdPending] = useState(false);
  const [playerError, setPlayerError] = useState<PlayerError | null>(null);

  // Create player once per source change (source is immutable per fleet)
  useEffect(() => {
    if (!containerRef.current) return;
    playerRef.current?.destroy();
    const player = createPlayer(source, containerRef.current);
    player.onError((error) => setPlayerError(error));
    player.onAdBlocked?.((blocked) => setAdPending(blocked));
    playerRef.current = player;

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [source]);

  // Load new media whenever mediaId changes
  useEffect(() => {
    if (!playerRef.current) return;
    if (!mediaId) {
      playerRef.current.pause();
      setAdPending(false);
      setPlayerError(null);
      return;
    }
    setPlayerError(null);
    const offset = startedAt
      ? Math.max(0, (Date.now() - new Date(startedAt).getTime()) / 1000)
      : 0;
    playerRef.current.load(mediaId, offset);
  }, [mediaId, startedAt]);

  // Sync effective volume: fleet volume × battle multiplier, respecting local mute
  useEffect(() => {
    const battleMultiplier = battleVolumePercent / 100;
    const effective = muted
      ? 0
      : Math.round(volume * (mode === "BATTLE" ? battleMultiplier : 1));
    playerRef.current?.setVolume(effective);
  }, [volume, battleVolumePercent, muted, mode]);

  const catchUp = useCallback(() => {
    if (!startedAt || !playerRef.current) return;
    const elapsedSeconds = (Date.now() - new Date(startedAt).getTime()) / 1000;
    playerRef.current.seekTo(Math.max(0, elapsedSeconds));
  }, [startedAt]);

  return { containerRef, catchUp, adPending, playerError };
}
