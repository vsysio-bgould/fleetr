/**
 * FleetProvider state and action types.
 *
 * Two separate contexts are used:
 *   FleetStateContext  — read by components that render fleet state
 *   FleetActionsContext — read by components that dispatch commands
 *
 * This prevents action-only components (vote buttons, skip button) from
 * re-rendering when fleet state changes.
 *
 * Local player state (is MY player playing, paused, buffering) is NOT here.
 * It lives in the NowPlaying component. Keeping it local prevents player
 * status changes from re-rendering the entire fleet tree.
 */

import type { FleetMode, MediaSource, QueueType, SessionRole } from '@prisma/client';
import type { FleetNowPlaying, MemberSnapshot, QueueEntrySnapshot } from './party-messages.js';
import { hasFleetControl } from '../lib/roles.js';

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

export type ConnectionStatus =
    | 'connecting'    // initial socket open in progress
    | 'connected'     // socket open, sync:state received
    | 'reconnecting'  // socket closed unexpectedly, attempting reconnect
    | 'disconnected'; // socket closed, not reconnecting (fleet disbanded, kicked, etc.)

/** The current user's session. Populated at join time and never changes. */
export interface SessionInfo {
    characterId: number;
    characterName: string;
    role: SessionRole;
    grantedScopes: string[];
}

/** Fleet metadata fetched over HTTP at load time. Static for the session. */
export interface FleetMeta {
    fleetId: string;
    name: string;
    mediaSource: MediaSource;
    fcCharacterId: number;
}

// ---------------------------------------------------------------------------
// Fleet state
// ---------------------------------------------------------------------------

export interface FleetState {
    // --- Identity ---
    session: SessionInfo;
    fleet: FleetMeta;

    // --- Connection ---
    connectionStatus: ConnectionStatus;

    // --- Real-time fleet state (PartyKit) ---
    /** Current fleet mode. Changes trigger a mandatory player interrupt. */
    mode: FleetMode;
    /** FC-controlled fleet-wide volume (0–100). Applied to all local players. */
    volume: number;
    /** The track the fleet is currently on. Clients may seek to this via Catch Up. */
    nowPlaying: FleetNowPlaying | null;
    /** Live member count from PartyKit sync:state and member:joined/left messages. */
    memberCount: number;

    // --- Queue (HTTP load + incremental PartyKit updates) ---
    cruiseQueue: QueueEntrySnapshot[];
    battleQueue: QueueEntrySnapshot[];
    /** True while the initial HTTP queue fetch is in flight. */
    queueLoading: boolean;

    // --- FC-only member data ---
    /**
     * Full member list. Populated from GET /members on load (FC role only).
     * Empty array for line members — they see memberCount only.
     */
    members: MemberSnapshot[];
    /**
     * Solar system per character from location-sync worker broadcasts.
     * Keyed by characterId. null = scope not granted or ESI unavailable.
     * Empty object for non-FC clients (message is ignored client-side).
     */
    memberLocations: Record<number, string | null>;

    // --- Mode switch interrupt state ---
    /**
     * Non-null when fleet:mode-changed was received but the YouTube player
     * could not interrupt immediately (ad in progress). The NowPlaying component
     * watches this and shows the "Battle mode — loading after ad" banner.
     * Cleared by calling actions.clearPendingModeSwitch() once the player
     * transitions to PLAYING with the new track.
     */
    pendingModeSwitch: FleetNowPlaying | null;
}

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

/**
 * Returns the queue for the currently active mode.
 * Use this rather than reading cruiseQueue/battleQueue directly in most components.
 */
export function selectActiveQueue(state: FleetState): QueueEntrySnapshot[] {
    return state.mode === 'CRUISE' ? state.cruiseQueue : state.battleQueue;
}

/**
 * Returns true if the current user has FC-level access.
 * Delegates are included — they share the FC capability set.
 */
export function selectIsFc(state: FleetState): boolean {
    return hasFleetControl(state.session.role);
}

/**
 * Returns the effective volume after applying the battle mode multiplier.
 * Use this for the actual player.setVolume() call.
 *
 * The multiplier is a client-side constant. The fleet volume (0–100) is
 * FC-controlled; the multiplier is applied on top of it locally.
 */
export const BATTLE_VOLUME_MULTIPLIER = 0.25;

export function selectEffectiveVolume(state: FleetState): number {
    const multiplier = state.mode === 'BATTLE' ? BATTLE_VOLUME_MULTIPLIER : 1;
    return Math.round(state.volume * multiplier);
}

// ---------------------------------------------------------------------------
// Fleet actions
// ---------------------------------------------------------------------------

export interface FleetActions {
    // --- FC playback commands (sent via PartyKit) ---

    /** Set the fleet reference to a specific queue entry. FC only. */
    setTrack: (queueEntryId: string) => void;

    /** Skip the fleet reference to the next entry. FC only. */
    advance: () => void;

    /** Set fleet-wide volume (0–100). Synced to all clients. FC only. */
    setVolume: (volume: number) => void;

    /** Switch fleet mode. Triggers a mandatory interrupt on all clients. FC only. */
    setMode: (mode: FleetMode) => void;

    // --- Queue mutations (HTTP, then PartyKit broadcast updates local state) ---

    /** Submit a new entry. Validates, fetches metadata, appends to queue. */
    submitEntry: (mediaUrl: string, queue: QueueType) => Promise<void>;

    /** Soft-delete a queue entry. FC only. */
    removeEntry: (entryId: string) => Promise<void>;

    /** Cast an upvote on an entry. */
    vote: (entryId: string) => Promise<void>;

    /** Remove an upvote from an entry. */
    unvote: (entryId: string) => Promise<void>;

    /** Update an entry's position (FC manual reorder). FC only. */
    reorder: (entryId: string, position: number) => Promise<void>;

    // --- Member actions (HTTP, FC only) ---

    kickMember: (characterId: number) => Promise<void>;
    grantDelegate: (characterId: number) => Promise<void>;
    revokeDelegate: (characterId: number) => Promise<void>;

    // --- Mode switch interrupt ---

    /**
     * Called by NowPlaying when the player successfully loads the new track
     * after a mode switch. Clears the pendingModeSwitch banner.
     */
    clearPendingModeSwitch: () => void;
}

// ---------------------------------------------------------------------------
// Reducer action types
// ---------------------------------------------------------------------------

/**
 * All state transitions go through this union. The reducer is the single
 * place where PartyKit messages are translated into FleetState updates.
 * Components never mutate state directly.
 */
export type FleetAction =
    // Hydration from HTTP + initial sync:state
    | { type: 'HYDRATE'; state: FleetState }

    // Connection lifecycle
    | { type: 'SET_CONNECTION_STATUS'; status: ConnectionStatus }

    // Real-time fleet state
    | { type: 'SET_NOW_PLAYING'; nowPlaying: FleetNowPlaying | null }
    | { type: 'SET_MODE'; mode: FleetMode; nowPlaying: FleetNowPlaying | null }
    | { type: 'SET_VOLUME'; volume: number }

    // Queue
    | { type: 'SET_QUEUE_LOADING'; loading: boolean }
    | { type: 'SET_QUEUE'; queue: QueueType; entries: QueueEntrySnapshot[] }
    | { type: 'QUEUE_ENTRY_ADDED'; entry: QueueEntrySnapshot }
    | { type: 'QUEUE_ENTRY_REMOVED'; entryId: string; queue: QueueType }
    | { type: 'QUEUE_VOTE_UPDATED'; entryId: string; votes: number; queue: QueueType }
    | { type: 'QUEUE_REORDERED'; entryId: string; position: number; queue: QueueType }

    // Members
    | { type: 'MEMBER_JOINED'; member: MemberSnapshot }
    | { type: 'MEMBER_LEFT'; characterId: number }
    | { type: 'MEMBER_KICKED'; characterId: number }
    | { type: 'MEMBER_ROLE_CHANGED'; characterId: number; role: SessionRole }
    | { type: 'MEMBER_COUNT_UPDATED'; count: number }
    | { type: 'MEMBER_LOCATIONS_UPDATED'; updates: Array<{ characterId: number; solarSystem: string | null }> }

    // Mode switch interrupt
    | { type: 'SET_PENDING_MODE_SWITCH'; nowPlaying: FleetNowPlaying | null }
    | { type: 'CLEAR_PENDING_MODE_SWITCH' };
