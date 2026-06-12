import type { FleetAction, FleetState } from '@/config/fleet-state';
import type { QueueEntrySnapshot } from '@/config/party-messages';

export const initialFleetState: FleetState = {
    session: {
        characterId: 0,
        characterName: '',
        role: 'LINE_MEMBER',
        grantedScopes: [],
    },
    fleet: {
        fleetId: '',
        name: '',
        mediaSource: 'YOUTUBE',
        fcCharacterId: 0,
    },
    connectionStatus: 'connecting',
    mode: 'CRUISE',
    volume: 100,
    nowPlaying: null,
    memberCount: 0,
    cruiseQueue: [],
    battleQueue: [],
    queueLoading: true,
    members: [],
    memberLocations: {},
    pendingModeSwitch: null,
};

export function fleetReducer(state: FleetState, action: FleetAction): FleetState {
    switch (action.type) {
        case 'HYDRATE':
            return { ...state, ...action.state, queueLoading: false };

        case 'SET_CONNECTION_STATUS':
            return { ...state, connectionStatus: action.status };

        case 'SET_NOW_PLAYING':
            return { ...state, nowPlaying: action.nowPlaying };

        case 'SET_MODE':
            // pendingModeSwitch is set optimistically here. The NowPlaying component
            // clears it via CLEAR_PENDING_MODE_SWITCH once the player confirms the
            // new track has loaded (i.e. the ad-blocked case resolved).
            return {
                ...state,
                mode: action.mode,
                nowPlaying: action.nowPlaying,
                pendingModeSwitch: action.nowPlaying,
            };

        case 'SET_VOLUME':
            return { ...state, volume: action.volume };

        case 'SET_QUEUE_LOADING':
            return { ...state, queueLoading: action.loading };

        case 'SET_QUEUE':
            return action.queue === 'CRUISE'
                ? { ...state, cruiseQueue: action.entries, queueLoading: false }
                : { ...state, battleQueue: action.entries, queueLoading: false };

        case 'QUEUE_ENTRY_ADDED':
            return addQueueEntry(state, action.entry);

        case 'QUEUE_ENTRY_REMOVED':
            return removeQueueEntry(state, action.entryId, action.queue);

        case 'QUEUE_VOTE_UPDATED':
            return updateQueueEntryVotes(state, action.entryId, action.votes, action.queue);

        case 'QUEUE_REORDERED':
            return reorderQueueEntry(state, action.entryId, action.position, action.queue);

        case 'MEMBER_JOINED':
            return {
                ...state,
                memberCount: state.memberCount + 1,
                members: state.members.some(m => m.characterId === action.member.characterId)
                    ? state.members
                    : [...state.members, action.member],
            };

        case 'MEMBER_LEFT':
            return {
                ...state,
                memberCount: Math.max(0, state.memberCount - 1),
                members: state.members.filter(m => m.characterId !== action.characterId),
            };

        case 'MEMBER_KICKED':
            // If the kicked member is the current user, the component watching
            // member:kicked will handle the redirect. State update is the same.
            return {
                ...state,
                memberCount: Math.max(0, state.memberCount - 1),
                members: state.members.filter(m => m.characterId !== action.characterId),
            };

        case 'MEMBER_ROLE_CHANGED':
            return {
                ...state,
                members: state.members.map(m =>
                    m.characterId === action.characterId ? { ...m, role: action.role } : m,
                ),
            };

        case 'MEMBER_COUNT_UPDATED':
            return { ...state, memberCount: action.count };

        case 'MEMBER_LOCATIONS_UPDATED': {
            const updated = { ...state.memberLocations };
            for (const { characterId, solarSystem } of action.updates) {
                updated[characterId] = solarSystem;
            }
            return { ...state, memberLocations: updated };
        }

        case 'SET_PENDING_MODE_SWITCH':
            return { ...state, pendingModeSwitch: action.nowPlaying };

        case 'CLEAR_PENDING_MODE_SWITCH':
            return { ...state, pendingModeSwitch: null };

        default:
            return state;
    }
}

// ---------------------------------------------------------------------------
// Queue mutation helpers
// ---------------------------------------------------------------------------

function queueKey(queue: 'CRUISE' | 'BATTLE'): 'cruiseQueue' | 'battleQueue' {
    return queue === 'CRUISE' ? 'cruiseQueue' : 'battleQueue';
}

function sortQueue(entries: QueueEntrySnapshot[]): QueueEntrySnapshot[] {
    return [...entries].sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes; // votes desc
        return a.position - b.position;                    // position asc
    });
}

function addQueueEntry(state: FleetState, entry: QueueEntrySnapshot): FleetState {
    const key = queueKey(entry.queue);
    return { ...state, [key]: sortQueue([...state[key], entry]) };
}

function removeQueueEntry(
    state: FleetState,
    entryId: string,
    queue: 'CRUISE' | 'BATTLE',
): FleetState {
    const key = queueKey(queue);
    return { ...state, [key]: state[key].filter(e => e.id !== entryId) };
}

function updateQueueEntryVotes(
    state: FleetState,
    entryId: string,
    votes: number,
    queue: 'CRUISE' | 'BATTLE',
): FleetState {
    const key = queueKey(queue);
    const updated = state[key].map(e => e.id === entryId ? { ...e, votes } : e);
    return { ...state, [key]: sortQueue(updated) };
}

function reorderQueueEntry(
    state: FleetState,
    entryId: string,
    position: number,
    queue: 'CRUISE' | 'BATTLE',
): FleetState {
    const key = queueKey(queue);
    const updated = state[key].map(e => e.id === entryId ? { ...e, position } : e);
    return { ...state, [key]: sortQueue(updated) };
}
