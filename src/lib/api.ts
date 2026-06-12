/**
 * Typed fetch wrappers for all /api/v1/* endpoints.
 * Components must NOT call fetch() directly — use these instead.
 */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data.error) msg = data.error;
    } catch { /* ignore */ }
    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface ScopeInfo {
  scope: string;
  required: boolean;
  label: string;
  description: string;
  consequence?: string;
}

export interface ScopeSelectionResponse {
  scopes: ScopeInfo[];
  preference: string[] | null;
}

export const api = {
  auth: {
    getScopeSelection: (): Promise<ScopeSelectionResponse> =>
      request("GET", "/api/v1/auth/scope-selection"),

    begin: (body: { scopes: string[]; returnUrl?: string }): Promise<{ url: string }> =>
      request("POST", "/api/v1/auth/begin", body),

    // The OAuth callback is a browser navigation (GET), not an API call.

    logout: (): Promise<void> =>
      request("POST", "/api/v1/auth/logout"),
  },

  // ---------------------------------------------------------------------------
  // Fleets
  // ---------------------------------------------------------------------------

  fleets: {
    create: (body: { mediaSource: "YOUTUBE" | "SOUNDCLOUD" }): Promise<{ fleetId: string; joinToken: string; joinUrl: string }> =>
      request("POST", "/api/v1/fleets", body),

    getByToken: (token: string): Promise<{ fleetId: string; name: string; fcName: string }> =>
      request("GET", `/api/v1/fleets/by-token/${token}`),

    join: (fleetId: string, body: { joinToken: string }): Promise<void> =>
      request("POST", `/api/v1/fleets/${fleetId}/join`, body),

    disband: (fleetId: string): Promise<void> =>
      request("DELETE", `/api/v1/fleets/${fleetId}`),

    leave: (fleetId: string): Promise<void> =>
      request("DELETE", `/api/v1/fleets/${fleetId}/join`),

    regenerateToken: (fleetId: string): Promise<{ joinToken: string; joinUrl: string }> =>
      request("POST", `/api/v1/fleets/${fleetId}/token`),

    members: {
      list: (fleetId: string): Promise<MemberResponse[]> =>
        request("GET", `/api/v1/fleets/${fleetId}/members`),

      kick: (fleetId: string, characterId: number): Promise<void> =>
        request("DELETE", `/api/v1/fleets/${fleetId}/members/${characterId}`),
    },

    delegates: {
      grant: (fleetId: string, characterId: number): Promise<void> =>
        request("POST", `/api/v1/fleets/${fleetId}/delegates`, { characterId }),

      revoke: (fleetId: string, characterId: number): Promise<void> =>
        request("DELETE", `/api/v1/fleets/${fleetId}/delegates/${characterId}`),
    },

    queue: {
      list: (fleetId: string, queue: "CRUISE" | "BATTLE"): Promise<QueueEntryResponse[]> =>
        request("GET", `/api/v1/fleets/${fleetId}/queue?queue=${queue}`),

      add: (fleetId: string, body: { mediaUrl: string; queue: "CRUISE" | "BATTLE" }): Promise<QueueEntryResponse> =>
        request("POST", `/api/v1/fleets/${fleetId}/queue`, body),

      remove: (fleetId: string, entryId: string): Promise<void> =>
        request("DELETE", `/api/v1/fleets/${fleetId}/queue/${entryId}`),

      validate: (fleetId: string, body: { mediaUrl: string; queue: "CRUISE" | "BATTLE" }): Promise<{
        mediaId: string;
        title: string;
        thumbnailUrl: string | null;
        duration: number | null;
      }> =>
        request("POST", `/api/v1/fleets/${fleetId}/queue/validate`, body),

      reorder: (fleetId: string, entryId: string, body: { position: number }): Promise<QueueEntryResponse> =>
        request("PATCH", `/api/v1/fleets/${fleetId}/queue/${entryId}`, body),

      vote: (fleetId: string, entryId: string): Promise<{ votes: number }> =>
        request("POST", `/api/v1/fleets/${fleetId}/queue/${entryId}/vote`),

      unvote: (fleetId: string, entryId: string): Promise<void> =>
        request("DELETE", `/api/v1/fleets/${fleetId}/queue/${entryId}/vote`),

      downvote: (fleetId: string, entryId: string): Promise<{ downvotes: number; removed: boolean }> =>
        request("POST", `/api/v1/fleets/${fleetId}/queue/${entryId}/downvote`),

      removeDownvote: (fleetId: string, entryId: string): Promise<{ downvotes: number }> =>
        request("DELETE", `/api/v1/fleets/${fleetId}/queue/${entryId}/downvote`),
    },

    playback: {
      // Mode, volume, and track changes go through PartyKit (ClientMessage) —
      // this endpoint is read-only state for load/reconnect.
      get: (fleetId: string): Promise<PlaybackStateResponse> =>
        request("GET", `/api/v1/fleets/${fleetId}/playback`),
    },
  },

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  users: {
    me: (): Promise<UserMeResponse> =>
      request("GET", "/api/v1/users/me"),

    dismissAdvisory: (key: string): Promise<void> =>
      request("POST", `/api/v1/users/me/advisories/${key}`),
  },

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  admin: {
    stats: (): Promise<AdminStatsResponse> =>
      request("GET", "/api/v1/admin/stats"),

    fleets: (): Promise<{ fleets: AdminFleetRow[] }> =>
      request("GET", "/api/v1/admin/fleets"),

    audit: (params?: { limit?: number; cursor?: string }): Promise<{ entries: AuditEntry[]; next?: string }> => {
      const q = new URLSearchParams();
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.cursor) q.set("cursor", params.cursor);
      return request("GET", `/api/v1/admin/audit${q.size ? `?${q}` : ""}`);
    },

    operators: {
      list: (): Promise<{ operators: OperatorRow[] }> =>
        request("GET", "/api/v1/admin/operators"),
      add: (characterId: number): Promise<void> =>
        request("POST", "/api/v1/admin/operators", { characterId }),
      remove: (characterId: number): Promise<void> =>
        request("DELETE", `/api/v1/admin/operators/${characterId}`),
    },
  },
};

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface MemberResponse {
  characterId: number;
  characterName: string;
  role: "FLEET_COMMANDER" | "FC_DELEGATE" | "LINE_MEMBER";
  solarSystem: string | null;
}

export interface QueueEntryResponse {
  id: string;
  queue: "CRUISE" | "BATTLE";
  mediaUrl: string;
  mediaId: string;
  title: string;
  thumbnailUrl: string | null;
  duration: number | null;
  submittedBy: number;
  position: number;
  votes: number;
  downvotes: number;
  hasVoted: boolean;
  hasDownvoted: boolean;
  removedAt: string | null;
}

export interface PlaybackStateResponse {
  fleetId: string;
  queueEntryId: string | null;
  mediaId: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  startedAt: string | null;
  fleetOffsetSeconds: number | null;
}

export interface UserMeResponse {
  characterId: number;
  characterName: string;
  isOperator: boolean;
  advisories: { key: string; message: string }[];
}

export interface AdminStatsResponse {
  activeFleets: number;
  connectedMembers: number;
  partyKitRooms: number;
  esiErrorBudget: number | null;
  tokenRefreshFailures24h: number;
  dbStatus: "ok" | "down";
  redisStatus: "ok" | "down";
}

export interface AdminFleetRow {
  id: string;
  name: string;
  fcName: string;
  memberCount: number;
  mode: string;
  createdAt: string;
  expiresAt: string | null;
  disbandedAt: string | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  actorId: number;
  actorName: string;
  targetId?: number;
  targetName?: string;
  fleetId?: string;
  createdAt: string;
}

export interface OperatorRow {
  characterId: number;
  characterName: string;
}
