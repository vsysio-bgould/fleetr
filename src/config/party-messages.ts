/**
 * PartyKit message contract for Fleetr.
 *
 * ## Playback model
 * Each client plays the queue independently at their own pace. Individual
 * play/pause/seek state is local React state and is never synced via PartyKit.
 *
 * PartyKit manages only the fleet reference track: which queue entry the fleet
 * is currently on and when it started. Any client can compute the fleet's
 * approximate current position as:
 *
 *   fleetOffsetSeconds = (Date.now() - Date.parse(nowPlaying.startedAt)) / 1000
 *
 * This powers the "Catch Up" feature — a client that fell behind due to ads or
 * buffering can seek to the fleet's current position on demand.
 *
 * ## Auth on connect
 * Clients pass their API bearer token as a ?token= query param on the PartyKit
 * WebSocket URL. The PartyKit server validates it via DB lookup in onConnect and
 * stores the resolved claims in connection.state (ConnectionState). Token exposure
 * in server logs is acceptable — this is a routing mechanism, not a security gate.
 *
 * ## Queue data
 * Queue contents are not included in sync:state. Clients fetch the queue via
 * GET /api/v1/fleets/:id/queue over HTTP on load, then apply incremental
 * queue:* messages to keep their local state current.
 */

import type { FleetMode, QueueType, SessionRole } from '@prisma/client';

// ---------------------------------------------------------------------------
// Connection state (stored per-connection after auth)
// ---------------------------------------------------------------------------

export interface ConnectionState {
    characterId: number;
    characterName: string;
    role: SessionRole;
    fleetId: string;
}

// ---------------------------------------------------------------------------
// Shared payload types
// ---------------------------------------------------------------------------

/**
 * The fleet reference track. Represents what the fleet is currently listening to.
 * This is NOT a synchronized player position — it is a reference point that
 * clients may optionally catch up to.
 *
 * The fleet reference auto-advances when startedAt + duration elapses
 * (handled by the queue-advance BullMQ worker). The FC can skip early via
 * fleet:advance.
 */
export interface FleetNowPlaying {
    queueEntryId: string;
    mediaId: string;         // platform-specific ID for embed construction
    title: string;
    thumbnailUrl: string | null;
    duration: number | null; // seconds; null if platform did not return it
    startedAt: string;       // ISO 8601 — fleet position = (now - startedAt).seconds
}

export interface SyncState {
    nowPlaying: FleetNowPlaying | null; // null = no track set yet
    mode: FleetMode;
    volume: number;      // 0–100; FC-controlled fleet-wide volume
    battleVolumePercent: number;
    downvoteDeletePercent: number;
    memberCount: number;
    /** Currently connected members, built from the room's connection states. */
    members: MemberSnapshot[];
    // Queue is NOT included — fetch via GET /api/v1/fleets/:id/queue
}

/** Minimal queue entry shape for real-time queue update messages. */
export interface QueueEntrySnapshot {
    id: string;
    queue: QueueType;
    mediaId: string;
    title: string;
    thumbnailUrl: string | null;
    duration: number | null; // seconds
    submittedBy: number;     // characterId
    position: number;
    votes: number;
    downvotes: number;
    removedAt: string | null;
}

export interface MemberSnapshot {
    characterId: number;
    characterName: string;
    role: SessionRole;
}

// ---------------------------------------------------------------------------
// Client → Server messages
// ---------------------------------------------------------------------------

/**
 * Commands sent by clients to the PartyKit server.
 * All commands below are FC-only. Role is checked in onMessage against
 * connection.state.role; unauthorised commands receive an error ServerMessage.
 *
 * Individual playback controls (play/pause/seek) are local client state
 * and are never sent to PartyKit.
 */
export type ClientMessage =
    /**
     * FC sets the fleet reference to a specific queue entry.
     * Cancels any pending auto-advance job and schedules a new one
     * for startedAt + entry.duration.
     */
    | { type: 'fleet:set-track'; queueEntryId: string }

    /**
     * FC skips the fleet reference to the next entry in the queue.
     * Equivalent to fleet:set-track with the next entry's ID.
     * Cancels the current auto-advance job.
     */
    | { type: 'fleet:advance' }

    /**
     * FC sets fleet-wide volume (0–100). Synced to all connected clients.
     * Each client applies this to their local player immediately.
     * Personal mute is client-side only and is not affected.
     */
    | { type: 'fleet:set-volume'; volume: number }

    /** FC switches between CRUISE and BATTLE mode. */
    | { type: 'fleet:set-mode'; mode: FleetMode };

// ---------------------------------------------------------------------------
// Server → Client messages
// ---------------------------------------------------------------------------

export type ServerMessage =
    /**
     * Sent immediately after a client successfully connects.
     * The client should initialise all real-time state from this message,
     * then fetch queue data via HTTP.
     */
    | { type: 'sync:state'; payload: SyncState }

    /**
     * The fleet reference track changed. Emitted when:
     *   - FC calls fleet:set-track or fleet:advance
     *   - The auto-advance worker advances after track duration elapses
     *   - The queue runs out (payload is null)
     * Clients display this in the NowPlaying component and may seek to
     * fleetOffsetSeconds if the user clicks "Catch Up".
     */
    | { type: 'fleet:now-playing'; payload: FleetNowPlaying | null }

    /**
     * Fleet mode changed. This is always a mandatory interrupt:
     *   - Clients must immediately call player.load(nowPlaying.mediaId) to jump
     *     to the first track of the new queue, regardless of what is currently playing.
     *   - If the client's YouTube player is mid-ad, loadVideoById() will be queued
     *     by the browser and execute automatically when the ad ends. The client
     *     should display a "Battle mode — loading after ad" indicator while waiting
     *     (see docs/MEDIA-PLAYERS.md §8 for the detection heuristic).
     *   - nowPlaying is null if the target queue has no entries. Clients should
     *     stop their player and show the empty queue state for the new mode.
     *
     * The queue-advance worker cancels any pending job for the old queue and
     * schedules a new one for the new track's duration when this is emitted.
     */
    | { type: 'fleet:mode-changed'; mode: FleetMode; nowPlaying: FleetNowPlaying | null }

    /**
     * FC changed the fleet volume. Clients apply immediately to their local player.
     * Battle mode volume multiplier (default 0.25) is applied on top of this value.
     */
    | { type: 'fleet:volume-changed'; volume: number }

    /** Fleet settings changed. Clients apply immediately to controls/player. */
    | { type: 'fleet:settings-changed'; battleVolumePercent: number; downvoteDeletePercent: number }

    // --- Queue (triggered by HTTP mutations via POST /internal/fleets/:id/broadcast) ---

    /** A new entry was submitted to the queue. */
    | { type: 'queue:entry-added'; payload: QueueEntrySnapshot }

    /** An entry was soft-deleted by an FC. Clients remove it from their local list. */
    | { type: 'queue:entry-removed'; queueEntryId: string; queue: QueueType }

    /**
     * A vote was cast or removed. Clients update the vote count in their local
     * list. voterId/voted let the voter's own client flip its hasVoted flag.
     */
    | { type: 'queue:vote-updated'; queueEntryId: string; votes: number; queue: QueueType; voterId: number; voted: boolean }

    /**
     * A downvote was cast or removed. Clients update the downvote count in their
     * local list. voterId/downvoted let the voter's own client flip its flag.
     */
    | { type: 'queue:downvote-updated'; queueEntryId: string; downvotes: number; queue: QueueType; voterId: number; downvoted: boolean }

    /** An FC reordered an entry. Clients re-sort their local list. */
    | { type: 'queue:reordered'; queueEntryId: string; position: number; queue: QueueType }

    // --- Members ---

    /** A member joined the fleet room. */
    | { type: 'member:joined'; payload: MemberSnapshot }

    /** A member left voluntarily. */
    | { type: 'member:left'; characterId: number }

    /**
     * A member was kicked by an FC.
     * The affected client should check characterId against its own and redirect.
     */
    | { type: 'member:kicked'; characterId: number }

    /**
     * A delegate was granted or revoked.
     * The affected client should refetch its session role on next request.
     */
    | { type: 'member:role-changed'; characterId: number; role: SessionRole }

    /**
     * Broadcast by the location-sync worker every 30 seconds.
     * Contains current solar system for all members who granted
     * esi-location.read_location.v1. Only meaningful to FC clients
     * rendering the member roster. null = location unavailable.
     */
    | { type: 'member:location-updated'; updates: Array<{ characterId: number; solarSystem: string | null }> }

    // --- Errors ---

    /**
     * Sent to a specific connection when it sends an unauthorised or
     * malformed ClientMessage. Not broadcast to the room.
     */
    | { type: 'error'; code: string; message: string };

// ---------------------------------------------------------------------------
// Fleet reference state machine
// ---------------------------------------------------------------------------

/**
 * The fleet reference track (FleetNowPlaying | null) transitions as follows:
 *
 *   null      → FleetNowPlaying   FC calls fleet:set-track with first entry
 *   NowPlaying → NowPlaying       FC calls fleet:advance, OR auto-advance fires
 *   NowPlaying → null             Auto-advance fires but queue has no next entry
 *
 * Auto-advance is driven by a BullMQ worker (queue-advance.worker.ts) scheduled
 * at startedAt + duration when the reference is set. If the FC advances manually,
 * the pending job is cancelled and a new one is scheduled for the new track.
 *
 * Individual client playback state machine (local only, never synced):
 *   IDLE → PLAYING    Client starts the player (auto-start on load, or manual)
 *   PLAYING → PAUSED  Client pauses locally
 *   PAUSED → PLAYING  Client resumes locally
 *   any → CATCH_UP    User clicks "Catch Up" — client seeks to fleetOffsetSeconds
 *
 * Volume:
 *   fleetVolume is set by the FC and synced to all clients via fleet:volume-changed.
 *   Battle mode applies a local multiplier (default 0.25) on top of fleetVolume:
 *     effectiveVolume = fleetVolume * (mode === 'BATTLE' ? BATTLE_VOLUME_MULTIPLIER : 1)
 *   Personal mute is client-side only and never synced.
 */
