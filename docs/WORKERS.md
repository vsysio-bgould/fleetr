# Fleetr Worker Inventory

> Defines every BullMQ background worker: its queue name, trigger, schedule, payload, and behaviour. All workers follow the `WorkerDefinition<TPayload>` pattern from `docs/CODING-STANDARDS.md` §7 and are auto-discovered by `src/worker.ts` on startup.

---

## Worker Summary

| Worker | Queue | Trigger | Schedule |
|--------|-------|---------|----------|
| [queue-advance](#1-queue-advance) | `queue-advance` | Delayed job scheduled when fleet reference is set | Per-fleet, dynamic delay |
| [fleet-cleanup](#2-fleet-cleanup) | `fleet-cleanup` | Cron | Every 5 minutes |
| [session-cleanup](#3-session-cleanup) | `session-cleanup` | Cron | Every 15 minutes |
| [esi-token-refresh](#4-esi-token-refresh) | `esi-token-refresh` | Cron | Every 10 minutes |
| [location-sync](#5-location-sync) | `location-sync` | Cron | Every 30 seconds |

---

## 1. queue-advance

**File:** `src/workers/queue-advance.worker.ts`
**Queue:** `queue-advance`
**Trigger:** Delayed job. Scheduled programmatically whenever the fleet reference is set.

### Purpose

Advances the fleet reference track to the next entry in the active queue when the current track's duration has elapsed. This is the mechanism that makes fleet playback hands-off for the FC after the fleet is formed.

### Scheduling

When the fleet reference is set (FC calls `fleet:set-track` or `fleet:advance`, or this worker itself fires), the service layer schedules a delayed BullMQ job:

```typescript
await queue.add('advance', payload, {
    jobId: `fleet-advance:${fleetId}`,   // deterministic — replaces any existing job
    delay: entry.duration * 1000,        // milliseconds until auto-advance
});
```

Using a fixed `jobId` per fleet means scheduling a new job automatically supersedes the previous one. When the FC manually advances, the service calls `queue.add` with the new track's duration — the old delayed job is replaced without explicit cancellation.

If `entry.duration` is `null` (platform API did not return a duration), **no job is scheduled**. That track stays on reference until the FC manually skips. The UI surfaces a visual indicator on entries with no duration.

### Mode switch

When the FC switches fleet mode (CRUISE ↔ BATTLE), the mode switch handler:

1. Cancels the current `fleet-advance:{fleetId}` job (the old queue's timer).
2. Finds the top entry in the new queue (votes desc, position asc).
3. Sets that entry as the fleet reference (`startedAt = now()`).
4. Schedules a new `fleet-advance:{fleetId}` job for the new entry's duration.
5. Broadcasts `fleet:mode-changed { mode, nowPlaying }` — clients interrupt immediately.

If the new queue is empty, step 2 yields nothing: the reference is cleared, no job is scheduled, and `fleet:mode-changed { mode, nowPlaying: null }` is broadcast. Clients stop their players and show the empty queue state.

### Payload

```typescript
interface QueueAdvancePayload {
    fleetId: string;
    completedEntryId: string; // guard against stale jobs firing after a manual advance
}
```

### Behaviour

1. **Guard**: Fetch the fleet's current `Playback` row. If `queueEntryId !== completedEntryId`, a manual advance already occurred — exit without action.
2. **Fetch fleet mode**: Read `Fleet.mode` at fire time (not schedule time) to determine which queue (CRUISE or BATTLE) to advance within.
3. **Find next entry**: Query `QueueEntry` for the next active (non-removed) entry in the active queue, ordered by `votes desc, position asc`, with `submittedAt > completedEntry.submittedAt` as a tiebreaker if needed.
4. **If next entry found**:
   - Upsert `Playback` with the new entry and `startedAt = now()`
   - Call `POST /internal/fleets/:id/playback` to trigger PartyKit broadcast
   - Schedule the next `queue-advance` job for `entry.duration * 1000` ms (skip if duration is null)
5. **If no next entry**:
   - Clear `Playback` (`queueEntryId = null`, `startedAt = null`)
   - Call `POST /internal/fleets/:id/playback` to broadcast `fleet:now-playing null`
   - Do not schedule a new job

### Failure handling

- On failure, BullMQ retries up to 3 times with exponential backoff.
- If all retries fail, log an error and emit an audit event. The fleet reference stays on the completed track. The FC can manually advance.

---

## 2. fleet-cleanup

**File:** `src/workers/fleet-cleanup.worker.ts`
**Queue:** `fleet-cleanup`
**Schedule:** Every 5 minutes (`*/5 * * * *`)

### Purpose

Marks fleets as disbanded when they have been abandoned — either past their `expiresAt` timestamp, or when ESI confirms the underlying EVE fleet no longer exists.

### Behaviour

1. **Expired fleets**: Query `Fleet` for rows where `expiresAt < now()` and `disbandedAt IS NULL`. Set `disbandedAt = now()`.
2. **Orphaned fleets**: Query `Fleet` for active fleets (no `disbandedAt`) with no connected sessions in the last 30 minutes. Call ESI `GET /fleets/{esiFleetId}/members/` using the FC's stored token. If ESI returns `404` (fleet disbanded in EVE), set `disbandedAt = now()`.
3. **For each disbanded fleet**: Cancel any pending `queue-advance` job (`fleet-advance:{fleetId}`), broadcast a fleet disband message via `POST /internal/fleets/:id/broadcast`, and emit an audit event.

### Notes

- ESI calls in step 2 consume error budget. Cap to 10 fleets per run if the error budget is below 50.
- `invalid_grant` on a fleet's FC token: null out the token, log a warning, skip the ESI check for that fleet (the fleet will be cleaned up by the `expiresAt` path or the next orphan check).

---

## 3. session-cleanup

**File:** `src/workers/session-cleanup.worker.ts`
**Queue:** `session-cleanup`
**Schedule:** Every 15 minutes (`*/15 * * * *`)

### Purpose

Deletes `Session` rows that have passed their `expiresAt` timestamp. Sessions expire when a fleet is disbanded (set by the cleanup that disbands the fleet) or after a configurable idle period.

### Behaviour

1. Delete all `Session` rows where `expiresAt < now()`.
2. Log the count of deleted rows at `info` level.

This worker is intentionally simple — session expiry is enforced at the API layer on each request (a session past `expiresAt` returns `401`). This worker is purely for DB hygiene.

---

## 4. esi-token-refresh

**File:** `src/workers/esi-token-refresh.worker.ts`
**Queue:** `esi-token-refresh`
**Schedule:** Every 10 minutes (`*/10 * * * *`)

### Purpose

Proactively refreshes ESI access tokens before they expire. ESI access tokens have a 1200-second (20-minute) lifetime. Refreshing at the 10-minute mark ensures there is always a valid token available without waiting for a request to fail.

### Behaviour

1. Query `EsiToken` for rows where `accessTokenExpiresAt < now() + 15 minutes`.
2. For each token, call `POST https://login.eveonline.com/v2/oauth/token` with `grant_type=refresh_token`.
3. On success: overwrite `accessToken`, `accessTokenExpiresAt`, and `refreshToken` (refresh tokens may rotate — always overwrite).
4. On `invalid_grant`: null out both tokens on the `EsiToken` row, log a warning, and emit an `ESI_TOKEN_INVALIDATED` audit event with the affected `characterId`. Do not retry.
5. On other errors: log and allow BullMQ to retry (up to 3 times, exponential backoff).

### Notes

- Respect the ESI error budget. If `errorBudgetRemaining < 26`, skip this run entirely and log a warning. Token refresh failures are handled gracefully by the API layer (which re-attempts a refresh on demand before returning `503`).
- This worker only processes tokens for characters who are currently in active fleets (join `EsiToken` with `Session` where `expiresAt > now()`). Refreshing tokens for characters with no active sessions is wasteful.

---

## 5. location-sync

**File:** `src/workers/location-sync.worker.ts`
**Queue:** `location-sync`
**Schedule:** Every 30 seconds (`*/30 * * * *` — BullMQ `every: '30s'`)

### Purpose

Fetches current solar system locations for fleet members who have granted `esi-location.read_location.v1`, and broadcasts updates to the FC's member roster in real time.

### Behaviour

1. Query all active fleets (`disbandedAt IS NULL`).
2. For each fleet, query `Session` for members whose `grantedScopes` includes `esi-location.read_location.v1`.
3. For each such member, call ESI `GET /characters/{characterId}/location/` using their access token.
4. Collect results and broadcast a `member:location-updated` message (a `ServerMessage` variant) via `POST /internal/fleets/:id/broadcast`.

### Notes

- This worker is skipped entirely if the ESI error budget is below 26.
- Location data is **not persisted** to the DB — it is ephemeral and broadcast-only. The FC roster re-fetches on reconnect via `sync:state` + a fresh location broadcast.
- The 30-second cadence is intentionally relaxed. EVE location updates are not sub-second.
- If a character's access token is expired and refresh fails, skip that character silently for this run. Their location shows as `null` in the roster.

### Additional message type

This worker introduces one `ServerMessage` variant not covered by the core playback contract:

```typescript
// Add to ServerMessage union in src/config/party-messages.ts when implementing
{ type: 'member:location-updated'; updates: Array<{ characterId: number; solarSystem: string | null }> }
```

---

## Adding a New Worker

1. Create `src/workers/{name}.worker.ts` exporting a `WorkerDefinition`.
2. The worker is auto-discovered by `src/worker.ts` at startup — no registration needed.
3. Add an entry to the table at the top of this document.
4. If the worker makes ESI calls, ensure it checks the error budget before running.
