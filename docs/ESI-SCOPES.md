# Fleetr ESI Scope Selection

> Defines which ESI scopes Fleetr uses, what each enables, the three auth tiers, how scope preferences are remembered, and how the app handles features that require scopes the user did not grant.

---

## 1. Scope Registry

Fleetr requests a small, declared set of ESI scopes. Each scope is described honestly — what it gives Fleetr access to, what features it enables, and what the user loses by declining it.

| Scope | What it accesses | Features enabled | Required |
|-------|-----------------|-----------------|:--------:|
| `esi-fleets.read_fleet.v1` | Your current fleet: fleet ID, your role (fleet boss / wing commander / etc.), wing and squad position, and — for FCs — the full member list | Fleet join verification; FC role check at fleet creation; FC member roster | **Yes** |
| `esi-location.read_location.v1` | Your current solar system | Location display next to each member in the FC roster (e.g. "Jita IV") | No |
| `esi-fleets.write_fleet.v1` | Modify fleet settings: kick members, update MOTD, move members between wings/squads | Sync Fleetr kicks to EVE fleet; auto-set fleet MOTD to the Fleetr join link | No |

### Scope notes

- `esi-fleets.read_fleet.v1` is the only scope that cannot be deselected. Declining it means Fleetr cannot verify your fleet membership or your FC role — the application cannot function.
- `esi-fleets.write_fleet.v1` is only presented to FCs during fleet creation. Line members are never asked for write access.
- Fleetr does not request and will never request wallet, assets, contacts, mail, market, or corporation scopes.

---

## 2. Auth Tiers

Three preset selections are offered on the scope selection screen. Users may also toggle individual scopes manually before confirming.

### Allow Minimum

The smallest scope set that allows Fleetr to function.

**Line members:** `esi-fleets.read_fleet.v1`

**FCs:** `esi-fleets.read_fleet.v1`

What you lose:
- Member locations not shown in roster
- Fleetr kicks do not sync to EVE fleet
- Fleet MOTD is not automatically set to the join link

### Allow Recommended *(default)*

Adds location awareness. No write access is requested.

**Line members:** `esi-fleets.read_fleet.v1` + `esi-location.read_location.v1`

**FCs:** `esi-fleets.read_fleet.v1` + `esi-location.read_location.v1`

What you lose compared to Allow All:
- Fleetr kicks do not sync to EVE fleet
- Fleet MOTD is not automatically set (FC only)

### Allow All

Full scope set. FCs get write access; line members do not.

**Line members:** `esi-fleets.read_fleet.v1` + `esi-location.read_location.v1`

**FCs:** All three scopes

---

## 3. Scope Selection UI

The scope selection screen is shown during the ESI OAuth flow, before the redirect to EVE SSO. It is rendered at `/auth/scopes` and receives the in-progress auth state via a short-lived token.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  CONNECT YOUR EVE CHARACTER                                     │
│  Choose what Fleetr can access. You can change this later.      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅  Fleet Membership (required)                                │
│      Reads your current fleet and role.                         │
│      Without this, you cannot use Fleetr.                       │
│                                                                 │
│  ☑   Location                                                   │
│      Reads your current solar system.                           │
│      Without this, your location won't appear in the FC roster. │
│                                                                 │
│  ☑   Fleet Management  ← FC only                               │
│      Lets Fleetr kick members from your EVE fleet and set the  │
│      fleet MOTD. Without this, Fleetr and EVE are separate.     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [ Allow All ]   [ Allow Recommended ]   [ Allow Minimum ]      │
│                                                                 │
│                        [ Continue with EVE SSO → ]             │
└─────────────────────────────────────────────────────────────────┘
```

### Rules

- The required scope (`esi-fleets.read_fleet.v1`) renders as checked and disabled — it cannot be deselected.
- `esi-fleets.write_fleet.v1` is only rendered for users entering the FC creation flow. It is never shown to users joining as a line member.
- **Allow Recommended** is the default state when the screen first loads (or when the user has no prior preference on record).
- If the user has a stored scope preference (§4), load that preference instead of the default.
- The three preset buttons update the checkboxes immediately — the user can still adjust individual scopes after pressing a preset.
- The "Continue" button builds the scope string from the checked boxes and initiates the EVE SSO redirect.

---

## 4. Remembering Scope Preferences

When the user completes authentication, their scope selection is persisted so that future logins pre-fill their preference.

```prisma
model UserScopePreference {
    characterId Int      @id
    scopes      Json     // string[] — the scopes the user last selected
    updatedAt   DateTime @updatedAt
}
```

### Behaviour

- On the scope selection screen, if a `UserScopePreference` exists for this character, load it as the initial checkbox state instead of Recommended.
- The preference is updated every time the user completes an auth flow.
- The preference is a hint for UX only — the authoritative record of what scopes are actually granted is the JWT returned by EVE SSO (see §5).

---

## 5. Determining Granted Scopes

After EVE SSO returns an access token, Fleetr decodes the JWT to read the `scp` claim, which lists the scopes that were actually granted. This is the authoritative source — the user may have modified their selection on CCP's consent screen.

```typescript
// After token exchange, decode the JWT
const jwt = decodeJwt(accessToken); // no verification needed here — EsiClient verifies signature
const grantedScopes: string[] = Array.isArray(jwt.scp) ? jwt.scp : [jwt.scp ?? ''];

// Store against the session
await db.session.update({
    where: { id: sessionId },
    data: { grantedScopes },
});
```

Granted scopes are stored on the session and checked at runtime when scope-gated features are accessed.

---

## 6. Scope-Gated Features

When a user navigates to a feature that requires a scope they did not grant, Fleetr surfaces this rather than failing silently.

### 6.1 Scope gate definition

Each scope-gated feature declares its requirement as a constant:

```typescript
// src/config/scope-gates.ts
export const SCOPE_GATES = {
    memberLocations: {
        scope: 'esi-location.read_location.v1',
        featureName: 'Member Locations',
        description: 'Shows each member\'s current solar system in the fleet roster.',
        consequence: 'Member locations will not be displayed.',
    },
    fleetWrite: {
        scope: 'esi-fleets.write_fleet.v1',
        featureName: 'Fleet Sync',
        description: 'Syncs Fleetr kicks to your EVE fleet and sets the fleet MOTD.',
        consequence: 'Fleetr and EVE fleet management will be independent.',
    },
} as const satisfies Record<string, ScopeGate>;
```

### 6.2 UI prompt

When a user accesses a gated feature without the required scope, a non-blocking inline prompt appears in place of the feature content. It does not redirect or interrupt the current session.

```
┌──────────────────────────────────────────────────────┐
│  Member Locations requires additional access         │
│                                                      │
│  This feature reads your current solar system to     │
│  display member locations in the fleet roster.       │
│                                                      │
│  You did not grant this scope when you logged in.    │
│                                                      │
│  [ Reauthenticate to enable ]    [ Dismiss ]         │
└──────────────────────────────────────────────────────┘
```

"Dismiss" hides the prompt for the remainder of the session. The user's existing session and fleet room access are not affected.

### 6.3 Reauthentication flow

Clicking "Reauthenticate to enable" starts a new auth flow with the additional scope added to the existing granted set:

```typescript
function buildReauthUrl(currentScopes: string[], additionalScope: string): string {
    const requestedScopes = [...new Set([...currentScopes, additionalScope])];
    return buildEsiAuthUrl(requestedScopes, { prompt: 'consent' });
}
```

On completion:
1. The new access token (with expanded scopes) replaces the current session token.
2. The session's `grantedScopes` is updated.
3. `UserScopePreference` is updated with the new selection.
4. The user is returned to where they were — not to the home page.

The `prompt: 'consent'` parameter is included in the redirect so EVE SSO always shows the consent screen, even if the user previously approved some of these scopes. This ensures the user sees and confirms the expanded access.

### 6.4 Scope check helper

```typescript
// src/lib/scopes.ts
export function hasScope(session: Session, scope: string): boolean {
    return session.grantedScopes.includes(scope);
}

export function requireScope(session: Session, gate: ScopeGate): void {
    if (!hasScope(session, gate.scope)) {
        throw new ScopeNotGrantedError(gate);
    }
}
```

`ScopeNotGrantedError` is caught at the API boundary and returned as a structured response the client uses to render the prompt (§6.2):

```typescript
// 403 response shape when a scope gate is not met
{
    "error": "SCOPE_NOT_GRANTED",
    "scope": "esi-location.read_location.v1",
    "featureName": "Member Locations",
    "description": "...",
    "consequence": "..."
}
```

---

## 7. Scope Prompt Component

The scope prompt renders via a dedicated UI component defined in the component contract.

**`ScopePrompt`** — inline prompt for scope-gated features.

Props: `gate: ScopeGate`, `onReauth: () => void`, `onDismiss: () => void`

Tailwind:

```
rounded border border-[#253140] bg-[#0f141a] p-4 space-y-2 text-[13px]
```

- Title: `text-sm font-display font-semibold uppercase tracking-[0.04em] text-[#f59e0b]` (amber — informational, not an error)
- Body: secondary text
- Buttons: "Reauthenticate" as `primary`, "Dismiss" as `ghost`

File: `components/ui/ScopePrompt.tsx`

This component should be added to the component contract's approved set (§UI Primitives).

---

## 8. Updating ACCESS-CONTROL.md

Section §6 of `ACCESS-CONTROL.md` states that only one scope is used. With scope selection in place, that section should reflect the full scope registry defined here. The key invariant remains: Fleetr requests only fleet-related scopes and nothing touching wallet, assets, contacts, or other EVE data.
