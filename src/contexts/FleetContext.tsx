"use client";

import { createContext, useContext, useEffect, useReducer, useRef, useState } from "react";
import type { ConnectionStatus } from "@/components/ConnectionPill";
import type {
  ClientMessage,
  FleetNowPlaying,
  MemberSnapshot,
  QueueEntrySnapshot,
  ServerMessage,
} from "@/config/party-messages";
import type { FleetMode, MediaSource } from "@prisma/client";

export type { MemberSnapshot, FleetNowPlaying };

/** Queue entry as held client-side: the broadcast snapshot plus this client's vote flag. */
export type QueueEntry = QueueEntrySnapshot & { hasVoted: boolean };

interface FleetState {
  members: Record<number, MemberSnapshot>;
  queue: QueueEntry[];
  nowPlaying: FleetNowPlaying | null;
  mode: FleetMode;
  volume: number;
  locations: Record<number, string | null>; // characterId -> solarSystem name
}

/**
 * Reducer actions are the canonical ServerMessage union (src/config/party-messages.ts)
 * plus client-local actions. vote-updated is enriched with selfVote by the provider
 * before dispatch when the vote was cast by this client.
 */
type FleetAction =
  | (ServerMessage & { selfVote?: boolean })
  | { type: "local:queue-loaded"; entries: QueueEntry[] };

function reducer(state: FleetState, action: FleetAction): FleetState {
  switch (action.type) {
    case "sync:state": {
      const members: Record<number, MemberSnapshot> = {};
      for (const m of action.payload.members) members[m.characterId] = m;
      return {
        ...state,
        members,
        nowPlaying: action.payload.nowPlaying,
        mode: action.payload.mode,
        volume: action.payload.volume,
      };
    }

    case "fleet:now-playing":
      return { ...state, nowPlaying: action.payload };

    case "fleet:mode-changed":
      // Mandatory interrupt: the new reference track arrives with the mode.
      return { ...state, mode: action.mode, nowPlaying: action.nowPlaying };

    case "fleet:volume-changed":
      return { ...state, volume: action.volume };

    case "local:queue-loaded":
      return { ...state, queue: action.entries };

    case "queue:entry-added":
      return {
        ...state,
        queue: [...state.queue, { ...action.payload, hasVoted: false }],
      };

    case "queue:entry-removed":
      return {
        ...state,
        queue: state.queue.filter((e) => e.id !== action.queueEntryId),
      };

    case "queue:vote-updated":
      return {
        ...state,
        queue: state.queue.map((e) =>
          e.id === action.queueEntryId
            ? {
                ...e,
                votes: action.votes,
                ...(action.selfVote !== undefined ? { hasVoted: action.selfVote } : {}),
              }
            : e
        ),
      };

    case "queue:reordered":
      return {
        ...state,
        queue: state.queue.map((e) =>
          e.id === action.queueEntryId ? { ...e, position: action.position } : e
        ),
      };

    case "member:joined":
      return {
        ...state,
        members: { ...state.members, [action.payload.characterId]: action.payload },
      };

    case "member:left":
    case "member:kicked": {
      const members = { ...state.members };
      delete members[action.characterId];
      return { ...state, members };
    }

    case "member:role-changed": {
      const existing = state.members[action.characterId];
      if (!existing) return state;
      return {
        ...state,
        members: {
          ...state.members,
          [action.characterId]: { ...existing, role: action.role },
        },
      };
    }

    case "member:location-updated": {
      const locations = { ...state.locations };
      for (const u of action.updates) locations[u.characterId] = u.solarSystem;
      return { ...state, locations };
    }

    default:
      return state;
  }
}

const initialState: FleetState = {
  members: {},
  queue: [],
  nowPlaying: null,
  mode: "CRUISE",
  volume: 100,
  locations: {},
};

interface FleetContextValue {
  state: FleetState;
  connection: ConnectionStatus;
  fleetId: string;
  mediaSource: MediaSource;
  myCharacterId: number;
  myRole: MemberSnapshot["role"] | null;
  grantedScopes: string[];
  hasScope: (scope: string) => boolean;
  send: (msg: ClientMessage) => void;
  muted: boolean;
  toggleMute: () => void;
}

const FleetContext = createContext<FleetContextValue | null>(null);

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used inside FleetProvider");
  return ctx;
}

interface ProviderProps {
  children: React.ReactNode;
  fleetId: string;
  characterId: number;
  grantedScopes: string[];
  mediaSource: MediaSource;
  partyKitHost: string;
  partyKitToken: string;
}

const RECONNECT_DELAY_MS = 3000;

export function FleetProvider({
  children,
  fleetId,
  characterId,
  grantedScopes,
  mediaSource,
  partyKitHost,
  partyKitToken,
}: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [connection, setConnection] = useState<ConnectionStatus>("reconnecting");
  const [muted, setMuted] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  // Queue contents are not part of sync:state (party-messages contract) —
  // fetch over HTTP on load, then apply incremental queue:* messages.
  useEffect(() => {
    let cancelled = false;

    async function loadQueues() {
      try {
        const [cruise, battle] = await Promise.all([
          fetch(`/api/v1/fleets/${fleetId}/queue?queue=CRUISE`).then((r) => r.json()),
          fetch(`/api/v1/fleets/${fleetId}/queue?queue=BATTLE`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        const entries = [...cruise, ...battle].map(
          (e: QueueEntrySnapshot & { hasVoted?: boolean }) => ({
            ...e,
            hasVoted: e.hasVoted ?? false,
          })
        );
        dispatch({ type: "local:queue-loaded", entries });
      } catch {
        // Queue stays empty; incremental messages will still apply.
      }
    }

    void loadQueues();
    return () => {
      cancelled = true;
    };
  }, [fleetId]);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;
      const url = `wss://${partyKitHost}/parties/fleet/fleet-${fleetId}?token=${partyKitToken}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmountedRef.current) setConnection("connected");
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as ServerMessage;

          if (msg.type === "member:kicked" && msg.characterId === characterId) {
            window.location.href = "/kicked";
            return;
          }

          if (msg.type === "queue:vote-updated" && msg.voterId === characterId) {
            dispatch({ ...msg, selfVote: msg.voted });
            return;
          }

          dispatch(msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        setConnection("reconnecting");
        reconnectRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [fleetId, characterId, partyKitHost, partyKitToken]);

  const myRole = state.members[characterId]?.role ?? null;

  function send(msg: ClientMessage) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  function toggleMute() {
    setMuted((m) => !m);
  }

  function hasScope(scope: string): boolean {
    return grantedScopes.includes(scope);
  }

  return (
    <FleetContext.Provider
      value={{
        state,
        connection,
        fleetId,
        mediaSource,
        myCharacterId: characterId,
        myRole,
        grantedScopes,
        hasScope,
        send,
        muted,
        toggleMute,
      }}
    >
      {children}
    </FleetContext.Provider>
  );
}
