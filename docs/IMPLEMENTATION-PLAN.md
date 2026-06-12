# Fleetr Implementation Plan

> Phased build-out from scaffold to production-ready. Each phase has a clear milestone — something you can run and demonstrate before moving on. Tests are written within each phase, not deferred.
>
> Dependencies between phases are explicit. Do not start a phase until its dependencies are complete.

---

## Phase Overview

| Phase | Name | Depends on | Milestone |
|-------|------|------------|-----------|
| 0 | [Scaffold](#phase-0--scaffold) | — | App boots, DB migrates, tests run |
| 1 | [ESI Auth](#phase-1--esi-auth) | 0 | Log in with EVE SSO, receive bearer token |
| 2 | [Fleet Creation](#phase-2--fleet-creation) | 1 | FC creates a fleet and gets a join link |
| 3 | [Fleet Join](#phase-3--fleet-join) | 2 | Line member opens join link and enters the room |
| 4 | [Real-time Foundation](#phase-4--real-time-foundation) | 3 | PartyKit room live; members appear/disappear in real time |
| 5 | [Queue](#phase-5--queue) | 4 | Members submit tracks, vote, FC moderates |
| 6 | [Playback](#phase-6--playback) | 5 | FC sets reference track; all clients display Now Playing and can Catch Up |
| 7 | [FC Management](#phase-7--fc-management) | 6 | Full AppShell workspace; kick, delegate, settings |
| 8 | [Background Workers](#phase-8--background-workers) | 7 | Fleets auto-expire; tokens auto-refresh; locations sync |
| 9 | [ESI Gateway Hardening](#phase-9--esi-gateway-hardening) | 8 | Full error budget, ETag caching, throttle tiers |
| 10 | [Scope Gates & Advisory](#phase-10--scope-gates--advisory) | 9 | Scope-gated features prompt reauth; YouTube advisory shown |
| 11 | [Admin](#phase-11--admin) | 10 | Operator dashboard, audit log, force disband |
| 12 | [Hardening & Polish](#phase-12--hardening--polish) | 11 | Rate limiting, error states, structured logging, production deploy |

---

## Phase 0 — Scaffold

**Goal:** Runnable project skeleton with all tooling configured and the database schema applied.

**Milestone:** `npm run dev` serves a page, `npm test` runs (no tests yet but exits clean), `npx prisma migrate dev` applies the full schema.

### Infrastructure
- [ ] `npx create-next-app` — TypeScript, App Router, Tailwind CSS, ESLint
- [ ] Install dependencies from `package.json` (Prisma, BullMQ, PartyKit, pino, vitest, msw, Husky, lint-staged)
- [ ] Configure Tailwind CSS v4 with custom design tokens from `docs/COMPONENT-CONTRACT.md` (color palette, fonts)
- [ ] Install and configure shadcn/ui
- [ ] Run `npx prisma migrate dev --name init` against the dev database
- [ ] Verify `docker compose up -d` starts MySQL and Redis without errors

### Tooling
- [ ] Configure `vitest.config.ts` with coverage thresholds and `vite-tsconfig-paths`
- [ ] Verify Husky pre-commit (lint-staged) and pre-push (npm test) hooks fire on a test commit
- [ ] Verify `.github/workflows/ci.yml` is valid YAML (dry-run with `act` or inspect manually)

### Application foundations
- [ ] `src/lib/errors.ts` — define `AppError` base class and all subclasses (`NotFoundError`, `ForbiddenError`, `NotInFleetError`, `FleetExpiredError`, `EmbeddingDisabledError`, `PlatformMismatchError`, `AlreadyVotedError`, `ScopeNotGrantedError`, `EsiUnavailableError`)
- [ ] `src/lib/logger.ts` — pino logger singleton, log level from `LOG_LEVEL` env var
- [ ] `src/lib/container.ts` — composition root skeleton (populated as services are built)
- [ ] `src/config/scope-gates.ts` — `SCOPE_GATES` constant with all three scope definitions
- [ ] `src/lib/api-response.ts` — helpers for consistent `NextResponse` error serialization from `AppError`

### Verification
- [ ] Health check route `GET /api/v1/health` returns `{ status: 'ok' }` with DB + Redis connectivity flags
- [ ] Test: health check returns 200

---

## Phase 1 — ESI Auth

**Goal:** A user can authenticate via EVE SSO, select scopes, and receive an API bearer token. The session is persisted and validated on subsequent requests.

**Milestone:** Visit `/`, get redirected to EVE SSO, return with a valid session, `GET /api/v1/users/me` returns character info.

**Depends on:** Phase 0

### Infrastructure (`src/infra/esi/`)
- [ ] `EsiHttpClient.ts` — basic `fetch` wrapper with `User-Agent` header. Error handling for 4xx/5xx. **Not** the full error budget implementation yet (Phase 9) — just enough to make calls.
- [ ] `EsiTokenStore.ts` — read/write `EsiToken` rows via Prisma
- [ ] `EsiClient.ts` — initial implementation with two methods only:
  - `exchangeCode(code)` — POST to ESI token endpoint, return `{ accessToken, refreshToken, expiresIn }`
  - `getFleetMembership(characterId)` — `GET /characters/{id}/fleet/`, return `FleetMembership | null`
  - `getCharacter(characterId)` — `GET /characters/{id}/`, return `{ name }`
- [ ] `IEsiClient` interface in `src/infra/esi/types.ts` (two methods above)

### Services (`src/services/`)
- [ ] `AuthService.ts`
  - `beginFlow(scopes, returnUrl)` — store short-lived OAuth state in Redis, build ESI redirect URL
  - `handleCallback(code, state)` — exchange code, decode JWT for characterId, upsert `User` + `EsiToken`, issue `ApiToken`, set cookie
  - `logout(token)` — delete `ApiToken`, clear cookie
- [ ] `UserService.ts`
  - `getMe(characterId)` — return user profile + active sessions
  - `updateScopePreference(characterId, scopes)` — upsert `UserScopePreference`

### Middleware
- [ ] `src/lib/auth-middleware.ts` — validate `ApiToken` from `Authorization` header or `fleetr_token` cookie; attach `characterId` to request context; return `401` if invalid or expired

### API routes
- [ ] `GET /api/v1/auth/scope-selection`
- [ ] `POST /api/v1/auth/begin`
- [ ] `GET /api/v1/auth/callback`
- [ ] `POST /api/v1/auth/logout`
- [ ] `GET /api/v1/users/me`
- [ ] `PATCH /api/v1/users/me/scope-preference`

### UI
- [ ] Login page (`/login`) — EVE SSO button, scope selection screen
- [ ] `/auth/scopes` — scope selection component, three preset tiers, individual toggles, pre-filled from `UserScopePreference`
- [ ] Auth redirect middleware (Next.js `middleware.ts`) — redirect unauthenticated users to `/login`
- [ ] `CharacterAvatar` component (EVE image server portrait)

### Tests
- [ ] `AuthService` — happy path, invalid code, character not found
- [ ] `UserService` — getMe returns active sessions
- [ ] Auth middleware — valid token, expired token, no token, cookie fallback
- [ ] Mock factory: `createMockEsiClient()`

---

## Phase 2 — Fleet Creation

**Goal:** An authenticated FC can verify their EVE fleet role via ESI and create a Fleetr fleet, receiving a shareable join link.

**Milestone:** FC visits `/fleet/create`, connects ESI, creates a fleet, sees the join URL.

**Depends on:** Phase 1

### Services
- [ ] `FleetService.ts`
  - `create(fcCharacterId, mediaSource)` — ESI role check, create `Fleet`, generate `joinToken`, create `Playback` row (empty)
  - `getById(fleetId)` — return fleet info
  - `disband(fleetId, characterId)` — set `disbandedAt`, cancel `queue-advance` BullMQ job if present
  - `regenerateToken(fleetId)` — replace `joinToken`

### API routes
- [ ] `POST /api/v1/fleets`
- [ ] `GET /api/v1/fleets/:id`
- [ ] `DELETE /api/v1/fleets/:id`
- [ ] `POST /api/v1/fleets/:id/token`

### Role guards (`src/lib/guards.ts`)
- [ ] `requireSession(fleetId)` — validates `Session` exists for `(characterId, fleetId)`, attaches role to request
- [ ] `requireFc` — checks role is `FLEET_COMMANDER` or `FC_DELEGATE`
- [ ] `requireOperator` — checks `User.isOperator`

### UI
- [ ] Fleet creation page (`/fleet/create`) — platform selector (YouTube/SoundCloud), submit triggers ESI check
- [ ] Post-creation page — shows join URL, copy button, QR code (optional)
- [ ] Basic FC dashboard (`/fleet/[id]`) — placeholder, shows fleet name and join token

### Tests
- [ ] `FleetService.create` — qualifying FC, non-qualifying role, not in fleet, ESI unavailable
- [ ] `FleetService.disband` — own fleet, wrong character

---

## Phase 3 — Fleet Join

**Goal:** A line member with the join link can authenticate with ESI, pass the membership gate, and enter the fleet room.

**Milestone:** Open `/join/[token]`, log in with EVE SSO, ESI confirms fleet membership, arrive at the fleet room (placeholder page for now).

**Depends on:** Phase 2

### Services
- [ ] `FleetService.join(joinToken, characterId)` — resolve fleet from token, call ESI `getFleetMembership`, verify `esiFleetId` matches, create `Session` with `LINE_MEMBER` role
- [ ] `FleetService.leave(fleetId, characterId)` — delete `Session`

### API routes
- [ ] `POST /api/v1/fleets/:id/join`
- [ ] `DELETE /api/v1/fleets/:id/join`

### UI
- [ ] Join flow (`/join/[token]`) — ESI auth redirect if not logged in, ESI gate in progress state, error states (not in fleet, wrong fleet, fleet expired)
- [ ] `FleetShell` layout — line member single-page room (placeholder content for now)
- [ ] `AppShell` layout — FC workspace shell with sidebar (placeholder apps for now)
- [ ] `ConnectionPill` component — connected/reconnecting/disconnected states
- [ ] Basic `FleetProvider` wired in — session info only, no PartyKit yet

### Tests
- [ ] `FleetService.join` — successful join, not in fleet, wrong fleet, expired fleet, invalid token
- [ ] `FleetService.leave` — happy path

---

## Phase 4 — Real-time Foundation

**Goal:** The PartyKit server is live. Members appear and disappear in real time. Connection status is shown. The FC sees a live member count.

**Milestone:** Two browser windows open on the same fleet — one FC, one line member. Member count increments/decrements in real time. `ConnectionPill` reflects socket state.

**Depends on:** Phase 3

### PartyKit server (`party/index.ts`)
- [ ] `onConnect` — validate bearer token via DB lookup (`ApiToken`), verify `Session` for this room's `fleetId`, store `ConnectionState`, broadcast `member:joined`, send `sync:state` (playback null for now)
- [ ] `onClose` — broadcast `member:left`
- [ ] `onMessage` — route `ClientMessage` union; stub handlers for all types; reject unknown types with `error` message; reject FC-only commands from non-FC connections
- [ ] Internal auth check — validate `PARTYKIT_SECRET` on `/internal/*` calls

### API routes
- [ ] `GET /api/v1/fleets/:id/members` — FC only, return member list
- [ ] `POST /api/v1/internal/fleets/:id/broadcast` — accept `ServerMessage`, forward to PartyKit room

### FleetProvider (`src/providers/FleetProvider.tsx`)
- [ ] Complete HTTP hydration (fleet, session, members for FC)
- [ ] PartyKit socket lifecycle — open, reconnect, `sync:state` dispatch
- [ ] Handle `member:joined`, `member:left`, `member:kicked`, `member:role-changed`
- [ ] `connectionStatus` state driving `ConnectionPill`

### UI
- [ ] `MemberRoster` component — FC only; live list with role badges
- [ ] Member count in `FleetShell` header
- [ ] `StatusDot` / `StatusBadge` components
- [ ] `MetricRow` component

### Tests
- [ ] PartyKit `onConnect` — valid token, invalid token, not in fleet, wrong fleet
- [ ] PartyKit `onMessage` — FC command from line member rejected, unknown type rejected
- [ ] `FleetProvider` reducer — `MEMBER_JOINED`, `MEMBER_LEFT`, `MEMBER_KICKED`

---

## Phase 5 — Queue

**Goal:** Members can submit tracks, vote on them, and see the queue update in real time across all connected clients. FC can remove entries and reorder.

**Milestone:** Submit a YouTube URL — it validates, shows a preview, appears in the queue for all clients. Vote on it — vote count updates everywhere instantly.

**Depends on:** Phase 4

### Infrastructure
- [ ] `src/infra/youtube/YouTubeDataClient.ts` — `IMediaClient` interface; `validateAndFetch(url)` calls `videos.list` with `snippet,contentDetails,status`; extracts `videoId`, title, thumbnail, duration, `status.embeddable`
- [ ] `src/infra/soundcloud/SoundCloudClient.ts` — `IMediaClient` interface; `validateAndFetch(url)` calls oEmbed endpoint; extracts track URL slug, title, thumbnail, duration
- [ ] Mock factories: `createMockYouTubeClient()`, `createMockSoundCloudClient()`

### Services
- [ ] `QueueService.ts`
  - `validate(fleetId, mediaUrl, queue)` — URL format check, platform match, call `IMediaClient`, return metadata or throw typed error
  - `submit(fleetId, characterId, mediaUrl, queue)` — validate, create `QueueEntry` at `position = maxPosition + 1.0`, trigger broadcast
  - `remove(fleetId, entryId, characterId)` — soft delete, trigger broadcast
  - `vote(fleetId, entryId, characterId)` — upsert `Vote`, trigger broadcast
  - `unvote(fleetId, entryId, characterId)` — delete `Vote`, trigger broadcast
  - `reorder(fleetId, entryId, characterId, position)` — update position, trigger broadcast
  - `list(fleetId, queue, limit, offset)` — sorted list with `hasVoted`

### API routes
- [ ] `POST /api/v1/fleets/:id/queue/validate`
- [ ] `POST /api/v1/fleets/:id/queue`
- [ ] `GET /api/v1/fleets/:id/queue`
- [ ] `DELETE /api/v1/fleets/:id/queue/:entryId`
- [ ] `POST /api/v1/fleets/:id/queue/:entryId/vote`
- [ ] `DELETE /api/v1/fleets/:id/queue/:entryId/vote`
- [ ] `PATCH /api/v1/fleets/:id/queue/:entryId`

### PartyKit additions
- [ ] Handle incoming `queue:*` broadcasts from `/internal/broadcast` and forward to room

### FleetProvider additions
- [ ] HTTP queue fetch on mount
- [ ] Handle `queue:entry-added`, `queue:entry-removed`, `queue:vote-updated`, `queue:reordered`
- [ ] `selectActiveQueue` selector wired to mode

### UI
- [ ] `SubmitMediaForm` — URL input, debounced validate-on-paste, metadata preview (title, thumbnail, duration), queue selector, submit button
- [ ] `QueuePanel` — container with `QueueTab` (Cruise/Battle) switcher
- [ ] `QueueList` — sorted list, drag-to-reorder handle visible to FC
- [ ] `QueueEntry` — thumbnail, title, duration, vote count, `VoteButton`, FC remove button
- [ ] `VoteButton` — toggled state, optimistic update
- [ ] `Panel` / `PanelHeader` UI primitives
- [ ] `ProgressBar` component (for track duration display)
- [ ] `FormInput` / `FormSelect` / `Button` / `Tooltip` UI primitives

### Tests
- [ ] `QueueService.validate` — valid YouTube URL, embedding disabled, platform mismatch, invalid URL
- [ ] `QueueService.submit` — creates entry, appends position correctly
- [ ] `QueueService.vote` — creates vote, duplicate vote throws `AlreadyVotedError`
- [ ] `QueueService.unvote` — removes vote, no-op if not voted
- [ ] `QueueService.list` — sorted correctly, `hasVoted` correct
- [ ] Reducer: all `QUEUE_*` actions, sort order maintained

---

## Phase 6 — Playback

**Goal:** The FC can set the fleet reference track, all clients display Now Playing, the queue auto-advances when the track ends, and mode switching interrupts all players.

**Milestone:** FC presses play on a queue entry. All clients show the Now Playing banner. Track ends — auto-advance fires to the next entry. FC switches to Battle mode — all clients interrupt and load the battle queue track.

**Depends on:** Phase 5

### Infrastructure (`src/infra/player/`)
- [ ] `types.ts` — `IEmbedPlayer` interface (already defined in `docs/MEDIA-PLAYERS.md`)
- [ ] `YouTubePlayer.ts` — IFrame API adapter; `load()` with ad-detection timeout heuristic (`AD_LOAD_TIMEOUT_MS = 3000`); emits `load-blocked-by-ad` event
- [ ] `SoundCloudPlayer.ts` — Widget API adapter; note millisecond/second conversion on `seekTo`
- [ ] `createPlayer.ts` — factory; throws for `CUSTOM`

### Services
- [ ] `PlaybackService.ts`
  - `setTrack(fleetId, queueEntryId, initiatedBy)` — upsert `Playback`, schedule `queue-advance` BullMQ job, call internal broadcast
  - `advance(fleetId, initiatedBy)` — find next entry in active queue, call `setTrack`, or clear reference if queue empty
  - `setMode(fleetId, mode, initiatedBy)` — update `Fleet.mode`, cancel existing `queue-advance` job, find top entry of new queue, call `setTrack`, broadcast `fleet:mode-changed` with `nowPlaying`
  - `setVolume(fleetId, volume)` — broadcast `fleet:volume-changed`, no DB write needed (volume is runtime state)
  - `getState(fleetId)` — read `Playback`, compute `fleetOffsetSeconds`

### Workers
- [ ] `src/workers/queue-advance.worker.ts` — full implementation per `docs/WORKERS.md`; guard against stale jobs; handle empty queue; schedule next job

### API routes
- [ ] `GET /api/v1/fleets/:id/playback` — now returns real data
- [ ] `POST /api/v1/internal/fleets/:id/playback`
- [ ] `POST /api/v1/internal/fleets/:id/mode`

### PartyKit additions
- [ ] Handle `fleet:set-track` → call `PlaybackService.setTrack`, broadcast `fleet:now-playing`
- [ ] Handle `fleet:advance` → call `PlaybackService.advance`
- [ ] Handle `fleet:set-volume` → broadcast `fleet:volume-changed`, persist via internal API
- [ ] Handle `fleet:set-mode` → call `PlaybackService.setMode`, broadcast `fleet:mode-changed`

### FleetProvider additions
- [ ] Handle `fleet:now-playing`, `fleet:mode-changed`, `fleet:volume-changed`
- [ ] `SET_MODE` reducer sets `pendingModeSwitch`
- [ ] `selectEffectiveVolume` wired to `volume` + `mode`

### UI
- [ ] `NowPlaying` component — fleet reference display; Catch Up button (seeks to `fleetOffsetSeconds`); battle mode interrupt banner ("⚔ Battle mode — loading after ad"); `load-blocked-by-ad` detection
- [ ] `ModeBar` component — Cruise/Battle toggle (FC only), mode indicator (all)
- [ ] `ModeToggle` component
- [ ] `VolumeIndicator` / `MuteToggle` components
- [ ] `PlaybackController` — local player state machine (`idle`, `loading`, `playing`, `paused`, `ad-pending`); wraps `IEmbedPlayer`; handles `fleet:now-playing` as a Catch Up suggestion; handles `fleet:mode-changed` as mandatory interrupt

### Tests
- [ ] `PlaybackService.setTrack` — upserts Playback, schedules BullMQ job
- [ ] `PlaybackService.setMode` — cancels old job, finds top of new queue, handles empty queue
- [ ] `queue-advance` worker — happy path, stale job guard, empty queue, null duration (no job scheduled)
- [ ] `YouTubePlayer` adapter — `load-blocked-by-ad` fires after timeout, clears when `PLAYING` state received
- [ ] `PlaybackController` — state transitions, mode switch interrupt

---

## Phase 7 — FC Management

**Goal:** The full FC AppShell workspace is complete. FC can kick members, manage delegates, and view settings.

**Milestone:** FC opens the Members app, kicks a member — their client redirects to a "you have been removed" page. FC grants delegate — the delegate's role badge updates in real time.

**Depends on:** Phase 6

### Services
- [ ] `MemberService.ts`
  - `kick(fleetId, targetCharacterId, byCharacterId)` — validate not kicking another FC, delete `Session`, broadcast `member:kicked`, audit log
- [ ] `DelegateService.ts`
  - `grant(fleetId, targetCharacterId, byCharacterId)` — create `FleetDelegate`, update target's Session role, broadcast `member:role-changed`
  - `revoke(fleetId, targetCharacterId, byCharacterId)` — delete `FleetDelegate`, downgrade Session role, broadcast `member:role-changed`

### API routes
- [ ] `DELETE /api/v1/fleets/:id/members/:characterId`
- [ ] `POST /api/v1/fleets/:id/delegates`
- [ ] `DELETE /api/v1/fleets/:id/delegates/:characterId`

### UI
- [ ] Full `AppShell` with `AppSidebar` — app navigation: Now Playing, Members, Queue, Settings
- [ ] `AppWindow` / `AppWindowHeader` / `AppWindowBody` layout components
- [ ] Members app — `MemberRoster` with kick button, delegate toggle; sorted by role
- [ ] Queue Moderation app — same `QueueList` as line member view plus reorder handles, remove buttons
- [ ] Settings app — fleet name display (read-only), join link with copy/regenerate, fleet expiry, disband button
- [ ] Kicked member page — shown when `member:kicked` received for the current user
- [ ] `PlayerPanel` component
- [ ] `StatusBadge` for role display
- [ ] Delegate grant/revoke confirmation flow

### Tests
- [ ] `MemberService.kick` — happy path, cannot kick FC, cannot kick self
- [ ] `DelegateService.grant` — happy path, non-fleet-member target
- [ ] `DelegateService.revoke` — happy path, delegate cannot revoke
- [ ] FleetProvider: `MEMBER_KICKED` redirects current user if own characterId

---

## Phase 8 — Background Workers

**Goal:** Fleets expire automatically, tokens stay fresh, session cleanup runs, and location data appears in the FC roster.

**Milestone:** Create a fleet, let the session idle past `expiresAt` (set to 2 minutes in dev) — the cleanup worker expires it. Open FC roster — connected members show their solar system.

**Depends on:** Phase 7

### Workers
- [ ] `src/workers/fleet-cleanup.worker.ts` — per `docs/WORKERS.md`; cron every 5 minutes
- [ ] `src/workers/session-cleanup.worker.ts` — cron every 15 minutes
- [ ] `src/workers/esi-token-refresh.worker.ts` — cron every 10 minutes; active sessions only; `invalid_grant` handling
- [ ] `src/workers/location-sync.worker.ts` — cron every 30 seconds; skip if error budget < 26

### Worker registry
- [ ] `src/worker.ts` — auto-discovery glob, `WorkerRegistry` startup (already designed in CODING-STANDARDS.md §7); verify all four workers are discovered

### EsiClient additions (minimal — full hardenening in Phase 9)
- [ ] Add `getLocation(characterId)` method for location-sync worker
- [ ] Add `getFleetMembers(fleetId, token)` method for fleet-cleanup orphan check

### PartyKit additions
- [ ] Handle `member:location-updated` broadcasts

### FleetProvider additions
- [ ] Handle `member:location-updated` → `MEMBER_LOCATIONS_UPDATED`

### UI
- [ ] Location display in `MemberRoster` — solar system next to character name; grayed out when null

### Tests
- [ ] `fleet-cleanup` — expires stale fleet, skips active fleet, handles `invalid_grant` on FC token
- [ ] `session-cleanup` — deletes expired sessions, leaves active sessions
- [ ] `esi-token-refresh` — refreshes near-expiry token, handles `invalid_grant`, skips when error budget low
- [ ] `location-sync` — broadcasts locations, skips characters without scope, skips when error budget low
- [ ] Worker registry — all four workers discovered from glob

---

## Phase 9 — ESI Gateway Hardening

**Goal:** The `EsiClient` is promoted from the minimal Phase 1 implementation to the full gateway defined in `docs/ESI-GATEWAY.md`. All ESI calls respect the error budget and return cached responses where valid.

**Milestone:** Simulate an ESI error (return 420 from msw mock) — error budget decrements, the throttle tier kicks in, emergency calls are rejected while non-critical ones are blocked. ETag cache serves a 304 and skips the budget.

**Depends on:** Phase 8 (all ESI callers are built — safe to harden the shared client now)

### Infrastructure (`src/infra/esi/`)
- [ ] `EsiErrorBudget.ts` — read `X-ESI-Error-Limit-Remain` + `X-ESI-Error-Limit-Reset` headers; five throttle tiers (>50 normal, 26–50 warn, 11–25 throttle+500ms, 1–10 emergency reject, 0 halt); stored in Redis
- [ ] `EsiCache.ts` — ETag + `expiresAt` per path in Redis; send `If-None-Match`; on 304 return cached body; hard-gate on `expires` header (never request before)
- [ ] `EsiHttpClient.ts` — promote to full implementation: error budget check before every call, attach ETag header, pass response to `EsiCache`, pass headers to `EsiErrorBudget`, handle `199`/`299` warning headers
- [ ] `EsiClient.ts` — wire up `EsiHttpClient`, `EsiErrorBudget`, `EsiCache`, `EsiTokenStore`; add all remaining methods used by workers and services

### Tests
- [ ] `EsiErrorBudget` — decrements correctly, correct tier per remaining count, resets at `X-ESI-Error-Limit-Reset`
- [ ] `EsiCache` — stores ETag, sends `If-None-Match`, returns cached body on 304, respects `expires`
- [ ] `EsiClient` integration tests with `msw` — 304 response, 420 response, token refresh, `invalid_grant`

---

## Phase 10 — Scope Gates & Advisory

**Goal:** Features that require optional ESI scopes gracefully prompt the user to reauth when the scope is missing. The YouTube Premium advisory is shown to new fleet members.

**Milestone:** Join a fleet without `esi-location.read_location.v1`, open the FC roster — solar system column shows a `ScopePrompt` component with a reauth button. Dismiss the YouTube advisory — it doesn't appear again for 24 hours.

**Depends on:** Phase 9

### Services
- [ ] `AdvisoryService.ts`
  - `shouldShow(characterId, key)` — check `AdvisoryDismissal`; returns false if `permanent` or `lastShownAt` < 24h ago
  - `dismiss(characterId, key, permanent)` — upsert `AdvisoryDismissal`

### Middleware
- [ ] `requireScope(gate)` — middleware factory; reads `session.grantedScopes`; throws `ScopeNotGrantedError` with `gate` payload if scope missing; API layer serializes to `SCOPE_NOT_GRANTED` error response

### API routes
- [ ] `POST /api/v1/users/me/advisories/:key`

### UI
- [ ] `ScopePrompt` component — amber style, non-destructive, dismissable; "Reauthenticate to enable" button triggers reauth flow; scope name and consequence shown
- [ ] Reauth flow — `POST /auth/begin` with `prompt=consent`, `addScope=true`; returns to same page; merges new scope into existing token
- [ ] YouTube advisory banner in `NowPlaying` — check `AdvisoryService.shouldShow` server-side on fleet load; pass result as prop; "I have Premium / I use an ad blocker" (permanent dismiss) + "Dismiss" (24h)
- [ ] Battle mode ad-pending banner wired to advisory dismiss (if user dismisses permanently, also consider suppressing future ad-pending banners for Premium users)

### Tests
- [ ] `AdvisoryService` — shouldShow respects 24h window, permanent flag
- [ ] `requireScope` middleware — missing scope throws, present scope passes through
- [ ] `ScopePrompt` — renders with correct scope info, dismisses, reauth link correct

---

## Phase 11 — Admin

**Goal:** Operators can view system health, see all active fleets, force-disband, manage operator accounts, and query the audit log.

**Milestone:** Log in as the seeded Operator, visit `/admin` — stats dashboard shows live fleet count, ESI error budget, DB/Redis status. Find a test fleet, force-disband it.

**Depends on:** Phase 10

### Seed script
- [ ] `prisma/seed.ts` — create first `User` + set `isOperator = true` for a character ID passed via env var (`SEED_OPERATOR_CHARACTER_ID`)

### Services
- [ ] `AdminService.ts`
  - `getStats()` — active fleet count, connected member count (from PartyKit or Redis), ESI error budget, DB/Redis ping
  - `listFleets(limit, offset)` — all active fleets with member counts
  - `forceDisband(fleetId, operatorId)` — call `FleetService.disband`, audit log with `OPERATOR_FORCE_DISBAND` event
  - `grantOperator(targetCharacterId, grantedBy)` — set `isOperator = true`, audit log
  - `revokeOperator(targetCharacterId, revokedBy)` — set `isOperator = false`, audit log
  - `getAuditLog(filters, limit, offset)` — paginated query on `AuditLog`

### API routes
- [ ] `GET /api/v1/admin/stats`
- [ ] `GET /api/v1/admin/fleets`
- [ ] `DELETE /api/v1/admin/fleets/:id`
- [ ] `GET /api/v1/admin/audit`
- [ ] `POST /api/v1/admin/operators`
- [ ] `DELETE /api/v1/admin/operators/:characterId`

### UI
- [ ] Admin layout (`/admin/*`) — protected by `requireOperator`
- [ ] Stats dashboard — live metrics, refresh button
- [ ] Fleet list — active fleets table with member count, FC name, media source, force-disband button
- [ ] Audit log — paginated table with event, actor, timestamp, payload preview; filter by event type

### Tests
- [ ] `AdminService.getStats` — returns all expected fields
- [ ] `AdminService.forceDisband` — calls FleetService.disband, writes audit event
- [ ] `requireOperator` guard — non-operator returns 403

---

## Phase 12 — Hardening & Polish

**Goal:** Production-ready. Rate limiting, consistent error states across the UI, structured logging throughout, and a production Docker Compose.

**Milestone:** CI passes on all platforms. Running `docker compose -f docker-compose.prod.yml up` serves the app behind a reverse proxy. Load testing shows no crashes under 100 concurrent fleet members.

**Depends on:** Phase 11

### API hardening
- [ ] Rate limiting — `queue submit`: max 3 per minute per character per fleet; `vote`: max 30 per minute; implement in middleware using Redis sliding window counter
- [ ] Request validation — `zod` schemas for all request bodies; 422 with field-level errors on failure
- [ ] Consistent `AppError` → HTTP response serialization for all uncaught errors; 500 with `requestId` for unexpected errors

### Logging
- [ ] Pino structured logging in all services — `logger.info/warn/error` with context (`fleetId`, `characterId`, `requestId`)
- [ ] Request logging middleware — log method, path, status, duration for all API requests
- [ ] Worker logging — log job start, completion, and failure with job metadata

### UI polish
- [ ] Loading states — skeleton screens for queue load, member roster load
- [ ] Error boundaries — fleet room error boundary shows reconnect prompt rather than blank screen
- [ ] Empty states — empty queue (both queues empty), no members, fleet not found
- [ ] Responsive layout audit — FleetShell usable on 1280px (EVE client windowed mode)

### Production infrastructure
- [ ] `docker-compose.prod.yml` — app service, worker service, PartyKit service, MySQL, Redis, nginx reverse proxy
- [ ] `docs/DEPLOYMENT.md` — production setup guide, env var checklist, first-run Operator bootstrap, nginx config snippet, SSL

### Security
- [ ] Review all API routes for missing auth guards
- [ ] Verify no raw `characterId` values are trusted from request bodies without session validation
- [ ] ESI `User-Agent` header present on every call (verified by test)
- [ ] `Content-Security-Policy` header allowing YouTube/SoundCloud embed domains

### Tests
- [ ] Rate limiter — request count increments, limit triggers 429, window resets
- [ ] Integration smoke test — full join flow: create fleet, join as member, submit track, vote, verify queue sorted

---

## Cross-cutting notes

### Testing approach per phase
Each phase's tests are written alongside the code, not after. The pattern:
1. Write the service/infrastructure unit tests first (mock factories for dependencies)
2. Implement the service until tests pass
3. Write API route tests (test the handler with a mock service)
4. Write the integration test for any non-trivial path (msw for ESI, real DB for complex queries)

### Database migrations
Each phase that introduces schema changes runs `prisma migrate dev --name {phase-name}`. The schema file is already complete — migrations are the incremental application of it. No schema changes should be needed mid-phase if the full schema is used from the start.

### AppError hierarchy (Phase 0)
Every service throws typed `AppError` subclasses. The API layer catches them in a single error handler and serializes to the structured error format from `docs/API-CONTRACT.md §2.4`. Never add inline `try/catch` for known error types in route handlers — let them propagate.

### PartyKit development
Run `npx partykit dev` throughout development. The PartyKit server in `party/index.ts` is built incrementally — each phase adds handlers for the message types introduced in that phase. Stub all unimplemented `ClientMessage` types with a `{ type: 'error', code: 'NOT_IMPLEMENTED' }` response so they fail loudly rather than silently.
