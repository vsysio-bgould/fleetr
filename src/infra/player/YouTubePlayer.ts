import type { IEmbedPlayer, PlayerError } from "./IEmbedPlayer";

/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars */
declare namespace YT {
  const PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
  class Player {
    constructor(el: HTMLElement, opts: PlayerOptions);
    loadVideoById(videoId: string, startSeconds?: number): void;
    playVideo(): void;
    pauseVideo(): void;
    mute(): void;
    unMute(): void;
    getCurrentTime(): number;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    setVolume(volume: number): void;
    getVolume(): number;
    destroy(): void;
  }
  interface PlayerOptions {
    width?: string | number;
    height?: string | number;
    videoId?: string;
    playerVars?: Record<string, number | string>;
    events?: {
      onReady?: () => void;
      onStateChange?: (e: { data: number }) => void;
      onError?: (e: { data: number }) => void;
    };
  }
}
/* eslint-enable @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars */

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

// MEDIA-PLAYERS §7.2: if the player has not entered BUFFERING or PLAYING within
// this window after loadVideoById, treat the load as blocked by a pre-roll ad.
const AD_LOAD_TIMEOUT_MS = 3000;

let apiReady = false;
const pendingCallbacks: Array<() => void> = [];

function ensureApiLoaded(cb: () => void): void {
  if (apiReady) { cb(); return; }
  pendingCallbacks.push(cb);
  if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(script);
  window.onYouTubeIframeAPIReady = () => {
    apiReady = true;
    for (const fn of pendingCallbacks.splice(0)) fn();
  };
}

// https://developers.google.com/youtube/iframe_api_reference#onError
function mapYtError(code: number): PlayerError {
  switch (code) {
    case 100:
      return { code: "NOT_FOUND" };
    case 101:
    case 150:
      return { code: "EMBEDDING_DISABLED" };
    default:
      return { code: "UNAVAILABLE", reason: `yt_error_${code}` };
  }
}

export class YouTubePlayer implements IEmbedPlayer {
  private player: InstanceType<typeof YT.Player> | null = null;
  private container: HTMLElement;
  private endedHandler: (() => void) | null = null;
  private errorHandler: ((error: PlayerError) => void) | null = null;
  private adBlockedHandler: ((blocked: boolean) => void) | null = null;
  private loadTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingMediaId: string | null = null;
  private adBlockSignalled = false;
  private mountDiv: HTMLDivElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  load(mediaId: string, offsetSeconds = 0): void {
    this.pendingMediaId = mediaId;
    this.adBlockSignalled = false;
    this.armAdTimeout(mediaId);

    if (this.player) {
      this.player.loadVideoById(mediaId, offsetSeconds);
      return;
    }

    this.mountDiv = document.createElement("div");
    this.container.appendChild(this.mountDiv);

    ensureApiLoaded(() => {
      if (!this.mountDiv) return;
      this.player = new window.YT.Player(this.mountDiv, {
        width: "100%",
        height: "100%",
        videoId: mediaId,
        playerVars: {
          autoplay: 1,
          start: Math.floor(offsetSeconds),
          controls: 1,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onStateChange: (e: { data: number }) => this.handleStateChange(e.data),
          onError: (e: { data: number }) => {
            this.clearAdTimeout();
            this.errorHandler?.(mapYtError(e.data));
          },
        },
      });
    });
  }

  private armAdTimeout(mediaId: string): void {
    this.clearAdTimeout();
    this.loadTimeout = setTimeout(() => {
      if (this.pendingMediaId === mediaId) {
        this.adBlockSignalled = true;
        this.adBlockedHandler?.(true);
      }
    }, AD_LOAD_TIMEOUT_MS);
  }

  private clearAdTimeout(): void {
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = null;
    }
  }

  private handleStateChange(state: number): void {
    const { BUFFERING, PLAYING, ENDED } = window.YT.PlayerState;
    if (state === BUFFERING || state === PLAYING) {
      this.clearAdTimeout();
      this.pendingMediaId = null;
      if (this.adBlockSignalled) {
        this.adBlockSignalled = false;
        this.adBlockedHandler?.(false);
      }
    } else if (state === ENDED) {
      this.endedHandler?.();
    }
  }

  play(): void { this.player?.playVideo(); }
  pause(): void { this.player?.pauseVideo(); }
  mute(): void { this.player?.mute(); }
  unmute(): void { this.player?.unMute(); }
  getCurrentTime(): number { return this.player?.getCurrentTime() ?? 0; }
  setVolume(volume: number): void {
    const player = this.player as ({ setVolume?: (volume: number) => void } | null);
    if (typeof player?.setVolume === "function") player.setVolume(volume);
  }
  getVolume(): number | null {
    const player = this.player as ({ getVolume?: () => number } | null);
    return typeof player?.getVolume === "function" ? player.getVolume() : null;
  }
  seekTo(seconds: number): void { this.player?.seekTo(seconds, true); }

  onEnded(handler: () => void): void { this.endedHandler = handler; }
  onError(handler: (error: PlayerError) => void): void { this.errorHandler = handler; }
  onAdBlocked(handler: (blocked: boolean) => void): void { this.adBlockedHandler = handler; }

  destroy(): void {
    this.clearAdTimeout();
    this.player?.destroy();
    this.player = null;
    this.mountDiv = null;
    this.endedHandler = null;
    this.errorHandler = null;
    this.adBlockedHandler = null;
    this.container.innerHTML = "";
  }
}
