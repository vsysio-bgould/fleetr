import type * as Party from "partykit/server";
import type { ClientMessage, ServerMessage, SyncState } from "../src/config/party-messages";
import type { SessionRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// Connection state stored per socket
// ---------------------------------------------------------------------------

interface ConnectionState {
  characterId: number;
  characterName: string;
  role: SessionRole;
  fleetId: string;
}

// ---------------------------------------------------------------------------
// Room state (in-memory, cleared on room teardown)
// ---------------------------------------------------------------------------

interface RoomState {
  mode: "CRUISE" | "BATTLE";
  volume: number;
  nowPlaying: null; // populated in Phase 6
}

const DEFAULT_STATE: RoomState = {
  mode: "CRUISE",
  volume: 100,
  nowPlaying: null,
};

export default class FleetServer implements Party.Server {
  readonly room: Party.Room;
  private state: RoomState = { ...DEFAULT_STATE };

  constructor(room: Party.Room) {
    this.room = room;
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get("token");
    const fleetId = this.room.id.replace("fleet-", "");

    if (!token) {
      conn.send(
        JSON.stringify({
          type: "error",
          code: "AUTH_REQUIRED",
          message: "Token required",
        } satisfies ServerMessage)
      );
      conn.close();
      return;
    }

    // Validate token and session via internal API
    const appUrl = this.room.env.APP_URL as string ?? "http://localhost:3000";
    const secret = this.room.env.PARTYKIT_SECRET as string;

    let connectionState: ConnectionState;
    try {
      const res = await fetch(
        `${appUrl}/api/v1/internal/fleets/${fleetId}/validate-connection`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-PartyKit-Secret": secret,
          },
          body: JSON.stringify({ token }),
        }
      );

      if (!res.ok) {
        throw new Error(`Validation failed: ${res.status}`);
      }

      connectionState = await res.json();
    } catch {
      conn.send(
        JSON.stringify({
          type: "error",
          code: "AUTH_FAILED",
          message: "Authentication failed",
        } satisfies ServerMessage)
      );
      conn.close();
      return;
    }

    // Store connection state
    conn.setState(connectionState);

    // Broadcast member:joined to other connections
    this.room.broadcast(
      JSON.stringify({
        type: "member:joined",
        payload: {
          characterId: connectionState.characterId,
          characterName: connectionState.characterName,
          role: connectionState.role,
        },
      } satisfies ServerMessage),
      [conn.id]
    );

    // Send current sync state to the new connection
    const syncState: SyncState = {
      nowPlaying: this.state.nowPlaying,
      mode: this.state.mode,
      volume: this.state.volume,
      memberCount: Array.from(this.room.getConnections()).length,
    };

    conn.send(
      JSON.stringify({
        type: "sync:state",
        payload: syncState,
      } satisfies ServerMessage)
    );
  }

  onClose(conn: Party.Connection) {
    const state = conn.state as ConnectionState | undefined;
    if (!state) return;

    this.room.broadcast(
      JSON.stringify({
        type: "member:left",
        characterId: state.characterId,
      } satisfies ServerMessage)
    );
  }

  async onMessage(message: string, sender: Party.Connection) {
    const state = sender.state as ConnectionState | undefined;
    if (!state) return;

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message) as ClientMessage;
    } catch {
      sender.send(
        JSON.stringify({
          type: "error",
          code: "INVALID_MESSAGE",
          message: "Message must be valid JSON",
        } satisfies ServerMessage)
      );
      return;
    }

    const isFc =
      state.role === "FLEET_COMMANDER" || state.role === "FC_DELEGATE";

    switch (parsed.type) {
      case "fleet:set-track":
      case "fleet:advance":
      case "fleet:set-mode":
      case "fleet:set-volume": {
        if (!isFc) {
          sender.send(
            JSON.stringify({
              type: "error",
              code: "FORBIDDEN",
              message: "This action requires FC access",
            } satisfies ServerMessage)
          );
          return;
        }
        // Delegate to internal API — handlers added in later phases
        await this.dispatchToApi(parsed, state);
        break;
      }

      default: {
        sender.send(
          JSON.stringify({
            type: "error",
            code: "NOT_IMPLEMENTED",
            message: `Unknown message type`,
          } satisfies ServerMessage)
        );
      }
    }
  }

  /** Handle internal broadcast from the Next.js API. */
  async onRequest(req: Party.Request): Promise<Response> {
    const secret = this.room.env.PARTYKIT_SECRET as string;
    const authHeader = req.headers.get("X-PartyKit-Secret");

    if (!authHeader || authHeader !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (req.method === "POST") {
      const message: ServerMessage = await req.json();
      this.applyStateFromBroadcast(message);
      this.room.broadcast(JSON.stringify(message));
      return new Response("OK");
    }

    return new Response("Method Not Allowed", { status: 405 });
  }

  private applyStateFromBroadcast(message: ServerMessage) {
    if (message.type === "fleet:mode-changed") {
      this.state.mode = message.mode;
      this.state.nowPlaying = message.nowPlaying as null;
    } else if (message.type === "fleet:volume-changed") {
      this.state.volume = message.volume;
    } else if (message.type === "fleet:now-playing") {
      this.state.nowPlaying = message.payload as null;
    }
  }

  private async dispatchToApi(
    message: ClientMessage,
    state: ConnectionState
  ): Promise<void> {
    const appUrl = this.room.env.APP_URL as string ?? "http://localhost:3000";
    const secret = this.room.env.PARTYKIT_SECRET as string;
    const fleetId = this.room.id.replace("fleet-", "");

    await fetch(`${appUrl}/api/v1/internal/fleets/${fleetId}/party-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PartyKit-Secret": secret,
        "X-Character-Id": String(state.characterId),
      },
      body: JSON.stringify(message),
    }).catch(() => null);
  }
}
