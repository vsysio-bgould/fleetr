# Fleetr — Remaining Work

> Gap analysis performed 2026-06-11 after completing the 12-phase backend build-out.
> Backend is ~85% complete. UI is 0% complete. Infrastructure is partial.
> This document replaces the original IMPLEMENTATION-PLAN.md as the active task list.

---

## Status Legend
- ✅ Done
- 🔧 Needs fix/completion
- ❌ Not started

---

## Track A — Backend Completion
*Small, targeted fixes to the already-built backend. Do these first — they unblock UI development and fix incorrect behavior.*

### A1 — Missing Routes & Methods

| Item | File | Notes |
|---|---|---|
| ❌ `GET /api/v1/fleets/:id` | `app/api/v1/fleets/[fleetId]/route.ts` | Add GET handler alongside existing DELETE |
| ❌ `POST /api/v1/internal/fleets/:id/mode` | new route | `PlaybackService.setMode` internal trigger |
| ❌ `GET /api/v1/admin/stats` | new route | `AdminService.getStats()` |
| ❌ `DELETE /api/v1/admin/fleets/:id` | new route | Alias for force-disband, plan uses DELETE not POST |
| ❌ `DELETE /api/v1/admin/operators/:characterId` | new route | Currently only POST exists |
| ❌ `GET /api/v1/auth/scope-selection` | new route | Returns available scope tiers + stored preference |

### A2 — Service Fixes

| Item | File | Fix needed |
|---|---|---|
| 🔧 `MemberService.kick` | `src/services/MemberService.ts` | Add audit log write + PartyKit `member:kicked` broadcast |
| 🔧 `DelegateService.grant` | `src/services/DelegateService.ts` | Add `member:role-changed` broadcast |
| 🔧 `DelegateService.revoke` | `src/services/DelegateService.ts` | Add `member:role-changed` broadcast |
| 🔧 `PlaybackService` | `src/services/PlaybackService.ts` | Add `setVolume(fleetId, volume)` — broadcast only, no DB |
| 🔧 `AdminService` | `src/services/AdminService.ts` | Add `getStats()` — active fleet count, ESI budget, DB/Redis ping |
| 🔧 `AdvisoryService.list` | `src/services/AdvisoryService.ts` | Add 24h recency gate to `list()` (currently returns all non-permanently dismissed) |

### A3 — ESI Client Completion

| Item | File | Notes |
|---|---|---|
| ❌ `EsiClient.getLocation(characterId, token)` | `src/infra/esi/EsiClient.ts` | `GET /characters/{id}/location/` — needed by location-sync worker |
| ❌ `EsiClient.getFleetMembers(fleetId, token)` | `src/infra/esi/EsiClient.ts` | `GET /fleets/{id}/members/` — needed by fleet-cleanup orphan check |
| 🔧 `EsiErrorBudget` tiers | `src/infra/esi/EsiErrorBudget.ts` | Only 2 tiers. Plan specifies 5: >50 normal, 26–50 warn, 11–25 throttle+500ms delay, 1–10 emergency reject, 0 halt |
| 🔧 `esi-token-refresh.worker` | `src/workers/esi-token-refresh.worker.ts` | Handle `invalid_grant` — delete token, do not retry |
| 🔧 `location-sync.worker` | `src/workers/location-sync.worker.ts` | Full impl: call `getLocation`, broadcast `member:location-updated`, skip when error budget < 26 |

### A4 — Hardening Wiring
*The rate limiter and body validator are written but wired to zero routes.*

| Route | Rate limit | Body schema |
|---|---|---|
| `POST /api/v1/fleets/:id/queue` | `RATE_LIMITS.queueSubmit` | `{ mediaUrl: string, queue: QueueType }` |
| `POST /api/v1/fleets/:id/queue/:id/vote` | `RATE_LIMITS.vote` | — |
| `POST /api/v1/auth/begin` | `RATE_LIMITS.auth` | `{ scopes: string[], returnUrl?: string }` |
| `POST /api/v1/fleets` | `RATE_LIMITS.fcAction` | `{ mediaSource: MediaSource }` |

---

## Track B — UI Implementation
*The entire React frontend. Zero components currently exist.*

### B1 — Foundation (prerequisite for all other UI)

| Item | Path | Notes |
|---|---|---|
| ❌ Auth redirect middleware | `middleware.ts` | Extend existing request-ID middleware to also redirect unauthenticated to `/login` |
| ❌ Login page | `app/(auth)/login/page.tsx` | EVE SSO button only |
| ❌ Scope selection page | `app/(auth)/scopes/page.tsx` | Three preset tiers + individual toggles, pre-filled from stored preference |
| ❌ UI primitives | `src/components/ui/` | `Button`, `Badge`, `Input`, `Label`, `Skeleton`, `Tooltip`, `Dialog` — wire shadcn/ui |
| ❌ `CharacterAvatar` | `src/components/CharacterAvatar.tsx` | EVE image server portrait |
| ❌ `ConnectionPill` | `src/components/ConnectionPill.tsx` | connected/reconnecting/disconnected |

### B2 — Fleet Creation & Join

| Item | Path | Notes |
|---|---|---|
| ❌ Fleet create page | `app/(fleet)/fleet/create/page.tsx` | Platform selector, submit → ESI check |
| ❌ Fleet created page | `app/(fleet)/fleet/[id]/created/page.tsx` | Join URL, copy button |
| ❌ Join flow | `app/(fleet)/join/[token]/page.tsx` | ESI gate, error states (not in fleet, expired, wrong fleet) |

### B3 — Shell Layouts

| Item | Path | Notes |
|---|---|---|
| ❌ `FleetShell` | `src/components/layout/FleetShell.tsx` | Line member single-page room |
| ❌ `AppShell` | `src/components/layout/AppShell.tsx` | FC workspace with sidebar nav |
| ❌ `AppSidebar` | `src/components/layout/AppSidebar.tsx` | Now Playing / Members / Queue / Settings nav |
| ❌ `AppWindow` | `src/components/layout/AppWindow.tsx` | App content area with header/body |

### B4 — Real-time Member UI

| Item | Path | Notes |
|---|---|---|
| ❌ `MemberRoster` | `src/components/MemberRoster.tsx` | Live list, role badges, kick + delegate buttons (FC) |
| ❌ `StatusBadge` | `src/components/StatusBadge.tsx` | LINE_MEMBER / FC_DELEGATE / FLEET_COMMANDER |
| ❌ `MetricRow` | `src/components/MetricRow.tsx` | Label + value layout primitive |
| 🔧 `FleetProvider` | `src/providers/FleetProvider.tsx` | Wire `fleet:now-playing`, `fleet:mode-changed`, `fleet:volume-changed`; `MEMBER_KICKED` self-redirect; `MEMBER_LOCATIONS_UPDATED` |

### B5 — Queue UI

| Item | Path | Notes |
|---|---|---|
| ❌ `SubmitMediaForm` | `src/components/queue/SubmitMediaForm.tsx` | URL input, debounced validate-on-paste, metadata preview, queue selector |
| ❌ `QueuePanel` | `src/components/queue/QueuePanel.tsx` | Tab switcher (Cruise/Battle), contains QueueList |
| ❌ `QueueList` | `src/components/queue/QueueList.tsx` | Sorted list; FC gets drag handles + remove buttons |
| ❌ `QueueEntry` | `src/components/queue/QueueEntry.tsx` | Thumbnail, title, duration, vote count, vote button |
| ❌ `VoteButton` | `src/components/queue/VoteButton.tsx` | Toggled state, optimistic update |
| ❌ `ProgressBar` | `src/components/ProgressBar.tsx` | Duration display |

### B6 — Playback UI

| Item | Path | Notes |
|---|---|---|
| ❌ `YouTubePlayer.ts` | `src/infra/player/YouTubePlayer.ts` | IFrame API adapter; ad-detection timeout heuristic (3s); emits `load-blocked-by-ad` |
| ❌ `SoundCloudPlayer.ts` | `src/infra/player/SoundCloudPlayer.ts` | Widget API adapter; ms→s conversion on seekTo |
| ❌ `createPlayer.ts` | `src/infra/player/createPlayer.ts` | Factory; throws for CUSTOM |
| ❌ `NowPlaying` | `src/components/playback/NowPlaying.tsx` | Fleet reference display, Catch Up button, ad-pending banner |
| ❌ `ModeBar` | `src/components/playback/ModeBar.tsx` | Cruise/Battle toggle (FC), mode indicator (all) |
| ❌ `VolumeIndicator` | `src/components/playback/VolumeIndicator.tsx` | Slider + mute toggle |
| ❌ `PlaybackController` | `src/components/playback/PlaybackController.tsx` | Local player state machine; wraps IEmbedPlayer |

### B7 — FC Apps & Settings

| Item | Path | Notes |
|---|---|---|
| ❌ Members app | `src/components/apps/MembersApp.tsx` | Full roster with kick/delegate controls |
| ❌ Queue Moderation app | `src/components/apps/QueueModerationApp.tsx` | QueueList + reorder + FC remove |
| ❌ Settings app | `src/components/apps/SettingsApp.tsx` | Join link copy/regenerate, fleet expiry, disband |
| ❌ Kicked page | `src/components/KickedScreen.tsx` | Shown when `member:kicked` received for current user |

### B8 — Scope & Advisory UI

| Item | Path | Notes |
|---|---|---|
| ❌ `ScopePrompt` | `src/components/ScopePrompt.tsx` | Amber style, dismissable, reauth CTA |
| ❌ YouTube advisory banner | `src/components/AdvisoryBanner.tsx` | In NowPlaying; permanent/24h dismiss |

### B9 — Admin UI

| Item | Path | Notes |
|---|---|---|
| ❌ Admin layout | `app/(admin)/admin/layout.tsx` | requireOperator gate |
| ❌ Stats dashboard | `app/(admin)/admin/page.tsx` | Live metrics, ESI budget, fleet/member counts |
| ❌ Fleet list | `app/(admin)/admin/fleets/page.tsx` | Sortable table, force-disband button |
| ❌ Audit log | `app/(admin)/admin/audit/page.tsx` | Paginated, filterable by event |

---

## Track C — Infrastructure

| Item | Notes |
|---|---|
| ❌ `docker-compose.prod.yml` | app + worker + partykit + mysql + redis + nginx |
| ❌ `.github/workflows/ci.yml` | lint → typecheck → test on push/PR |
| ❌ `docs/DEPLOYMENT.md` | env checklist, first-run bootstrap, nginx config |
| ❌ CSP header | Allow YouTube + SoundCloud embed domains in `next.config.mjs` |
| ❌ Prisma migrations | Run `prisma migrate dev --name init` to create migration history |

---

## Recommended Execution Order

```
A1 → A2 → A3 → A4   (backend complete, ~2–3 hours)
B1 → B2 → B3 → B4   (auth + shells + members, ~4–6 hours)
B5 → B6              (queue + playback, ~4–6 hours)
B7 → B8 → B9         (FC apps + advisory + admin, ~3–4 hours)
C                    (infrastructure, ~2 hours)
```

The backend tracks (A1–A4) should be done before UI work begins so that UI
components have real APIs to call. B1–B3 can proceed while B4+ are being built
since the shell layouts don't depend on queue or playback.
