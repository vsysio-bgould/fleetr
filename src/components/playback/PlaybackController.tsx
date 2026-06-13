"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPlayer, type MediaSource } from "@/infra/player/createPlayer";
import type { IEmbedPlayer, PlayerError } from "@/infra/player/IEmbedPlayer";
import type { FleetMode } from "@prisma/client";

interface UsePlaybackControllerOptions {
  mediaId: string | null;
  source: MediaSource;
  volume: number;
  localVolume: number;
  battleVolumePercent: number;
  muted: boolean;
  mode: FleetMode;
  startedAt: string | null;
  onLocalVolumeChange: (volume: number) => void;
  onEnded?: () => void;
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
  localVolume,
  battleVolumePercent,
  muted,
  mode,
  startedAt,
  onLocalVolumeChange,
  onEnded,
}: UsePlaybackControllerOptions): PlaybackControllerReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<IEmbedPlayer | null>(null);
  const expectedVolumeRef = useRef(100);
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

  useEffect(() => {
    playerRef.current?.onEnded(() => onEnded?.());
  }, [onEnded]);

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
    const fleetMultiplier = volume / 100;
    const effective = muted
      ? 0
      : Math.round(localVolume * fleetMultiplier * (mode === "BATTLE" ? battleMultiplier : 1));
    expectedVolumeRef.current = effective;
    playerRef.current?.setVolume(effective);
  }, [volume, localVolume, battleVolumePercent, muted, mode]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (muted) return;
      const playerVolume = playerRef.current?.getVolume();
      if (playerVolume === null || playerVolume === undefined) return;
      if (Math.abs(playerVolume - expectedVolumeRef.current) <= 1) return;

      const battleMultiplier = mode === "BATTLE" ? battleVolumePercent / 100 : 1;
      const fleetMultiplier = volume / 100;
      const combinedMultiplier = fleetMultiplier * battleMultiplier;
      const nextLocalVolume =
        combinedMultiplier > 0 ? Math.round(playerVolume / combinedMultiplier) : playerVolume;
      onLocalVolumeChange(clampVolume(nextLocalVolume));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [volume, battleVolumePercent, muted, mode, onLocalVolumeChange]);

  const catchUp = useCallback(() => {
    if (!startedAt || !playerRef.current) return;
    const elapsedSeconds = (Date.now() - new Date(startedAt).getTime()) / 1000;
    playerRef.current.seekTo(Math.max(0, elapsedSeconds));
  }, [startedAt]);

  return { containerRef, catchUp, adPending, playerError };
}

function clampVolume(volume: number): number {
  return Math.min(100, Math.max(0, Math.round(volume)));
}
