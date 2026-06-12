import type { IEmbedPlayer, PlayerError } from "./IEmbedPlayer";

declare global {
  interface Window {
    SC: { Widget: (iframe: HTMLIFrameElement) => SCWidget };
  }
}

interface SCWidget {
  bind(event: string, handler: () => void): void;
  unbind(event: string): void;
  load(url: string, opts?: Record<string, unknown>): void;
  play(): void;
  pause(): void;
  seekTo(ms: number): void;
  setVolume(volume: number): void;
  getPosition(cb: (ms: number) => void): void;
}

const SC_EVENTS = { PLAY: "play", PAUSE: "pause", FINISH: "finish", ERROR: "error" };

function ensureWidgetApi(cb: () => void): void {
  if (window.SC) { cb(); return; }
  const script = document.createElement("script");
  script.src = "https://w.soundcloud.com/player/api.js";
  script.onload = cb;
  document.head.appendChild(script);
}

export class SoundCloudPlayer implements IEmbedPlayer {
  private container: HTMLElement;
  private iframe: HTMLIFrameElement | null = null;
  private widget: SCWidget | null = null;
  private endedHandler: (() => void) | null = null;
  private errorHandler: ((error: PlayerError) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  load(mediaId: string, offsetSeconds = 0): void {
    const encoded = encodeURIComponent(mediaId);
    const src = `https://w.soundcloud.com/player/?url=${encoded}&auto_play=true&buying=false&liking=false&download=false&sharing=false&show_artwork=true&show_comments=false&show_playcount=false&show_user=false&hide_related=true&visual=false`;

    if (this.widget) {
      // Hot-reload into existing widget
      this.widget.load(mediaId, { auto_play: true, buying: false });
      if (offsetSeconds > 0) {
        setTimeout(() => this.widget?.seekTo(offsetSeconds * 1000), 500);
      }
      return;
    }

    this.iframe = document.createElement("iframe");
    this.iframe.src = src;
    this.iframe.width = "100%";
    this.iframe.height = "166";
    this.iframe.style.border = "0";
    this.container.appendChild(this.iframe);

    ensureWidgetApi(() => {
      if (!this.iframe) return;
      this.widget = window.SC.Widget(this.iframe);

      this.widget.bind(SC_EVENTS.PLAY, () => {
        if (offsetSeconds > 0) {
          this.widget?.seekTo(offsetSeconds * 1000);
          offsetSeconds = 0; // only seek on first play
        }
      });
      this.widget.bind(SC_EVENTS.FINISH, () => {
        this.endedHandler?.();
      });
      this.widget.bind(SC_EVENTS.ERROR, () => {
        this.errorHandler?.({ code: "UNAVAILABLE", reason: "soundcloud_widget_error" });
      });
    });
  }

  play(): void { this.widget?.play(); }
  pause(): void { this.widget?.pause(); }
  mute(): void { this.widget?.setVolume(0); }
  unmute(): void { this.widget?.setVolume(80); }
  getCurrentTime(): number {
    let t = 0;
    this.widget?.getPosition((ms) => { t = ms / 1000; });
    return t;
  }
  setVolume(volume: number): void { this.widget?.setVolume(volume); }
  seekTo(seconds: number): void { this.widget?.seekTo(seconds * 1000); }

  onEnded(handler: () => void): void { this.endedHandler = handler; }
  onError(handler: (error: PlayerError) => void): void { this.errorHandler = handler; }

  destroy(): void {
    if (this.widget) {
      this.widget.unbind(SC_EVENTS.PLAY);
      this.widget.unbind(SC_EVENTS.FINISH);
      this.widget.unbind(SC_EVENTS.ERROR);
    }
    this.iframe?.remove();
    this.iframe = null;
    this.widget = null;
    this.endedHandler = null;
    this.errorHandler = null;
  }
}
