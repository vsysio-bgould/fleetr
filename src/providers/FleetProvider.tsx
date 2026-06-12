'use client';

/**
 * FleetProvider — central state container for a fleet room.
 *
 * Responsibilities:
 *   1. Fetch initial fleet metadata, session, and queue over HTTP on mount.
 *   2. Open a PartyKit WebSocket connection and translate ServerMessages into
 *      FleetAction dispatches via fleetReducer.
 *   3. Expose FleetState via FleetStateContext and FleetActions via
 *      FleetActionsContext (separate to prevent action-only components from
 *      re-rendering on state changes).
 *
 * Usage:
 *   Wrap the fleet room layout in <FleetProvider fleetId={...}>.
 *   Consume state with useFleetState() and actions with useFleetActions().
 */

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
} from 'react';
import PartySocket from 'partysocket';

import type { ServerMessage } from '@/config/party-messages';
import type { FleetAction, FleetActions, FleetState } from '@/config/fleet-state';
import { fleetReducer, initialFleetState } from '@/lib/fleet-reducer';

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

const FleetStateContext = createContext<FleetState | null>(null);
const FleetActionsContext = createContext<FleetActions | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface FleetProviderProps {
    fleetId: string;
    children: React.ReactNode;
}

export function FleetProvider({ fleetId, children }: FleetProviderProps) {
    const [state, dispatch] = useReducer(fleetReducer, initialFleetState);
    const socketRef = useRef<PartySocket | null>(null);

    // -------------------------------------------------------------------------
    // Initial HTTP hydration
    // -------------------------------------------------------------------------
    useEffect(() => {
        async function hydrate() {
            // Fetch fleet metadata, current user session, playback reference,
            // and both queues in parallel.
            const [fleetRes, sessionRes, playbackRes, cruiseRes, battleRes] =
                await Promise.all([
                    fetch(`/api/v1/fleets/${fleetId}`),
                    fetch('/api/v1/users/me'),
                    fetch(`/api/v1/fleets/${fleetId}/playback`),
                    fetch(`/api/v1/fleets/${fleetId}/queue?queue=CRUISE`),
                    fetch(`/api/v1/fleets/${fleetId}/queue?queue=BATTLE`),
                ]);

            // TODO: handle fetch errors, redirect on 401/403
            const [fleet, session, playback, cruiseQueue, battleQueue] =
                await Promise.all([
                    fleetRes.json(),
                    sessionRes.json(),
                    playbackRes.json(),
                    cruiseRes.json(),
                    battleRes.json(),
                ]);

            dispatch({
                type: 'HYDRATE',
                state: {
                    ...initialFleetState,
                    fleet: {
                        fleetId,
                        name: fleet.name,
                        mediaSource: fleet.mediaSource,
                        fcCharacterId: fleet.fcCharacterId,
                    },
                    session: {
                        characterId: session.characterId,
                        characterName: session.characterName,
                        role: session.activeSessions.find(
                            (s: { fleetId: string; role: string }) => s.fleetId === fleetId,
                        )?.role ?? 'LINE_MEMBER',
                        grantedScopes: session.grantedScopes,
                    },
                    nowPlaying: playback,
                    mode: fleet.mode,
                    cruiseQueue,
                    battleQueue,
                },
            });
        }

        hydrate();
    }, [fleetId]);

    // -------------------------------------------------------------------------
    // PartyKit connection
    // -------------------------------------------------------------------------
    useEffect(() => {
        dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connecting' });

        const socket = new PartySocket({
            host: process.env.NEXT_PUBLIC_PARTYKIT_HOST!,
            room: `fleet-${fleetId}`,
            query: async () => {
                // Fetch a fresh API token from storage/cookie for the query param.
                // In browser context the httpOnly cookie is sent automatically
                // on the upgrade request; this query param path is for non-browser
                // clients or environments where the cookie is not available.
                return { token: getApiToken() };
            },
        });

        socket.addEventListener('open', () => {
            dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' });
        });

        socket.addEventListener('close', () => {
            dispatch({ type: 'SET_CONNECTION_STATUS', status: 'reconnecting' });
        });

        socket.addEventListener('message', (event: MessageEvent) => {
            const message: ServerMessage = JSON.parse(event.data as string);
            handleServerMessage(message, dispatch);
        });

        socketRef.current = socket;

        return () => {
            socket.close();
            socketRef.current = null;
        };
    }, [fleetId]);

    // -------------------------------------------------------------------------
    // Actions
    // -------------------------------------------------------------------------
    const actions: FleetActions = useMemo(() => ({
        setTrack: (queueEntryId) => {
            socketRef.current?.send(
                JSON.stringify({ type: 'fleet:set-track', queueEntryId }),
            );
        },
        advance: () => {
            socketRef.current?.send(JSON.stringify({ type: 'fleet:advance' }));
        },
        setVolume: (volume) => {
            socketRef.current?.send(
                JSON.stringify({ type: 'fleet:set-volume', volume }),
            );
        },
        setMode: (mode) => {
            socketRef.current?.send(
                JSON.stringify({ type: 'fleet:set-mode', mode }),
            );
        },
        submitEntry: async (mediaUrl, queue) => {
            await fetch(`/api/v1/fleets/${fleetId}/queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mediaUrl, queue }),
            });
            // State update arrives via queue:entry-added PartyKit broadcast
        },
        removeEntry: async (entryId) => {
            await fetch(`/api/v1/fleets/${fleetId}/queue/${entryId}`, {
                method: 'DELETE',
            });
        },
        vote: async (entryId) => {
            await fetch(`/api/v1/fleets/${fleetId}/queue/${entryId}/vote`, {
                method: 'POST',
            });
        },
        unvote: async (entryId) => {
            await fetch(`/api/v1/fleets/${fleetId}/queue/${entryId}/vote`, {
                method: 'DELETE',
            });
        },
        reorder: async (entryId, position) => {
            await fetch(`/api/v1/fleets/${fleetId}/queue/${entryId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position }),
            });
        },
        kickMember: async (characterId) => {
            await fetch(`/api/v1/fleets/${fleetId}/members/${characterId}`, {
                method: 'DELETE',
            });
        },
        grantDelegate: async (characterId) => {
            await fetch(`/api/v1/fleets/${fleetId}/delegates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ characterId }),
            });
        },
        revokeDelegate: async (characterId) => {
            await fetch(`/api/v1/fleets/${fleetId}/delegates/${characterId}`, {
                method: 'DELETE',
            });
        },
        clearPendingModeSwitch: () => {
            dispatch({ type: 'CLEAR_PENDING_MODE_SWITCH' });
        },
    }), [fleetId]);

    return (
        <FleetStateContext.Provider value={state}>
            <FleetActionsContext.Provider value={actions}>
                {children}
            </FleetActionsContext.Provider>
        </FleetStateContext.Provider>
    );
}

// ---------------------------------------------------------------------------
// Message → dispatch mapping
// ---------------------------------------------------------------------------

function handleServerMessage(message: ServerMessage, dispatch: React.Dispatch<FleetAction>) {
    switch (message.type) {
        case 'sync:state':
            dispatch({ type: 'SET_NOW_PLAYING', nowPlaying: message.payload.nowPlaying });
            dispatch({ type: 'SET_VOLUME', volume: message.payload.volume });
            dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' });
            dispatch({ type: 'MEMBER_COUNT_UPDATED', count: message.payload.memberCount });
            // mode is set during HYDRATE; sync:state confirms it
            break;

        case 'fleet:now-playing':
            dispatch({ type: 'SET_NOW_PLAYING', nowPlaying: message.payload });
            break;

        case 'fleet:mode-changed':
            // SET_MODE carries nowPlaying so the reducer can set pendingModeSwitch
            // if the NowPlaying component signals the player is ad-blocked.
            // The component calls clearPendingModeSwitch when the player loads.
            dispatch({ type: 'SET_MODE', mode: message.mode, nowPlaying: message.nowPlaying });
            break;

        case 'fleet:volume-changed':
            dispatch({ type: 'SET_VOLUME', volume: message.volume });
            break;

        case 'queue:entry-added':
            dispatch({ type: 'QUEUE_ENTRY_ADDED', entry: message.payload });
            break;

        case 'queue:entry-removed':
            dispatch({ type: 'QUEUE_ENTRY_REMOVED', entryId: message.queueEntryId, queue: message.queue });
            break;

        case 'queue:vote-updated':
            dispatch({ type: 'QUEUE_VOTE_UPDATED', entryId: message.queueEntryId, votes: message.votes, queue: message.queue });
            break;

        case 'queue:reordered':
            dispatch({ type: 'QUEUE_REORDERED', entryId: message.queueEntryId, position: message.position, queue: message.queue });
            break;

        case 'member:joined':
            dispatch({ type: 'MEMBER_JOINED', member: message.payload });
            break;

        case 'member:left':
            dispatch({ type: 'MEMBER_LEFT', characterId: message.characterId });
            break;

        case 'member:kicked':
            dispatch({ type: 'MEMBER_KICKED', characterId: message.characterId });
            break;

        case 'member:role-changed':
            dispatch({ type: 'MEMBER_ROLE_CHANGED', characterId: message.characterId, role: message.role });
            break;

        case 'member:location-updated':
            dispatch({ type: 'MEMBER_LOCATIONS_UPDATED', updates: message.updates });
            break;

        case 'error':
            console.error('[PartyKit]', message.code, message.message);
            break;
    }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useFleetState(): FleetState {
    const ctx = useContext(FleetStateContext);
    if (!ctx) throw new Error('useFleetState must be used within FleetProvider');
    return ctx;
}

export function useFleetActions(): FleetActions {
    const ctx = useContext(FleetActionsContext);
    if (!ctx) throw new Error('useFleetActions must be used within FleetProvider');
    return ctx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the API token from wherever the browser has stored it. */
function getApiToken(): string {
    // Tokens are returned in the OAuth callback body. The application layer
    // is responsible for storing and retrieving them (e.g. in-memory, or read
    // from a meta tag injected by the server during SSR).
    // Implementation deferred to the auth layer.
    return (window as Window & { __fleetrToken?: string }).__fleetrToken ?? '';
}
