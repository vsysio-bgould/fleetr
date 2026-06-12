# Fleetr Access Control

> Defines the three privilege levels, how each is established, what each can do, and how the system enforces the boundaries between them.

---

## 1. Access Levels

| Level | Who | Established by |
|-------|-----|----------------|
| **Line Member** | Any EVE pilot with the fleet join link | Shared join link + ESI fleet membership check |
| **Fleet Commander** | Fleet Boss or Fleet Command position holder; optionally delegated | Fleet creation in Fleetr + ESI role verification |
| **Operator** | Fleetr system administrators | DB flag set out-of-band by another Operator |

---

## 2. Line Member

### 2.1 Who qualifies

Any EVE Online pilot who:

1. Holds the fleet join link (issued by the FC when the fleet is created in Fleetr), **and**
2. Is currently a member of that fleet in EVE at the time they join.

### 2.2 Authentication flow

The ESI check is a **one-time join gate** — it confirms the pilot is currently in the correct fleet before granting them a session. It is not repeated after the session is established.

```
1. Pilot opens the join link: /join/{token}
2. Fleetr redirects to EVE SSO (ESI OAuth) requesting esi-fleets.read_fleet.v1
3. On callback, Fleetr calls GET /characters/{characterId}/fleet/ with the pilot's access token
4. Fleetr verifies:
   a. The returned fleet_id matches the fleet attached to {token}
   b. The token is not expired
5. On success, a line member session is created and the pilot enters the fleet room
6. On failure (not in fleet, wrong fleet, ESI error), access is denied with a clear reason
```

The ESI token is not retained after the join check. The session is the authority from this point forward.

### 2.3 Capabilities

| Action | Line Member |
|--------|:-----------:|
| Watch the shared player | ✅ |
| Submit a YouTube URL to a queue | ✅ |
| Vote on queue entries | ✅ |
| Toggle personal mute | ✅ |
| Switch fleet mode (Cruise/Battle) | ❌ |
| Remove queue entries | ❌ |
| Kick members | ❌ |
| View fleet settings | ❌ |
| Access Operator stats | ❌ |

---

## 3. Fleet Commander

### 3.1 Who qualifies

A pilot qualifies for FC-level access in Fleetr if, at the time they register their fleet, EVE ESI reports their fleet role as one of:

- `fleet_commander` (Fleet Boss — the pilot who created the fleet in EVE)
- `wing_commander` in the **top-level wing** (Wing 1), **or**
- `squad_commander` in the **top-level squad of the top-level wing** (Wing 1, Squad 1)

The intent is to restrict automatic FC qualification to the command hierarchy at the top of the fleet, not to all wing and squad commanders. A pilot holding a squad commander slot in Wing 3 does not automatically qualify.

Alternatively, any pilot can be granted FC access by delegation (§3.4).

### 3.2 Fleet creation flow

```
1. FC creates a fleet in EVE Online
2. FC opens Fleetr and selects "Create Fleet"
3. Fleetr redirects to EVE SSO requesting esi-fleets.read_fleet.v1
4. On callback, Fleetr calls GET /characters/{characterId}/fleet/ with the FC's token
5. Fleetr verifies:
   a. The character is currently in a fleet
   b. Their role is fleet_commander, OR they hold Wing/Squad Commander at position [1,1]
6. Fleetr creates the Fleet record, stores the fleetId from ESI, and creates a join link
7. The FC's session is upgraded to fleet_commander role for this fleet
```

The FC's ESI refresh token is stored against the fleet record. It is used to periodically re-verify fleet existence and to read the member list for join validation (see §2.2).

### 3.3 Delegation

FCs may grant FC-level access in Fleetr to other pilots currently in the fleet. Delegation is:

- **Per-fleet**: a delegation applies only to the fleet it was granted for.
- **Stored in Fleetr**: the delegate's `characterId` is stored in the `FleetDelegate` table. No ESI role check is performed when a delegate connects — the Fleetr record is authoritative.
- **Revocable**: the FC can revoke delegation at any time via the Settings app. Revocation takes effect immediately — the delegate's session is downgraded on their next action.
- **Non-transferable**: delegates cannot grant delegation to other pilots.

```prisma
model FleetDelegate {
    id          String   @id @default(uuid())
    fleetId     String
    characterId Int
    grantedBy   Int      // FC characterId who granted this
    grantedAt   DateTime @default(now())
    fleet       Fleet    @relation(fields: [fleetId], references: [id])

    @@unique([fleetId, characterId])
    @@index([fleetId])
}
```

### 3.4 Capabilities

| Action | Fleet Commander |
|--------|:--------------:|
| Everything a Line Member can do | ✅ |
| Switch fleet mode (Cruise/Battle) | ✅ |
| Skip the current track | ✅ |
| Remove queue entries | ✅ |
| Kick members from the Fleetr room | ✅ |
| View full member roster | ✅ |
| View fleet settings | ✅ |
| Edit fleet settings (name, expiry) | ✅ |
| Grant/revoke FC delegation | ✅ |
| Regenerate the join link | ✅ |
| Disband the fleet in Fleetr | ✅ |
| Access Operator stats | ❌ |

---

## 4. Operator

### 4.1 Who qualifies

Operators are Fleetr system administrators. The role is granted directly in the database — it has no EVE Online dependency.

The first Operator must be bootstrapped manually (seed script or direct DB insert). Subsequent Operators are granted by an existing Operator via the admin interface.

```prisma
model User {
    characterId Int      @id
    // ...
    isOperator  Boolean  @default(false)
}
```

### 4.2 Authentication

Operators authenticate via EVE SSO the same way as any other user. The `isOperator` flag on the `User` record elevates their session. ESI scopes are not expanded — the Operator role is a Fleetr-level privilege, not an EVE privilege.

### 4.3 Capabilities

| Action | Operator |
|--------|:--------:|
| Everything a Fleet Commander can do (for any fleet) | ✅ |
| View system stats dashboard | ✅ |
| View all active fleets | ✅ |
| Force-disband any fleet | ✅ |
| Grant/revoke Operator status | ✅ |
| View audit log | ✅ |

The stats dashboard includes: active fleet count, connected member count, queue depths, PartyKit room health, ESI token refresh failure rate, and DB/Redis connectivity.

### 4.4 Operator routes

Operator-only pages are grouped under `/admin/*` and protected by a single `requireOperator` middleware applied at the router level — not inline in individual handlers.

---

## 5. Session Model

| Property | Line Member | Fleet Commander | Operator |
|----------|-------------|-----------------|----------|
| Session storage | DB (`Session` table) | DB (`Session` table) | DB (`Session` table) |
| Role field | `line_member` | `fleet_commander` or `fc_delegate` | `line_member` / `fleet_commander` + `isOperator: true` |
| ESI scope required | `esi-fleets.read_fleet.v1` | `esi-fleets.read_fleet.v1` | same as base role |
| Session expiry | Fleet expiry or explicit kick | Fleet expiry or FC disbands | Standard session timeout |

Sessions are scoped to a fleet. A pilot may have multiple active sessions across different fleets (one session per fleet room). Each session carries `{ characterId, fleetId, role }`.

---

## 6. ESI Scope Requirements

| Scope | Required | Used by | Purpose |
|-------|:--------:|---------|---------|
| `esi-fleets.read_fleet.v1` | **Yes** | All users | Verify fleet membership; read fleet role for FC check |
| `esi-location.read_location.v1` | No | All users (optional) | Show member locations in FC roster |
| `esi-fleets.write_fleet.v1` | No | FCs only (optional) | Sync Fleetr kicks to EVE fleet; set fleet MOTD |

Users choose which optional scopes to grant during the ESI auth flow via a scope selection screen. See [ESI-SCOPES.md](ESI-SCOPES.md) for the full scope registry, the three auth tiers (Minimum / Recommended / All), how preferences are remembered, and how scope-gated features are surfaced when a user accesses something they didn't grant access to.

Fleetr does not request and will never request wallet, assets, contacts, mail, market, or corporation scopes.

---

## 7. Enforcement Rules

### 7.1 API layer

Every protected route uses a middleware guard — no inline role checks in handlers:

```typescript
// ✅ Correct — guard applied to router
const fcRouter = new Router();
fcRouter.use(requireSession);     // 401 if no session
fcRouter.use(requireFc);          // 403 if not fc or fc_delegate

// ❌ Wrong — inline check in handler
export const POST = apiHandler(async (req) => {
    const session = await getSession(req);
    if (session.role !== 'fleet_commander') return forbidden();
    // ...
});
```

### 7.2 PartyKit layer

FC-only messages (`fleet:set-mode`, `playback:seek`, queue remove) are validated in `onMessage` against `conn.state.role`. If the role check fails, the connection receives an error message and the action is not applied. The check is in addition to — not instead of — the API-layer guard.

### 7.3 UI layer

Role-gated components are not rendered for users who don't hold the required role. CSS hiding (`hidden`, `invisible`) is not used for access control — components are conditionally included in the tree by the parent layout.

### 7.4 Deny by default

Any route or socket action not explicitly permitted for a role returns 403. The default posture is deny.

---

## 8. Privilege Escalation Prevention

- **Join tokens are single-use per session**: a token authenticates one pilot. Sharing a token after use does not grant the second pilot access — they must complete ESI auth separately against the token.
- **FC role is verified at creation time and on reconnect**: holding the join link does not grant FC access. ESI role must confirm it.
- **Delegates cannot sub-delegate**: the `grantedBy` field is checked — only the original FC (or another FC-role holder) may write to `FleetDelegate`.
- **Operator status is not self-grantable**: `isOperator` can only be set by an existing Operator through the admin interface. The `requireOperator` guard is applied before the grant endpoint.
- **Fleet scoping**: FC and delegate sessions are scoped to a specific `fleetId`. An FC of Fleet A has no elevated access to Fleet B.

---

## 9. Audit Events

| Event | Logged data |
|-------|-------------|
| Member joined fleet room | characterId, fleetId, ip |
| Member removed from room | characterId, fleetId, reason (left / kicked / ESI check failed) |
| FC created fleet | characterId, fleetId, esiFleetId |
| FC disbanded fleet | characterId, fleetId |
| Delegation granted | fleetId, granteCharacterId, grantedBy |
| Delegation revoked | fleetId, targetCharacterId, revokedBy |
| Operator granted | targetCharacterId, grantedBy |
| Operator revoked | targetCharacterId, revokedBy |
| Privilege escalation attempt | characterId, attemptedAction, role, ip |
