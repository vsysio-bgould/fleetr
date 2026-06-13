export type PlayerError =
  | { code: "EMBEDDING_DISABLED" }
  | { code: "NOT_FOUND" }
  | { code: "UNAVAILABLE"; reason: string };

/**
 * Uniform embed player interface. Each implementation wraps a platform-specific
 * embed SDK. The constructor receives the container element; the player is
 * responsible for its own DOM lifecycle.
 */
export interface IEmbedPlayer {
  /** Load and begin playing a track from the start, or from offsetSeconds. */
  load(mediaId: string, offsetSeconds?: number): void;

  play(): void;
  pause(): void;

  /** Seek to an absolute position in seconds. */
  seekTo(seconds: number): void;

  /** 0–100 */
  setVolume(volume: number): void;
  getVolume(): number | null;
  mute(): void;
  unmute(): void;

  /** Returns current playback position in seconds. */
  getCurrentTime(): number;

  /** Emitted when the track ends naturally. */
  onEnded(handler: () => void): void;

  /** Emitted on unrecoverable player errors. */
  onError(handler: (error: PlayerError) => void): void;

  /**
   * Ad-detection extension (MEDIA-PLAYERS §7.2). Called with true when a load
   * appears blocked by a pre-roll ad, and false once playback actually begins.
   * Only the YouTube adapter emits this; others never call the handler.
   */
  onAdBlocked?(handler: (blocked: boolean) => void): void;

  /** Tear down the player and remove its DOM. */
  destroy(): void;
}
