# Fleetr ESI Gateway

> All communication with the EVE Swagger Interface (ESI) and the EVE SSO passes through a single `EsiClient`. No code outside `src/infra/esi/` makes direct HTTP calls to ESI or `login.eveonline.com`.

---

## 1. Overview

The ESI gateway has four responsibilities:

1. **Request execution** — typed, authenticated HTTP calls to ESI endpoints
2. **Cache management** — respect `expires` and `ETag` headers; never request before expiry
3. **Error budget management** — track `X-ESI-Error-Limit-Remain` and back off before the budget is exhausted
4. **Token lifecycle** — refresh access tokens proactively, handle rotation, invalidate on `invalid_grant`

Fleetr's ESI surface is small by design (fleet membership check on join, character info, token refresh), but correct gateway behaviour is mandatory regardless of call volume. CCP enforces compliance with permanent IP bans.

---

## 2. ESI Endpoints Used

| Purpose | Method | Endpoint | Auth required |
|---------|--------|----------|:---:|
| Verify fleet membership + role | `GET` | `/characters/{characterId}/fleet/` | ✅ (`esi-fleets.read_fleet.v1`) |
| Character public info (name, corp) | `GET` | `/characters/{characterId}/` | ❌ |
| Token refresh | `POST` | `https://login.eveonline.com/v2/oauth/token` | Basic / client_id |

These are the only ESI calls Fleetr makes. The gateway must not be used for discovery (enumerating structures, characters, or regions) — CCP explicitly prohibits this and it is a bannable offense.

---

## 3. Client Structure

```
src/infra/esi/
├── EsiClient.ts           # Public facade — the only import other code uses
├── EsiHttpClient.ts       # Core request execution + header handling
├── EsiCache.ts            # ETag + expires cache (Redis-backed)
├── EsiErrorBudget.ts      # Error budget tracker
├── EsiTokenStore.ts       # Token refresh + rotation
└── types.ts               # ESI response shapes + error types
```

`EsiClient` is instantiated once in the composition root and injected where needed. Direct instantiation elsewhere is prohibited.

---

## 4. Caching

### 4.1 The `expires` header

Every ESI response includes an `expires` header (HTTP date format) indicating when the data next changes. **Requesting the same resource before this time is wasted at best and bannable at worst.** CCP treats repeated cache circumvention as an abuse pattern.

Rules:

- Parse `expires` on every response and store it alongside the cached value.
- Before making any ESI request, check the cache. If a cached value exists and `now < expires`, return it without making a network call.
- Clock skew tolerance: allow up to 5 seconds of skew when comparing against `expires`.

```typescript
async get<T>(path: string, options?: RequestOptions): Promise<T> {
    const cached = await this.cache.get<T>(path);
    if (cached && Date.now() < cached.expiresAt - CLOCK_SKEW_MS) {
        return cached.data;
    }
    return this.fetch<T>(path, options);
}
```

### 4.2 ETag conditional requests

ESI returns an `ETag` header on most responses. On subsequent requests for the same resource, send `If-None-Match: {etag}`. If the data is unchanged, ESI returns `304 Not Modified` with no body.

Benefits:
- 304 responses are **free** — they do not count against the error budget.
- Bandwidth is saved — the full response body is not transmitted.

Implementation:

```typescript
// On first response: store etag alongside data and expiry
await this.cache.set(path, {
    data: responseBody,
    etag: response.headers.get('etag'),
    expiresAt: parseExpires(response.headers.get('expires')),
});

// On re-request (after expiry):
const cached = await this.cache.get(path);
const headers: Record<string, string> = {};
if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
}
const response = await fetch(esiUrl(path), { headers });

if (response.status === 304) {
    // Data unchanged — refresh expiry, return cached data
    await this.cache.refreshExpiry(path, parseExpires(response.headers.get('expires')));
    return cached.data;
}
```

### 4.3 The `last-modified` header

ESI also returns `Last-Modified`. Log this for observability but do not use it for conditional requests — `ETag` / `If-None-Match` is the correct mechanism.

### 4.4 Cache backend

The cache is Redis-backed via a key-value store keyed by ESI path (including query parameters). TTL is set to `expiresAt + 60s` (buffer for clock drift — the Fleetr-side expiry check is the real gate).

---

## 5. Error Budget

### 5.1 How the error budget works

CCP imposes an error budget per IP address. Every 4xx or 5xx response (see §5.2 for exact counts) consumes one unit from the budget. ESI returns two headers on every response to communicate budget state:

| Header | Meaning |
|--------|---------|
| `X-ESI-Error-Limit-Remain` | Errors remaining before the IP is throttled |
| `X-ESI-Error-Limit-Reset` | Seconds until the budget resets to its maximum |

When `X-ESI-Error-Limit-Remain` reaches `0`, ESI begins returning `HTTP 420 Error Limited` for all requests from that IP until the reset window expires. The 420 responses themselves do not consume budget — but they are a sign the gateway has already failed.

**Permanent IP bans are issued for sustained or repeated budget exhaustion.** There is no automated unban. Resolution requires contacting CCP.

### 5.2 What counts against the budget

| Status | Counts | Notes |
|--------|:------:|-------|
| 2xx | ❌ | Success |
| 304 Not Modified | ❌ | ETag hit — free |
| 400 Bad Request | ✅ | Malformed request |
| 401 Unauthorized | ✅ | Invalid/expired token |
| 403 Forbidden | ✅ | Missing scope or access denied |
| 404 Not Found | ✅ | Character/fleet not found |
| 420 Error Limited | ❌ | Budget already exhausted — don't count again |
| 422 Unprocessable Entity | ✅ | Invalid parameter values |
| 429 Too Many Requests | ✅ | |
| 503 Service Unavailable | ✅ | ESI degraded |
| 504 Gateway Timeout | ✅ | |
| 520 Unknown Error | ✅ | Monolith rate limit hit (mail, contracts) |

Client-side timeouts (no response received) do not appear in ESI headers. Treat them as budget-neutral but apply exponential backoff before retry.

### 5.3 Budget tracking

Read `X-ESI-Error-Limit-Remain` and `X-ESI-Error-Limit-Reset` on every response and store them in the `EsiErrorBudget` tracker:

```typescript
// After every response
this.budget.update({
    remaining: parseInt(response.headers.get('x-esi-error-limit-remain') ?? '100'),
    resetInSeconds: parseInt(response.headers.get('x-esi-error-limit-reset') ?? '60'),
});
```

### 5.4 Proactive throttling

Do not wait for a 420 to react. The gateway throttles proactively:

| `X-ESI-Error-Limit-Remain` | Behaviour |
|---------------------------|-----------|
| > 50 | Normal — requests proceed |
| 26–50 | Warn — log at `warn` level on each error response |
| 11–25 | Throttle — introduce 500ms delay between requests; log at `warn` |
| 1–10 | Emergency — reject all non-critical requests; log at `error` |
| 0 | Halt — wait until reset, log at `error`, alert operator |

"Non-critical" means anything that is not a user-blocking join check. Character info fetches and background refreshes are deferred until budget recovers.

### 5.5 Reset behaviour

When `X-ESI-Error-Limit-Remain` is 0:

```typescript
if (this.budget.remaining === 0) {
    const waitMs = (this.budget.resetInSeconds + 1) * 1000; // +1s buffer
    logger.error({ waitMs }, 'ESI error budget exhausted — halting requests');
    await sleep(waitMs);
    // Budget resets on CCP's side; proceed
}
```

---

## 6. Retry Policy

| Error type | Retry? | Strategy |
|------------|:------:|----------|
| 304 Not Modified | — | Not an error |
| 400 Bad Request | ❌ | Programming error — do not retry |
| 401 Unauthorized | ✅ once | Refresh the access token, then retry once |
| 403 Forbidden | ❌ | Scope missing or access denied — surface to caller |
| 404 Not Found | ❌ | Resource does not exist |
| 420 Error Limited | ✅ | Wait for `X-ESI-Error-Limit-Reset` + 1s, then retry |
| 5xx / timeout | ✅ | Exponential backoff: 1s, 2s, 4s — max 3 attempts |
| 520 Unknown Error | ✅ | Exponential backoff — monolith rate limit is transient |

**Never retry in a tight loop.** All retries consume error budget on failure.

---

## 7. Warning Headers

ESI uses HTTP `Warning` headers to signal versioning events. The gateway must inspect these on every response:

| Warning code | Meaning | Action |
|-------------|---------|--------|
| `199` | A newer version of this endpoint is available | Log at `warn` once per endpoint per process restart |
| `299` | This endpoint is deprecated and will be removed | Log at `error` on every occurrence; surface in operator stats |

```typescript
const warning = response.headers.get('warning');
if (warning?.includes('199')) {
    logger.warn({ path }, 'ESI: newer version available for endpoint');
}
if (warning?.includes('299')) {
    logger.error({ path }, 'ESI: endpoint is deprecated — update required');
}
```

`299` warnings must never be silently ignored. A deprecated endpoint going dark will break the feature that depends on it.

---

## 8. Token Lifecycle

### 8.1 Access token validity

ESI access tokens expire after **1200 seconds (20 minutes)**. The gateway maintains a token store (`EsiTokenStore`) that proactively refreshes tokens before expiry:

- Refresh when `now > issuedAt + 1140s` (60 seconds before expiry)
- This ensures a valid token is always available for requests without a blocking refresh on the hot path

### 8.2 Refresh flow

```typescript
// POST https://login.eveonline.com/v2/oauth/token
// Content-Type: application/x-www-form-urlencoded
// Authorization: Basic base64(clientId:clientSecret)   ← web app
// Body: grant_type=refresh_token&refresh_token={token}

const response = await fetch('https://login.eveonline.com/v2/oauth/token', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: storedRefreshToken,
    }),
});
```

Response shape:

```json
{
    "access_token": "<new JWT>",
    "token_type": "Bearer",
    "expires_in": 1200,
    "refresh_token": "<new or same token>"
}
```

### 8.3 Refresh token rotation

**The returned refresh token may differ from the submitted one.** Always persist the refresh token from the response, replacing the previous value. Never assume the refresh token is stable.

```typescript
const { access_token, refresh_token, expires_in } = await refreshResponse.json();
await this.tokenStore.set(characterId, {
    accessToken: access_token,
    refreshToken: refresh_token,          // overwrite — may be rotated
    expiresAt: Date.now() + expires_in * 1000,
});
```

### 8.4 `invalid_grant` handling

If the refresh token is revoked or has expired, the SSO returns an error response with `error: "invalid_grant"`. This is not a transient error — retrying will not help.

On `invalid_grant`:

1. Null out the stored refresh token immediately
2. Mark the associated session as expired
3. Log the event at `warn` level with `characterId`
4. Emit an audit event (`token.revoked`)
5. Do **not** retry

```typescript
if (body.error === 'invalid_grant') {
    await this.tokenStore.invalidate(characterId);
    logger.warn({ characterId }, 'ESI refresh token invalidated (invalid_grant)');
    throw new ExternalServiceError('ESI token revoked', { characterId });
}
```

The user must re-authenticate via ESI OAuth to restore access.

---

## 9. `User-Agent` Header

Every request to ESI must include a `User-Agent` header identifying the application and providing contact information. This is required by CCP and is how they reach out before taking enforcement action.

```typescript
const USER_AGENT = `Fleetr/1.0 (https://github.com/your-org/fleetr; contact@example.com)`;

// Set on every outbound request
headers['User-Agent'] = USER_AGENT;
```

The `User-Agent` should include:
- Application name and version
- A URL (GitHub repo or project site)
- A contact address (email or Discord)

Update `USER_AGENT` when making major releases.

---

## 10. ESI Versioning

ESI versions individual routes rather than the entire API. The gateway pins each endpoint to a specific version:

```typescript
const ESI_ENDPOINTS = {
    characterFleet:  '/v1/characters/{characterId}/fleet/',
    characterInfo:   '/v5/characters/{characterId}/',
} as const;
```

**Rules:**
- Never use `/latest/` or `/dev/` in production — these can change without notice.
- Pin to a numbered version (`/v1/`, `/v2/`, etc.).
- When a `Warning: 199` is received for an endpoint, schedule an upgrade to the newer version.
- When a `Warning: 299` is received, the upgrade is urgent — the endpoint will be removed.

---

## 11. Error Types

```typescript
export class EsiError extends ExternalServiceError {
    constructor(
        message: string,
        readonly status: number,
        readonly path: string,
    ) { super(message); }
}

export class EsiErrorLimited extends EsiError {
    constructor(path: string, resetInSeconds: number) {
        super(`ESI error budget exhausted — retry in ${resetInSeconds}s`, 420, path);
    }
}

export class EsiTokenExpiredError extends EsiError {
    constructor(readonly characterId: number) {
        super('ESI access token expired and could not be refreshed', 401, '');
    }
}

export class EsiNotInFleetError extends EsiError {
    constructor(readonly characterId: number) {
        super('Character is not currently in a fleet', 404, '');
    }
}
```

---

## 12. Logging

Every ESI request and response is logged at `debug` level. Errors are logged at `warn` or `error` depending on severity. Budget state is included in every log line when below the warning threshold:

```typescript
logger.debug({
    path,
    status: response.status,
    cached: false,
    budgetRemain: this.budget.remaining,
    budgetReset: this.budget.resetInSeconds,
}, 'ESI request');
```

Never log access tokens, refresh tokens, or `Authorization` header values — even at `debug` level.

---

## 13. Rules Summary

| Rule | Source |
|------|--------|
| Never request before `expires` | CCP policy — bannable |
| Send `If-None-Match` with stored ETag on re-requests | Reduces error budget consumption |
| Respect `X-ESI-Error-Limit-Remain` — throttle before it hits 0 | CCP policy — IP ban risk |
| Persist the returned refresh token — it may be rotated | SSO specification |
| Null out refresh token on `invalid_grant` immediately | Prevents retry loops |
| Pin to numbered endpoint versions, never `/latest/` | Stability |
| Act on `Warning: 299` — deprecated endpoints will be removed | ESI versioning contract |
| Include `User-Agent` on every request | CCP requirement |
| Never use ESI for discovery (enumerating structures, etc.) | CCP policy — bannable |
| All ESI calls go through `EsiClient` — no direct `fetch` to ESI elsewhere | Architecture rule |
