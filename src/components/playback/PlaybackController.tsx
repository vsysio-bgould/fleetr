"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPlayer, type MediaSource } from "@/infra/player/createPlayer";
import type { IEmbedPlayer, PlayerError } from "@/infra/player/IEmbedPlayer";

interface UsePlaybackControllerOptions {
  mediaId: string | null;
  source: MediaSource;
  volume: number;
  muted: boolean;
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
  muted,
  startedAt,
}: UsePlaybackControllerOptions): PlaybackControllerReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<IEmbedPlayer | null>(null);
  const [adPending, setAdPending] = useState(false);
  const [playerError, setPlayerError] = useState<PlayerError | null>(null);

  // Create player once per source change (source changing is rare)
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
    if (!mediaId || !playerRef.current) return;
    setPlayerError(null);
    const offset = startedAt
      ? Math.max(0, (Date.now() - new Date(startedAt).getTime()) / 1000)
      : 0;
    playerRef.current.load(mediaId, offset);
  }, [mediaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync effective volume (respects mute)
  useEffect(() => {
    playerRef.current?.setVolume(muted ? 0 : volume);
  }, [volume, muted]);

  const catchUp = useCallback(() => {
    if (!startedAt || !playerRef.current) return;
    const elapsedSeconds = (Date.now() - new Date(startedAt).getTime()) / 1000;
    playerRef.current.seekTo(Math.max(0, elapsedSeconds));
  }, [startedAt]);

  return { containerRef, catchUp, adPending, playerError };
}
