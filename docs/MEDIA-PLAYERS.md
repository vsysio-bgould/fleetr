# Fleetr Media Players

> Defines the supported media platforms, the shared player interface, submission validation, the advisory notice system, and the path for adding future player types.

---

## 1. Supported Platforms

| Platform | Status | Player API |
|----------|--------|------------|
| YouTube | Supported | IFrame Player API |
| SoundCloud | Supported | Widget API |
| Custom (FC upload) | Future | `<audio>` element |

The FC selects a platform when creating a fleet. The choice is immutable — all queue submissions for that fleet must match the fleet's platform. This keeps the player consistent throughout a session and avoids mid-queue player switching.

---

## 2. Platform Selection at Fleet Creation

`Fleet.mediaSource` is set to `YOUTUBE`, `SOUNDCLOUD`, or `CUSTOM` at creation time and never updated. The fleet creation form presents the options with a brief description of each:

| Option | Description shown in UI |
|--------|--------------------------|
| YouTube | Largest library. YouTube Premium recommended to avoid ads. |
| SoundCloud | Music-focused. No ads for most tracks. Smaller library. |
| Custom *(future)* | FC uploads mp3, flac, or other audio files directly. |

Submission validation rejects URLs that do not match the fleet's platform. The error message tells the user which platform the fleet is using.

---

## 3. The Player Interface

All player implementations satisfy a shared `IEmbedPlayer` interface. This is the contract the playback service and PartyKit message handlers program against — never a concrete player type.

```typescript
// src/infra/player/types.ts

export interface IEmbedPlayer {
    /** Load and begin playing a track from the start, or from offsetSeconds. */
    load(mediaId: string, offsetSeconds?: number): void;

    play(): void;
    pause(): void;

    /** Seek to an absolute position in seconds. */
    seekTo(seconds: number): void;

    /** 0–100 */
    setVolume(volume: number): void;
    mute(): void;
    unmute(): void;

    /** Returns current playback position in seconds. */
    getCurrentTime(): number;

    /** Emitted when the track ends naturally. */
    onEnded(handler: () => void): void;

    /** Emitted on unrecoverable player errors. */
    onError(handler: (error: PlayerError) => void): void;
}

export type PlayerError =
    | { code: 'EMBEDDING_DISABLED' }
    | { code: 'NOT_FOUND' }
    | { code: 'UNAVAILABLE'; reason: string };
```

Each platform has a concrete adapter:

```
src/infra/player/
├── types.ts              # IEmbedPlayer, PlayerError
├── YouTubePlayer.ts      # IFrame API adapter
├── SoundCloudPlayer.ts   # Widget API adapter
└── createPlayer.ts       # Factory — returns the correct impl for a MediaSource
```

```typescript
// src/infra/player/createPlayer.ts
export function createPlayer(
    mediaSource: MediaSource,
    container: HTMLElement,
): IEmbedPlayer {
    switch (mediaSource) {
        case 'YOUTUBE':    return new YouTubePlayer(container);
        case 'SOUNDCLOUD': return new SoundCloudPlayer(container);
        case 'CUSTOM':     throw new Error('Custom player not yet implemented');
    }
}
```

Adding a new platform in the future requires only: implementing `IEmbedPlayer`, adding a case to `createPlayer`, and adding the enum value to the schema. Nothing else changes.

---

## 4. YouTube

### 4.1 Player API

Use the [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference). Use the `react-youtube` package as the React wrapper.

Key methods used:

| Operation | API call |
|-----------|----------|
| Load + play from offset | `loadVideoById(videoId, startSeconds)` |
| Pause | `pauseVideo()` |
| Resume | `playVideo()` |
| Seek | `seekTo(seconds, true)` |
| Volume | `setVolume(0–100)` |
| Mute / unmute | `mute()` / `unMute()` |
| Current position | `getCurrentTime()` |

State events via `onStateChange`: `PLAYING (1)`, `PAUSED (2)`, `ENDED (0)`, `BUFFERING (3)`.

Error codes via `onError`: `101` and `150` both mean embedding is disabled for this video.

### 4.2 Submission Validation

Validate submitted YouTube URLs **before** they enter the queue. A video with embedding disabled will cause a silent failure in every user's player.

Use the **YouTube Data API** `videos.list` endpoint with the `status` part:

```
GET https://www.googleapis.com/youtube/v3/videos
    ?part=snippet,contentDetails,status
    &id={videoId}
    &key={API_KEY}
```

Check `status.embeddable === true`. Reject the submission with a user-facing error if false.

Cache the full response (`snippet.title`, `snippet.thumbnails`, `contentDetails.duration`) in `QueueEntry` at submission time. Never call the Data API again for the same entry — the metadata does not change.

The YouTube Data API has a default quota of **10,000 units/day**. Each `videos.list` call costs 1 unit. At typical fleet scale this is not a concern, but the above caching ensures the quota is not wasted on re-fetches.

`contentDetails.duration` is an ISO 8601 duration string (`PT3M45S`). Parse it to seconds and store in `QueueEntry.duration`.

### 4.3 Thumbnail URLs

Serve thumbnails directly from YouTube's CDN using the standard pattern:

```
https://img.youtube.com/vi/{videoId}/mqdefault.jpg
```

Do **not** download and re-host thumbnails. Caching YouTube content on your own infrastructure violates the Terms of Service.

### 4.4 Compliance

- Use the IFrame API. No direct video file access, no proxying, no downloading.
- The player must be visible. Do not render it off-screen or with zero dimensions.
- YouTube branding is shown by the IFrame API and must not be removed. The `modestbranding` parameter was deprecated in 2023 and no longer has effect.
- Each user plays video on their own device via their own player instance. This is the intended model and raises no copyright concerns.
- Synchronising playback state (timestamps, play/pause commands) via PartyKit is passing integers between clients, not touching video data.

### 4.5 Autoplay

Browsers block `playVideo()` until the user has interacted with the page. A user joining mid-track will need to manually start playback. Show a visible **"Tap to join playback"** prompt in the `NowPlaying` component until the first interaction is received. After that, all subsequent auto-advances (track ending, FC skip) will work without further prompts.

---

## 5. SoundCloud

### 5.1 Player API

Use the [SoundCloud Widget API](https://developers.soundcloud.com/docs/api/html5-widget). Load it via:

```html
<script src="https://w.soundcloud.com/player/api.js"></script>
```

Or import as a module via the `soundcloud-widget` npm package.

Key methods:

| Operation | API call |
|-----------|----------|
| Load track | Widget `load(url, { auto_play: true, start_track: 0 })` |
| Play / pause | `widget.play()` / `widget.pause()` |
| Seek | `widget.seekTo(milliseconds)` — note: milliseconds, not seconds |
| Volume | `widget.setVolume(0–100)` |
| Current position | `widget.getPosition(callback)` — async |

Events via `SC.Widget.Events`: `PLAY`, `PAUSE`, `FINISH`, `SEEK`, `PLAY_PROGRESS`.

Note: SoundCloud's `seekTo` takes **milliseconds** while the `IEmbedPlayer` interface works in **seconds**. The `SoundCloudPlayer` adapter must convert at the boundary.

### 5.2 Submission Validation

Use the SoundCloud oEmbed endpoint to validate and fetch metadata at submission time:

```
GET https://soundcloud.com/oembed
    ?url={trackUrl}
    &format=json
```

This confirms the track exists and is embeddable. Cache `title`, `thumbnail_url`, and `duration` from the response. SoundCloud's oEmbed `duration` is in milliseconds — convert to seconds for `QueueEntry.duration`.

### 5.3 Compliance

SoundCloud's [API Terms of Use](https://developers.soundcloud.com/docs/api/terms-of-use) permit embedding tracks in third-party applications. Key constraints:

- Do not download or cache audio files.
- Do not remove or obscure SoundCloud branding from the embedded player.
- The embedded player must be functional and visible.

---

## 6. Advisory Notice: YouTube Premium

### 6.1 The Problem

Non-Premium YouTube users see ads in the embedded player. Ads are not synchronised to the fleet's playback state — one user may be watching a 15-second ad while others are listening. Users must alt-tab from EVE Online to their browser to skip skippable ads. There is no API mechanism to suppress or skip ads.

### 6.2 Detection

YouTube provides no API to detect whether a user has Premium. Fleetr cannot reliably determine this. The advisory is suppressed only by explicit user dismissal (see §6.3).

In practice: users with an ad blocker (e.g. uBlock Origin) will not see ads in the embedded player. Fleetr does not endorse, install, or recommend specific browser extensions, but the advisory copy acknowledges that an ad blocker also resolves the issue.

### 6.3 Advisory Behaviour

The advisory is surfaced as a `ScopePrompt`-style non-blocking notice in the `NowPlaying` component when:

1. The fleet's `mediaSource` is `YOUTUBE`, **and**
2. No `AdvisoryDismissal` row exists for `(characterId, "youtube-premium")`, **or** the row exists with `permanent = false` and `lastShownAt` is more than 24 hours ago.

The notice is **never** shown if `permanent = true`.

The notice offers two actions:

| Action | Effect |
|--------|--------|
| **I have Premium / I use an ad blocker** | Upsert `AdvisoryDismissal` with `permanent = true`. Never shown again. |
| **Dismiss** | Upsert `AdvisoryDismissal` with `permanent = false`, `lastShownAt = now()`. Shown again after 24 hours. |

The `AdvisoryDismissal` table is generic — the `key` field allows future advisories to follow the same pattern without schema changes.

### 6.4 Advisory Copy

```
YouTube Premium recommended

Without YouTube Premium, ads will appear in the player and won't be
synchronised with the fleet. You may need to alt-tab to skip them.

YouTube Premium or a browser ad blocker (e.g. uBlock Origin) will
prevent this.

[I have Premium / I use an ad blocker]   [Dismiss]
```

---

## 7. Mode Switch Interrupts

When the FC switches fleet mode (CRUISE ↔ BATTLE), all clients must immediately
abandon their current track and load the first entry from the new queue. This is a
mandatory interrupt — not a catch-up suggestion.

### 7.1 Normal case (no ad)

On receiving `fleet:mode-changed`:

1. Call `player.load(nowPlaying.mediaId)` immediately.
2. Update the mode indicator and volume multiplier.
3. If `nowPlaying` is `null` (new queue is empty), call `player.pause()` or
   stop the player and render the empty queue state for the new mode.

### 7.2 YouTube ad interrupt

The YouTube IFrame API does not permit stopping or skipping an ad. Calling
`player.load()` (i.e. `loadVideoById`) during an ad queues the new video —
it loads automatically when the ad ends. This is not a bug; it is the only
compliant behaviour available.

**Detecting the ad-blocked state:**

The IFrame API does not expose an explicit "ad is playing" event. Use a timeout
heuristic in the `YouTubePlayer` adapter:

```typescript
load(mediaId: string): void {
    this.pendingMediaId = mediaId;
    this.loadTimeout = setTimeout(() => {
        if (this.pendingMediaId === mediaId) {
            this.emit('load-blocked-by-ad', mediaId);
        }
    }, AD_LOAD_TIMEOUT_MS); // 3000ms
    this.player.loadVideoById(mediaId);
}

onStateChange(state: PlayerState): void {
    if (state === PlayerState.BUFFERING || state === PlayerState.PLAYING) {
        clearTimeout(this.loadTimeout);
        this.pendingMediaId = null;
    }
}
```

`AD_LOAD_TIMEOUT_MS = 3000` — if the player has not entered `BUFFERING` or
`PLAYING` within 3 seconds of `loadVideoById`, the client treats it as
ad-blocked and emits `load-blocked-by-ad`.

**Client UI response to `load-blocked-by-ad`:**

Show a prominent banner in `NowPlaying` (distinct from the standard advisory):

```
⚔ Battle mode active

Your track will start automatically after the current ad.
```

This banner is dismissed when the player transitions to `PLAYING` with the
new track, or when the mode switches back.

### 7.3 SoundCloud

SoundCloud's Widget API does not serve ads in the standard embed. `widget.load(url)`
interrupts immediately with no equivalent edge case. No special handling required.

### 7.4 Custom player (future)

The `<audio>` element supports `pause()` and `src` replacement immediately.
No special handling required.

---

## 8. Future: Custom Player (FC Uploads)

The `CUSTOM` value in the `MediaSource` enum is reserved. When implemented, the custom player will:

- Allow FCs to upload audio files (mp3, flac, ogg, wav) at fleet creation or via the Settings app.
- Store files in object storage (S3-compatible). `QueueEntry.mediaUrl` stores the object URL; `QueueEntry.mediaId` stores the object key.
- Use an HTML `<audio>` element for playback rather than an embedded iframe.
- Implement `IEmbedPlayer` via a `CustomAudioPlayer` adapter. The rest of the system (PartyKit sync, playback service, queue logic) requires no changes.

File size limits, supported codecs, and storage configuration are deferred to the implementation phase.
