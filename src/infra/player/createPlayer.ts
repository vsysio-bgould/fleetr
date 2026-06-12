import type { MediaSource as PrismaMediaSource } from "@prisma/client";
import type { IEmbedPlayer } from "./IEmbedPlayer";
import { YouTubePlayer } from "./YouTubePlayer";
import { SoundCloudPlayer } from "./SoundCloudPlayer";

export type MediaSource = PrismaMediaSource;

export function createPlayer(source: MediaSource, container: HTMLElement): IEmbedPlayer {
  switch (source) {
    case "YOUTUBE":
      return new YouTubePlayer(container);
    case "SOUNDCLOUD":
      return new SoundCloudPlayer(container);
    case "CUSTOM":
      throw new Error("Custom player not yet implemented");
    default:
      throw new Error(`No player implementation for source: ${source as string}`);
  }
}
