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

/** Queue entry as held client-side: the broadcast snapshot plus this client's vote flags. */
export type QueueEntry = QueueEntrySnapshot & { hasVoted: boolean; hasDownvoted: boolean };

export interface FleetEvent {
  id: string;
  at: string;
  title: string;
  detail?: string;
  tone?: "info" | "success" | "warning" | "danger";
}

interface FleetState {
  members: Record<number, MemberSnapshot>;
  queue: QueueEntry[];
  nowPlaying: FleetNowPlaying | null;
  mode: FleetMode;
  volume: number;
  battleVolumePercent: number;
  downvoteDeletePercent: number;
  locations: Record<number, string | null>; // characterId -> solarSystem name
  events: FleetEvent[];
}

/**
 * Reducer actions are the canonical ServerMessage union (src/config/party-messages.ts)
 * plus client-local actions. vote-updated is enriched with selfVote by the provider
 * before dispatch when the vote was cast by this client.
 */
type FleetAction =
  | (ServerMessage & { selfVote?: boolean; selfDownvote?: boolean })
  | { type: "local:queue-loaded"; entries: QueueEntry[] }
  | { type: "local:playback-loaded"; nowPlaying: FleetNowPlaying | null }
  | { type: "local:settings-loaded"; battleVolumePercent: number; downvoteDeletePercent: number };

function reducer(state: FleetState, action: FleetAction): FleetState {
  switch (action.type) {
    case "sync:state": {
      const members: Record<number, MemberSnapshot> = {};
      for (const m of action.payload.members) members[m.characterId] = m;
      return withEvent({
        ...state,
        members,
        nowPlaying: action.payload.nowPlaying ?? state.nowPlaying,
        mode: action.payload.mode,
        volume: action.payload.volume,
        battleVolumePercent: action.payload.battleVolumePercent,
        downvoteDeletePercent: action.payload.downvoteDeletePercent,
      }, event("Connected", `${action.payload.memberCount} member${action.payload.memberCount === 1 ? "" : "s"} online`, "success"));
    }

    case "fleet:now-playing":
      return withEvent(
        { ...state, nowPlaying: action.payload },
        action.payload
          ? event("Now playing", action.payload.title, "info")
          : event("Playback stopped", "Queue exhausted", "warning")
      );

    case "fleet:mode-changed":
      // Mandatory interrupt: the new reference track arrives with the mode.
      return withEvent(
        { ...state, mode: action.mode, nowPlaying: action.nowPlaying },
        event("Mode switched", `MODE: ${action.mode}`, "warning")
      );

    case "fleet:volume-changed":
      return withEvent(
        { ...state, volume: action.volume },
        event("Volume changed", `${action.volume}%`, "info")
      );

    case "fleet:settings-changed":
      return withEvent({
        ...state,
        battleVolumePercent: action.battleVolumePercent,
        downvoteDeletePercent: action.downvoteDeletePercent,
      }, event("Settings updated", `Battle volume ${action.battleVolumePercent}%, downvote delete ${action.downvoteDeletePercent}%`, "info"));

    case "local:queue-loaded":
      return {
        ...state,
        queue: mergeQueueEntries(state.queue, action.entries),
      };

    case "local:playback-loaded":
      return { ...state, nowPlaying: action.nowPlaying };

    case "local:settings-loaded":
      return {
        ...state,
        battleVolumePercent: action.battleVolumePercent,
        downvoteDeletePercent: action.downvoteDeletePercent,
      };

    case "queue:entry-added":
      return withEvent({
        ...state,
        queue: mergeQueueEntries(state.queue, [{ ...action.payload, hasVoted: false, hasDownvoted: false }]),
      }, event("Track added", action.payload.title, "success"));

    case "queue:entry-removed": {
      const removedEntry = state.queue.find((e) => e.id === action.queueEntryId);
      return withEvent({
        ...state,
        queue: state.queue.map((e) =>
          e.id === action.queueEntryId ? { ...e, removedAt: new Date().toISOString() } : e
        ),
      }, event(
        action.reason === "DOWNVOTE" ? "Track vote-deleted" : "Track deleted",
        removedEntry?.title ?? action.queueEntryId,
        action.reason === "DOWNVOTE" ? "danger" : "warning"
      ));
    }

    case "queue:vote-updated":
      return withEvent({
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
      }, event("Vote updated", `${action.votes} upvote${action.votes === 1 ? "" : "s"}`, "info"));

    case "queue:downvote-updated":
      return withEvent({
        ...state,
        queue: state.queue.map((e) =>
          e.id === action.queueEntryId
            ? {
                ...e,
                downvotes: action.downvotes,
                ...(action.selfDownvote !== undefined
                  ? { hasDownvoted: action.selfDownvote }
                  : {}),
              }
            : e
        ),
      }, event("Downvote updated", `${action.downvotes} downvote${action.downvotes === 1 ? "" : "s"}`, "warning"));

    case "queue:reordered":
      return withEvent({
        ...state,
        queue: state.queue.map((e) =>
          e.id === action.queueEntryId ? { ...e, position: action.position } : e
        ),
      }, event("Queue reordered", `Position ${action.position}`, "info"));

    case "member:joined":
      return withEvent({
        ...state,
        members: { ...state.members, [action.payload.characterId]: action.payload },
      }, event("Member joined", action.payload.characterName, "success"));

    case "member:left":
    case "member:kicked": {
      const leavingMember = state.members[action.characterId];
      const members = { ...state.members };
      delete members[action.characterId];
      return withEvent(
        { ...state, members },
        event(action.type === "member:kicked" ? "Member kicked" : "Member left", leavingMember?.characterName ?? `Character ${action.characterId}`, action.type === "member:kicked" ? "danger" : "info")
      );
    }

    case "member:role-changed": {
      const existing = state.members[action.characterId];
      if (!existing) return state;
      return withEvent({
        ...state,
        members: {
          ...state.members,
          [action.characterId]: { ...existing, role: action.role },
        },
      }, event("Role changed", `${existing.characterName}: ${action.role}`, "info"));
    }

    case "member:location-updated": {
      const locations = { ...state.locations };
      for (const u of action.updates) locations[u.characterId] = u.solarSystem;
      return { ...state, locations };
    }

    case "error":
      return withEvent(state, event("Fleet error", action.message, "danger"));

    default:
      return state;
  }
}

function mergeQueueEntries(current: QueueEntry[], incoming: QueueEntry[]): QueueEntry[] {
  const byId = new Map<string, QueueEntry>();
  for (const entry of current) byId.set(entry.id, entry);
  for (const entry of incoming) {
    byId.set(entry.id, {
      ...byId.get(entry.id),
      ...entry,
      hasVoted: entry.hasVoted ?? byId.get(entry.id)?.hasVoted ?? false,
      hasDownvoted: entry.hasDownvoted ?? byId.get(entry.id)?.hasDownvoted ?? false,
    });
  }
  return Array.from(byId.values());
}

const MAX_EVENTS = 80;

function event(
  title: string,
  detail?: string,
  tone: FleetEvent["tone"] = "info"
): FleetEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: new Date().toISOString(),
    title,
    detail,
    tone,
  };
}

function withEvent(state: FleetState, nextEvent: FleetEvent): FleetState {
  return {
    ...state,
    events: [nextEvent, ...state.events].slice(0, MAX_EVENTS),
  };
}

const initialState: FleetState = {
  members: {},
  queue: [],
  nowPlaying: null,
  mode: "CRUISE",
  volume: 100,
  battleVolumePercent: 25,
  downvoteDeletePercent: 50,
  locations: {},
  events: [],
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
  localVolume: number;
  setLocalVolume: (volume: number) => void;
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
  battleVolumePercent: number;
  downvoteDeletePercent: number;
  partyKitHost: string;
  partyKitToken: string;
}

const RECONNECT_DELAY_MS = 3000;
const LOCAL_VOLUME_STORAGE_KEY = "fleetr:local-volume";

function buildPartyKitUrl(host: string, fleetId: string, token: string): string {
  const protocolMatch = host.match(/^wss?:\/\//);
  const base = protocolMatch
    ? host
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${host}`;
  const url = new URL(`/parties/main/fleet-${fleetId}`, base);
  url.searchParams.set("token", token);
  return url.toString();
}

export function FleetProvider({
  children,
  fleetId,
  characterId,
  grantedScopes,
  mediaSource,
  battleVolumePercent,
  downvoteDeletePercent,
  partyKitHost,
  partyKitToken,
}: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [connection, setConnection] = useState<ConnectionStatus>("reconnecting");
  const [muted, setMuted] = useState(false);
  const [localVolume, setLocalVolumeState] = useState(100);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    dispatch({
      type: "local:settings-loaded",
      battleVolumePercent,
      downvoteDeletePercent,
    });
  }, [battleVolumePercent, downvoteDeletePercent]);

  useEffect(() => {
    const saved = window.localStorage.getItem(LOCAL_VOLUME_STORAGE_KEY);
    if (saved === null) return;
    const parsed = Number(saved);
    if (Number.isFinite(parsed)) setLocalVolumeState(clampVolume(parsed));
  }, []);

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
        const entries = [...(cruise.data ?? []), ...(battle.data ?? [])].map(
          (e: QueueEntrySnapshot & { hasVoted?: boolean; hasDownvoted?: boolean }) => ({
            ...e,
            hasVoted: e.hasVoted ?? false,
            hasDownvoted: e.hasDownvoted ?? false,
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
    let cancelled = false;

    async function loadPlayback() {
      try {
        const res = await fetch(`/api/v1/fleets/${fleetId}/playback`);
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        const playback = body.data;
        dispatch({
          type: "local:playback-loaded",
          nowPlaying: playback?.queueEntryId
            ? {
                queueEntryId: playback.queueEntryId,
                mediaId: playback.mediaId,
                title: playback.title,
                thumbnailUrl: playback.thumbnailUrl,
                duration: playback.duration,
                startedAt: playback.startedAt,
              }
            : null,
        });
      } catch {
        // PartyKit sync or the next playback event will populate this.
      }
    }

    void loadPlayback();
    return () => {
      cancelled = true;
    };
  }, [fleetId]);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;
      const url = buildPartyKitUrl(partyKitHost, fleetId, partyKitToken);
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

          if (msg.type === "fleet:disbanded") {
            window.location.href = "/?disbanded=1";
            return;
          }

          if (msg.type === "queue:vote-updated" && msg.voterId === characterId) {
            dispatch({ ...msg, selfVote: msg.voted });
            return;
          }

          if (msg.type === "queue:downvote-updated" && msg.voterId === characterId) {
            dispatch({ ...msg, selfDownvote: msg.downvoted });
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
      const ws = wsRef.current;
      if (!ws) return;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
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

  function setLocalVolume(volume: number) {
    const next = clampVolume(volume);
    setLocalVolumeState(next);
    window.localStorage.setItem(LOCAL_VOLUME_STORAGE_KEY, String(next));
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
        localVolume,
        setLocalVolume,
      }}
    >
      {children}
    </FleetContext.Provider>
  );
}

function clampVolume(volume: number): number {
  return Math.min(100, Math.max(0, Math.round(volume)));
}
