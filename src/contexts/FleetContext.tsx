"use client";

import { createContext, useContext, useEffect, useReducer, useRef, useState } from "react";
import type { ConnectionStatus } from "@/components/ConnectionPill";

export interface MemberSnapshot {
  characterId: number;
  characterName: string;
  role: "FLEET_COMMANDER" | "FC_DELEGATE" | "LINE_MEMBER";
  solarSystem: string | null;
}

export interface QueueEntry {
  id: string;
  url: string;
  title: string;
  queue: "CRUISE" | "BATTLE";
  thumbnailUrl: string | null;
  submittedBy: number;
  position: number;
  votes: number;
  hasVoted: boolean;
}

export interface PlaybackState {
  currentEntryId: string | null;
  currentMediaId: string | null;
  currentTitle: string | null;
  startedAt: string | null;
  mode: "CRUISE" | "BATTLE";
  volume: number;
  source: "YOUTUBE" | "SOUNDCLOUD";
}

interface FleetState {
  members: Record<number, MemberSnapshot>;
  queue: QueueEntry[];
  playback: PlaybackState;
  locations: Record<number, string | null>; // characterId -> solarSystem name
}

type FleetAction =
  | { type: "snapshot"; payload: { members: MemberSnapshot[]; queue: QueueEntry[]; playback: PlaybackState } }
  | { type: "member:joined"; payload: MemberSnapshot }
  | { type: "member:left"; payload: { characterId: number } }
  | { type: "member:kicked"; payload: { characterId: number } }
  | { type: "member:role-changed"; payload: { characterId: number; role: MemberSnapshot["role"] } }
  | { type: "member:location-updated"; payload: { locations: Record<number, string | null> } }
  | { type: "queue:entry-added"; payload: QueueEntry }
  | { type: "queue:entry-removed"; payload: { entryId: string } }
  | { type: "queue:vote-updated"; payload: { entryId: string; votes: number; voterId?: number } }
  | { type: "fleet:now-playing"; payload: { queueEntryId: string; mediaId: string; title: string; startedAt: string } | null }
  | { type: "fleet:mode-changed"; payload: { mode: "CRUISE" | "BATTLE" } }
  | { type: "fleet:volume-changed"; payload: { volume: number } };

function reducer(state: FleetState, action: FleetAction): FleetState {
  switch (action.type) {
    case "snapshot": {
      const members: Record<number, MemberSnapshot> = {};
      for (const m of action.payload.members) members[m.characterId] = m;
      return { ...state, members, queue: action.payload.queue, playback: action.payload.playback };
    }
    case "member:joined":
      return { ...state, members: { ...state.members, [action.payload.characterId]: action.payload } };
    case "member:left":
    case "member:kicked": {
      const members = { ...state.members };
      delete members[action.payload.characterId];
      return { ...state, members };
    }
    case "member:role-changed":
      return {
        ...state,
        members: {
          ...state.members,
          [action.payload.characterId]: {
            ...state.members[action.payload.characterId],
            role: action.payload.role,
          },
        },
      };
    case "member:location-updated":
      return { ...state, locations: { ...state.locations, ...action.payload.locations } };
    case "queue:entry-added":
      return { ...state, queue: [...state.queue, action.payload] };
    case "queue:entry-removed":
      return { ...state, queue: state.queue.filter((e) => e.id !== action.payload.entryId) };
    case "queue:vote-updated":
      return {
        ...state,
        queue: state.queue.map((e) =>
          e.id === action.payload.entryId
            ? { ...e, votes: action.payload.votes }
            : e
        ),
      };
    case "fleet:now-playing": {
      const np = action.payload;
      return {
        ...state,
        playback: {
          ...state.playback,
          currentEntryId: np?.queueEntryId ?? null,
          currentMediaId: np?.mediaId ?? null,
          currentTitle: np?.title ?? null,
          startedAt: np?.startedAt ?? null,
        },
      };
    }
    case "fleet:mode-changed":
      return { ...state, playback: { ...state.playback, mode: action.payload.mode } };
    case "fleet:volume-changed":
      return { ...state, playback: { ...state.playback, volume: action.payload.volume } };
    default:
      return state;
  }
}


const initialState: FleetState = {
  members: {},
  queue: [],
  playback: { currentEntryId: null, currentMediaId: null, currentTitle: null, startedAt: null, mode: "CRUISE", volume: 80, source: "YOUTUBE" },
  locations: {},
};

interface FleetContextValue {
  state: FleetState;
  connection: ConnectionStatus;
  fleetId: string;
  myCharacterId: number;
  myRole: MemberSnapshot["role"] | null;
  send: (msg: Record<string, unknown>) => void;
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
  partyKitHost: string;
  partyKitToken: string;
}

const RECONNECT_DELAY_MS = 3000;

export function FleetProvider({ children, fleetId, characterId, partyKitHost, partyKitToken }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [connection, setConnection] = useState<ConnectionStatus>("reconnecting");
  const [muted, setMuted] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;
      const url = `wss://${partyKitHost}/parties/fleet/${fleetId}?token=${partyKitToken}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmountedRef.current) setConnection("connected");
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
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
  }, [fleetId, partyKitHost, partyKitToken]);

  const myRole = state.members[characterId]?.role ?? null;

  function send(msg: Record<string, unknown>) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  function toggleMute() {
    setMuted((m) => !m);
  }

  return (
    <FleetContext.Provider value={{ state, connection, fleetId, myCharacterId: characterId, myRole, send, muted, toggleMute }}>
      {children}
    </FleetContext.Provider>
  );
}
