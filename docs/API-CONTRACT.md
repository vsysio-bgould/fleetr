# Fleetr API Contract

> Defines the HTTP REST API (`/api/v1/...`), the internal PartyKit → API interface, and the boundary between HTTP and the PartyKit WebSocket layer.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Common Conventions](#2-common-conventions)
3. [HTTP vs PartyKit Boundary](#3-http-vs-partykit-boundary)
4. [Auth Endpoints](#4-auth-endpoints)
5. [Fleet Endpoints](#5-fleet-endpoints)
6. [Queue Endpoints](#6-queue-endpoints)
7. [Member & Delegate Endpoints](#7-member--delegate-endpoints)
8. [User Endpoints](#8-user-endpoints)
9. [Admin Endpoints](#9-admin-endpoints)
10. [Internal Endpoints](#10-internal-endpoints)
11. [Error Reference](#11-error-reference)

---

## 1. Authentication

### 1.1 Bearer Tokens

All protected endpoints require:

```
Authorization: Bearer <token>
```

Tokens are opaque UUIDs issued after ESI OAuth and stored in the `ApiToken` table. They are **character-level** — not fleet-scoped. Fleet role (`LINE_MEMBER`, `FLEET_COMMANDER`, `FC_DELEGATE`) is resolved per-request from the `Session` table using `(characterId, fleetId)`.

### 1.2 Browser Clients

The OAuth callback sets an `httpOnly` cookie (`fleetr_token`) alongside returning the token in the response body. Browser clients benefit from the security of `httpOnly` storage without any extra work; the cookie is sent automatically on same-origin requests.

Middleware checks the `Authorization` header first, then falls back to the cookie. One code path, two transports.

### 1.3 Non-Browser Clients (Bots)

Bot clients (Discord, Mumble) store the token however they choose and pass it as a Bearer header. There is no cookie set for clients that supply a token via header.

To support multiple independent bot instances, a character may hold multiple `ApiToken` rows. Each token can carry an optional `label` (e.g. `"Discord bot — Brave Newbies"`).

### 1.4 PartyKit WebSocket Auth

Clients pass their bearer token as a query param when opening the WebSocket connection:

```
wss://party.../party/fleet-{fleetId}?token={apiToken}
```

The PartyKit server validates the token via DB lookup in `onConnect` and stores the
resolved claims in `connection.state`. Token exposure in server logs is acceptable —
the fleet room is not sensitive data and the token is already a long-lived credential.

The OAuth flow is browser-based — a human authorises the bot character once via the standard ESI flow, copies the returned token into the bot's configuration.

### 1.4 Token Lifecycle

| Event | Effect |
|-------|--------|
| ESI OAuth completed | New `ApiToken` issued, returned in response body + cookie |
| `POST /auth/logout` | Token deleted, cookie cleared |
| Token past `expiresAt` | Rejected with `401 UNAUTHORIZED`; client must re-authenticate |
| `lastUsedAt` updated | On every authenticated request (DB write, async) |

Default token lifetime: **30 days**. Tokens are not automatically refreshed — clients must re-run the OAuth flow when a token expires.

---

## 2. Common Conventions

### 2.1 Base URL

```
/api/v1
```

All paths below are relative to this prefix.

### 2.2 Request Format

`Content-Type: application/json` required for all requests with a body.

### 2.3 Success Responses

Resources are returned directly — no envelope wrapper. HTTP status codes carry meaning:

| Status | Meaning |
|--------|---------|
| `200` | Success with body |
| `201` | Created |
| `204` | Success, no body (DELETE) |

### 2.4 Error Format

All errors return a consistent JSON body:

```json
{
    "error": "NOT_IN_FLEET",
    "message": "Character 12345 is not currently in fleet 789.",
    "details": {}
}
```

`error` is a stable machine-readable code (see §11). `message` is human-readable and may change. `details` carries structured context where relevant (e.g. the `scope` field on `SCOPE_NOT_GRANTED`).

### 2.5 Pagination

List endpoints that may return large result sets accept:

| Param | Default | Description |
|-------|---------|-------------|
| `limit` | `50` | Max items to return |
| `offset` | `0` | Number of items to skip |

Pagination metadata is returned in response headers:

```
X-Total-Count: 142
X-Offset: 0
X-Limit: 50
```

### 2.6 Fleet Context

Most endpoints are scoped to a fleet via `:fleetId` in the path. The middleware resolves:

1. `ApiToken` → `characterId`
2. `Session` for `(characterId, fleetId)` → `role`

Handlers receive a typed `FleetRequest` with `req.character` and `req.session` already populated. Role guards are applied at the router level (§ CODING-STANDARDS §7.1), not inline in handlers.

---

## 3. HTTP vs PartyKit Boundary

Mutations that require immediate broadcast to all connected clients use the PartyKit WebSocket layer. Mutations that require server-side validation or durable writes before they take effect use HTTP.

| Operation | Transport | Rationale |
|-----------|-----------|-----------|
| Queue submit | HTTP | Server validates URL, fetches metadata, enforces platform match before entry exists |
| Vote | HTTP | Simple write; broadcast handled by the internal endpoint after persist |
| Reorder queue | HTTP | FC drag-and-drop; not latency-sensitive |
| Remove queue entry | HTTP | Soft delete with audit; not latency-sensitive |
| Play / Pause / Resume | PartyKit | Needs <100ms round-trip; all clients react simultaneously |
| Seek | PartyKit | Same |
| Skip | PartyKit | Same |
| Fleet mode change | PartyKit | Same |
| Member kick | HTTP | Requires session invalidation + audit log; real-time notification sent via internal endpoint |
| Delegation change | HTTP | Same |

### 3.1 PartyKit → HTTP Persistence

After handling a real-time command, the PartyKit server calls the internal API to persist state. These calls are authenticated with a shared secret (`PARTYKIT_SECRET` env var), not a user token.

```
POST /api/v1/internal/fleets/:id/playback
POST /api/v1/internal/fleets/:id/mode
POST /api/v1/internal/fleets/:id/broadcast   // for kicks, delegation — triggers client notification
```

Full PartyKit message type definitions live in `src/config/party-messages.ts`.

---

## 4. Auth Endpoints

### `GET /auth/scope-selection`

Returns available scopes and the character's last-saved preference (if any). Called before redirecting to ESI to populate the scope selection screen.

**Auth:** Optional — returns preference if character is known, defaults if not.

**Response `200`:**
```json
{
    "scopes": [
        {
            "scope": "esi-fleets.read_fleet.v1",
            "required": true,
            "label": "Fleet Membership",
            "description": "Reads your current fleet and role.",
            "consequence": null
        },
        {
            "scope": "esi-location.read_location.v1",
            "required": false,
            "label": "Location",
            "description": "Shows your current solar system in the FC roster.",
            "consequence": "Your location will not appear in the FC member roster."
        }
    ],
    "preference": ["esi-fleets.read_fleet.v1", "esi-location.read_location.v1"]
}
```

`preference` is `null` if no preference has been saved for this character.

---

### `POST /auth/begin`

Initiates the ESI OAuth flow. Stores the selected scopes and return URL in a short-lived server-side state, then redirects to EVE SSO.

**Auth:** None.

**Request:**
```json
{
    "scopes": ["esi-fleets.read_fleet.v1", "esi-location.read_location.v1"],
    "returnUrl": "/join/abc123"
}
```

**Response:** `302` redirect to EVE SSO.

---

### `GET /auth/callback`

ESI OAuth callback. Exchanges the code for tokens, verifies the JWT, creates or updates the `User`, persists the `EsiToken`, issues an `ApiToken`, and saves the `UserScopePreference`.

**Auth:** None (this IS the auth endpoint).

**Response `200`:**
```json
{
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2026-07-11T14:00:00Z",
    "character": {
        "id": 12345678,
        "name": "Brandizzle"
    }
}
```

Also sets `Set-Cookie: fleetr_token=<token>; HttpOnly; Secure; SameSite=Lax; Path=/`.

Then redirects to `returnUrl` if one was stored.

---

### `POST /auth/logout`

Deletes the `ApiToken` and clears the cookie.

**Auth:** Required.

**Response:** `204`

---

## 5. Fleet Endpoints

### `POST /fleets`

FC creates a fleet. Server calls ESI to verify the character holds a qualifying fleet role and fetches fleet info. Fails if the character is not in a fleet or does not hold the required position.

**Auth:** Required. ESI `esi-fleets.read_fleet.v1` scope required.

**Request:**
```json
{
    "mediaSource": "YOUTUBE"
}
```

**Response `201`:**
```json
{
    "id": "f1a2b3c4-...",
    "esiFleetId": "1234567890",
    "name": "Brandizzle",
    "joinToken": "xK9mP2qR",
    "joinUrl": "https://fleetr.app/join/xK9mP2qR",
    "mediaSource": "YOUTUBE",
    "mode": "CRUISE",
    "fcCharacterId": 12345678,
    "createdAt": "2026-06-11T14:00:00Z"
}
```

**Errors:** `FORBIDDEN` (not a qualifying FC), `ESI_UNAVAILABLE`

---

### `GET /fleets/:id`

Returns fleet info and current state. Available to all fleet members.

**Auth:** Required. Must be a member of this fleet.

**Response `200`:**
```json
{
    "id": "f1a2b3c4-...",
    "name": "Brandizzle",
    "mode": "CRUISE",
    "mediaSource": "YOUTUBE",
    "fcCharacterId": 12345678,
    "memberCount": 47,
    "expiresAt": null
}
```

---

### `DELETE /fleets/:id`

FC disbands the fleet. Sets `disbandedAt`, terminates all sessions, closes the PartyKit room.

**Auth:** Required. `FLEET_COMMANDER` role.

**Response:** `204`

---

### `POST /fleets/:id/join`

Line member joins the fleet room. Performs the one-time ESI fleet membership gate — verifies the character is currently in the EVE fleet matching this Fleetr fleet. On success, creates a `Session` row. The ESI token is not retained after this check.

**Auth:** Required (character must be authenticated via ESI with `esi-fleets.read_fleet.v1`).

**Response `200`:**
```json
{
    "sessionId": "s9f8e7d6-...",
    "fleetId": "f1a2b3c4-...",
    "role": "LINE_MEMBER",
    "grantedScopes": ["esi-fleets.read_fleet.v1"]
}
```

**Errors:** `NOT_IN_FLEET`, `FLEET_EXPIRED`, `ESI_UNAVAILABLE`

---

### `DELETE /fleets/:id/join`

Leave the fleet room voluntarily. Deletes the `Session` row.

**Auth:** Required. Must be a member of this fleet.

**Response:** `204`

---

### `POST /fleets/:id/token`

Regenerates the join link token. Invalidates the previous token immediately.

**Auth:** Required. `FLEET_COMMANDER` role.

**Response `200`:**
```json
{
    "joinToken": "nW4vL8kT",
    "joinUrl": "https://fleetr.app/join/nW4vL8kT"
}
```

---

### `GET /fleets/:id/playback`

Returns the current fleet reference track. Used on client load and reconnect to
populate the NowPlaying component and provide the offset for the "Catch Up" feature.

**Auth:** Required. Must be a member of this fleet.

**Response `200`:**
```json
{
    "queueEntryId": "e3d2c1b0-...",
    "mediaId": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "thumbnailUrl": "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    "duration": 212,
    "startedAt": "2026-06-11T14:22:00Z",
    "fleetOffsetSeconds": 47.3
}
```

`fleetOffsetSeconds` is computed server-side as `(now - startedAt).seconds`. The client
uses this value when the user clicks "Catch Up" to seek their local player to the fleet's
approximate position. Response is `null` if no track has been set yet.

---

## 6. Queue Endpoints

### `POST /fleets/:id/queue/validate`

Validates a media URL before submission. Calls the platform API to verify the track is embeddable and fetches metadata. The submit form calls this on URL input (debounced) to show a preview before the user confirms.

The server re-validates on actual submission — do not skip validation on submit because the client already called this.

**Auth:** Required. Must be a member of this fleet.

**Request:**
```json
{
    "mediaUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "queue": "CRUISE"
}
```

**Response `200`:**
```json
{
    "mediaId": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up (Official Music Video)",
    "thumbnailUrl": "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    "duration": 212
}
```

**Errors:** `EMBEDDING_DISABLED`, `PLATFORM_MISMATCH`, `NOT_FOUND`, `VALIDATION_ERROR`

---

### `POST /fleets/:id/queue`

Submits a media entry to the queue. Server validates the URL (same checks as `/validate`), fetches metadata, appends the entry at the end of the queue (position = current max + 1.0), and broadcasts a `queue:entry-added` message via the internal broadcast endpoint.

**Auth:** Required. Must be a member of this fleet.

**Request:**
```json
{
    "mediaUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "queue": "CRUISE"
}
```

**Response `201`:**
```json
{
    "id": "e3d2c1b0-...",
    "fleetId": "f1a2b3c4-...",
    "queue": "CRUISE",
    "mediaUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "mediaId": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up (Official Music Video)",
    "thumbnailUrl": "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    "duration": 212,
    "submittedBy": 12345678,
    "position": 5.0,
    "votes": 0,
    "submittedAt": "2026-06-11T14:30:00Z"
}
```

**Errors:** `EMBEDDING_DISABLED`, `PLATFORM_MISMATCH`, `NOT_FOUND`, `VALIDATION_ERROR`

---

### `GET /fleets/:id/queue`

Returns active (non-removed) queue entries for the specified queue type, sorted by votes descending then position ascending.

**Auth:** Required. Must be a member of this fleet.

**Query params:**

| Param | Required | Values |
|-------|----------|--------|
| `queue` | Yes | `CRUISE`, `BATTLE` |
| `limit` | No | default `50` |
| `offset` | No | default `0` |

**Response `200`:**
```json
[
    {
        "id": "e3d2c1b0-...",
        "mediaId": "dQw4w9WgXcQ",
        "title": "Rick Astley - Never Gonna Give You Up (Official Music Video)",
        "thumbnailUrl": "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
        "duration": 212,
        "submittedBy": 12345678,
        "position": 1.0,
        "votes": 7,
        "hasVoted": true,
        "submittedAt": "2026-06-11T14:30:00Z"
    }
]
```

`hasVoted` is `true` if the requesting character has voted on this entry.

---

### `DELETE /fleets/:id/queue/:entryId`

Soft-deletes a queue entry (sets `removedAt`). Broadcasts `queue:entry-removed`.

**Auth:** Required. `FLEET_COMMANDER` role.

**Response:** `204`

---

### `POST /fleets/:id/queue/:entryId/vote`

Casts an upvote. Broadcasts `queue:vote-updated`.

**Auth:** Required. Must be a member of this fleet.

**Response `201`:**
```json
{ "votes": 8 }
```

**Errors:** `ALREADY_VOTED`, `NOT_FOUND`

---

### `DELETE /fleets/:id/queue/:entryId/vote`

Removes an upvote. Broadcasts `queue:vote-updated`.

**Auth:** Required. Must be a member of this fleet.

**Response `200`:**
```json
{ "votes": 7 }
```

---

### `PATCH /fleets/:id/queue/:entryId`

Updates the position of a queue entry (FC manual reorder). Broadcasts `queue:reordered`.

**Auth:** Required. `FLEET_COMMANDER` role.

**Request:**
```json
{ "position": 1.5 }
```

**Response `200`:** Updated entry (same shape as queue list item).

---

## 7. Member & Delegate Endpoints

### `GET /fleets/:id/members`

Returns the current member roster.

**Auth:** Required. `FLEET_COMMANDER` role.

**Response `200`:**
```json
[
    {
        "characterId": 12345678,
        "characterName": "Brandizzle",
        "role": "FLEET_COMMANDER",
        "solarSystem": "Jita",
        "joinedAt": "2026-06-11T14:00:00Z"
    }
]
```

`solarSystem` is `null` if the character has not granted `esi-location.read_location.v1`.

---

### `DELETE /fleets/:id/members/:characterId`

Kicks a member from the Fleetr room. Deletes their `Session`, broadcasts a `member:kicked` message so their client can redirect them out.

**Auth:** Required. `FLEET_COMMANDER` role. Cannot kick another FC or the fleet owner.

**Response:** `204`

---

### `POST /fleets/:id/delegates`

Grants FC-level access to a fleet member.

**Auth:** Required. `FLEET_COMMANDER` role.

**Request:**
```json
{ "characterId": 98765432 }
```

**Response `201`:**
```json
{
    "characterId": 98765432,
    "characterName": "Otherpilot",
    "grantedBy": 12345678,
    "grantedAt": "2026-06-11T15:00:00Z"
}
```

**Errors:** `NOT_FOUND` (character not in fleet), `FORBIDDEN` (delegates cannot sub-delegate)

---

### `DELETE /fleets/:id/delegates/:characterId`

Revokes FC delegation. The delegate's session role is downgraded on their next request.

**Auth:** Required. `FLEET_COMMANDER` role.

**Response:** `204`

---

## 8. User Endpoints

### `GET /users/me`

Returns the current character's profile and active fleet memberships.

**Auth:** Required.

**Response `200`:**
```json
{
    "characterId": 12345678,
    "characterName": "Brandizzle",
    "isOperator": false,
    "grantedScopes": ["esi-fleets.read_fleet.v1", "esi-location.read_location.v1"],
    "activeSessions": [
        { "fleetId": "f1a2b3c4-...", "role": "FLEET_COMMANDER" }
    ]
}
```

---

### `PATCH /users/me/scope-preference`

Saves the character's scope selection preference for future logins.

**Auth:** Required.

**Request:**
```json
{ "scopes": ["esi-fleets.read_fleet.v1"] }
```

**Response `200`:**
```json
{ "scopes": ["esi-fleets.read_fleet.v1"], "updatedAt": "2026-06-11T14:00:00Z" }
```

---

### `POST /users/me/advisories/:key`

Records a dismissal for an advisory notice. `key` is the advisory identifier (e.g. `youtube-premium`).

**Auth:** Required.

**Request:**
```json
{ "permanent": true }
```

**Response:** `204`

---

## 9. Admin Endpoints

All `/admin/*` endpoints require `isOperator: true`. Protected by `requireOperator` middleware at the router level.

### `GET /admin/stats`

System health and operational metrics.

**Response `200`:**
```json
{
    "activeFleets": 12,
    "connectedMembers": 347,
    "partyKitRooms": 12,
    "esiErrorBudget": 87,
    "tokenRefreshFailures24h": 2,
    "dbStatus": "ok",
    "redisStatus": "ok"
}
```

---

### `GET /admin/fleets`

All active (non-disbanded) fleets. Paginated.

**Response `200`:** Array of fleet summaries (same shape as `GET /fleets/:id`).

---

### `DELETE /admin/fleets/:id`

Force-disbands any fleet. Same effect as the FC's own disband, with an `OPERATOR_FORCE_DISBAND` audit event.

**Response:** `204`

---

### `GET /admin/audit`

Paginated audit log. Supports filtering by event type and actor.

**Query params:** `event`, `actor`, `from`, `to`, `limit`, `offset`

**Response `200`:** Array of audit log entries.

---

### `POST /admin/operators`

Grants Operator status to a character.

**Request:** `{ "characterId": 12345678 }`

**Response `201`:** `{ "characterId": 12345678, "characterName": "Brandizzle" }`

---

### `DELETE /admin/operators/:characterId`

Revokes Operator status.

**Response:** `204`

---

## 10. Internal Endpoints

Called exclusively by the PartyKit server. Authenticated with `Authorization: Bearer <PARTYKIT_SECRET>` where `PARTYKIT_SECRET` is a shared env var known to both services. Never called by browser or bot clients.

---

### `POST /internal/fleets/:id/playback`

Persists the fleet reference track. Called by the PartyKit server when the FC sets
or advances the track, and by the queue-advance worker when auto-advance fires.

**Request:**
```json
{
    "queueEntryId": "e3d2c1b0-...",
    "mediaId": "dQw4w9WgXcQ",
    "startedAt": "2026-06-11T14:22:00Z",
    "initiatedBy": 12345678
}
```

`initiatedBy` is the FC's characterId for manual advances, or `null` for auto-advance.
Used for audit logging.

**Response:** `204`

---

### `POST /internal/fleets/:id/mode`

Persists a fleet mode change.

**Request:** `{ "mode": "BATTLE", "initiatedBy": 12345678 }`

**Response:** `204`

---

### `POST /internal/fleets/:id/broadcast`

Triggers a server-initiated broadcast to the fleet's PartyKit room. Used when an HTTP action (kick, delegation change) needs to push a real-time notification to connected clients.

**Request:**
```json
{
    "message": {
        "type": "member:kicked",
        "characterId": 98765432
    }
}
```

**Response:** `204`

---

## 11. Error Reference

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `UNAUTHORIZED` | 401 | Missing or expired bearer token |
| `FORBIDDEN` | 403 | Authenticated but insufficient role |
| `NOT_FOUND` | 404 | Resource does not exist or is not visible to this character |
| `VALIDATION_ERROR` | 422 | Request body failed schema validation; `details` contains field errors |
| `NOT_IN_FLEET` | 403 | Character is not currently in the EVE fleet (join gate) |
| `FLEET_EXPIRED` | 410 | Fleet has been disbanded |
| `ALREADY_VOTED` | 409 | Character has already voted on this entry |
| `PLATFORM_MISMATCH` | 422 | Submitted URL does not match the fleet's media source |
| `EMBEDDING_DISABLED` | 422 | Video or track has embedding disabled |
| `SCOPE_NOT_GRANTED` | 403 | Feature requires an ESI scope the character did not grant; `details.scope` names it |
| `ESI_UNAVAILABLE` | 503 | ESI is unreachable or the error budget is exhausted |
| `INTERNAL_ERROR` | 500 | Unhandled server error; reference `details.requestId` when reporting |
