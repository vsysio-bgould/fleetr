# Fleetr Coding Standards

> Design contract for codebase architecture, conventions, and open-source readiness.

---

## 1. Layered Architecture

The application uses three layers with strict dependency direction: **outer → inner**. Inner layers never import from outer layers.

```
┌─────────────────────────────────────────────────┐
│  Interface Layer (routes, pages, PartyKit server) │  ← Thin. Parse input, call service, format output.
├───────────────────────────────────────────────────┤
│  Application Layer (services, workers)            │  ← Orchestration. Coordinates domain + infra.
├───────────────────────────────────────────────────┤
│  Infrastructure Layer (DB, ESI, Redis, PartyKit)  │  ← Adapters to external systems.
└─────────────────────────────────────────────────┘
```

**Rules:**
- Interface layer handlers are thin: validate input, delegate to a service, format the response. No business logic.
- Application services contain orchestration logic. They receive infrastructure adapters via constructor injection.
- Infrastructure adapters encapsulate all external I/O behind typed interfaces. They never contain business rules.
- Cross-layer communication uses plain data types (DTOs), not framework-specific objects (no `NextRequest` passed to services, no `Party` connection in domain logic).

---

## 2. Directory Structure

```
src/
├── app/                         # Next.js App Router (interface layer)
│   ├── api/                     # REST API route handlers
│   │   └── v1/
│   │       ├── auth/            # ESI OAuth endpoints
│   │       ├── fleets/          # Fleet CRUD and management
│   │       ├── queue/           # Media queue endpoints
│   │       └── users/           # User profile endpoints
│   ├── fleet/                   # FC-facing pages
│   │   └── [fleetId]/
│   ├── join/                    # Line member join flow
│   │   └── [token]/
│   └── layout.tsx               # Root layout
├── services/                    # Application layer — orchestration
│   └── {Domain}Service.ts       # One service per bounded context
├── domain/                      # Pure domain logic, types, and value objects
│   ├── {context}/
│   │   ├── types.ts             # Domain types for this context
│   │   └── {logic}.ts           # Pure functions, calculations, rules
│   └── errors.ts                # Domain error hierarchy
├── infra/                       # Infrastructure adapters
│   ├── esi/                     # EVE ESI client + token management
│   ├── db/                      # Prisma client + repository helpers
│   ├── redis/                   # Redis connection + queue registry
│   └── partykit/                # PartyKit client helpers + message type contracts
├── party/                       # PartyKit server (real-time layer — deployed separately)
│   └── fleet.ts                 # FleetParty server: one room per fleet
├── workers/                     # BullMQ worker definitions (loaded by worker process only)
│   └── {queue-name}.worker.ts   # One file per queue — exports a single `definition`
├── components/                  # React components (UI only — no business logic)
│   ├── ui/                      # shadcn/ui primitives
│   ├── player/                  # YouTube player components
│   ├── queue/                   # Media queue components
│   └── fleet/                   # Fleet management components
├── lib/                         # Shared utilities (formatters, validators, hooks)
├── config/                      # Environment, constants, scope definitions
└── worker.ts                    # Worker process entry point — auto-discovers + registers workers
```

**Key rules:**
- `app/api/` route handlers delegate immediately to services. No DB calls, no business logic.
- React components consume data via hooks or server components — they never call services directly.
- `components/` never imports from `services/` or `infra/`. Data flows down via props and context.

---

## 3. Dependency Injection

All application services receive their dependencies via constructor parameters. No service instantiates its own infrastructure.

```typescript
// ✅ Correct — dependencies injected
export class QueueService {
    constructor(
        private readonly db: PrismaClient,
        private readonly esi: EsiClient,
    ) {}
}

// ❌ Wrong — self-instantiation
export class QueueService {
    private db = new PrismaClient();
}
```

Services do not hold a reference to the PartyKit server. Services mutate durable state (DB); the PartyKit room reads that state and broadcasts it to connected clients.

**Composition root** (`src/lib/container.ts`) is the only place that instantiates and wires dependencies:

```typescript
// src/lib/container.ts — composition root
const db = new PrismaClient();
const esi = new EsiClient();
const fleets = new FleetService(db, esi);
const queue = new QueueService(db);
const playback = new PlaybackService(db);
```

API route handlers import from the container:

```typescript
import { container } from '@/lib/container';

export async function POST(req: NextRequest) {
    const result = await container.queue.addToQueue(data);
    return NextResponse.json(result);
}
```

---

## 4. SOLID & Inversion of Control

These principles are not aspirational — they are the active design contract. Each one maps directly to patterns enforced elsewhere in this document.

### 4.1 Single Responsibility

A class or module has one reason to change.

- Each service owns one bounded context (§9.1). `FleetService` changes when fleet lifecycle logic changes — not when queue logic changes.
- Each worker file handles one job type (§7.3).
- Interface layer handlers do one thing: parse input, delegate, format output (§10).
- If a file is growing because it does two distinct things, that is the signal to split — not line count alone.

### 4.2 Open/Closed

Open for extension, closed for modification.

- Adding a new worker requires only creating a new `*.worker.ts` file. The registry, startup process, and all existing workers are untouched (§7.5).
- Adding a new ESI scope requires adding an entry to `SCOPE_GATES` — no changes to the auth flow itself.
- New queue entries, fleet modes, or role checks are additive. Existing paths are not modified.

### 4.3 Liskov Substitution

Any implementation of an interface must be fully substitutable for that interface without changing the correctness of the program.

- Infrastructure adapter interfaces (§4.5) must be substitutable by test doubles. A mock `IEsiClient` used in a unit test must satisfy the same contract as the real `EsiClient`.
- Do not widen or narrow the contract in a subtype. If `IEsiClient.getFleetMembership` returns `FleetMembership | null`, a mock must not throw where the real client returns `null`.

### 4.4 Interface Segregation

Depend only on the methods you use. Do not force consumers to depend on methods they don't need.

- Infrastructure interfaces are split by resource, not bundled into one fat client. If a service only needs token refresh, it receives `IEsiTokenStore`, not the full `IEsiClient`.
- `WorkerDeps` is a bag of exactly the dependencies workers need — not the full application container.

### 4.5 Dependency Inversion

High-level modules must not depend on low-level modules. Both should depend on abstractions.

**Application services depend on interfaces, not concrete infrastructure classes:**

```typescript
// src/infra/esi/types.ts — the abstraction
export interface IEsiClient {
    getFleetMembership(characterId: number): Promise<FleetMembership | null>;
    refreshToken(characterId: number): Promise<void>;
}

// src/infra/esi/EsiClient.ts — the implementation
export class EsiClient implements IEsiClient { ... }

// src/services/FleetService.ts — depends on the interface, not the class
export class FleetService {
    constructor(
        private readonly db: PrismaClient,
        private readonly esi: IEsiClient,   // ← interface
    ) {}
}
```

**Interface naming rule:** Infrastructure adapter interfaces use an `I` prefix (`IEsiClient`, `IEsiTokenStore`). This is the one exception to the no-`I`-prefix rule — these interfaces genuinely exist to be swapped, and the prefix makes the contract/implementation distinction explicit at a glance. Service interfaces do not use the `I` prefix because services are not swapped.

**Which adapters need interfaces:**

| Adapter | Interface | Why |
|---------|-----------|-----|
| `EsiClient` | `IEsiClient` | Mocked in service tests — no real ESI in CI |
| `EsiTokenStore` | `IEsiTokenStore` | Token state must be controllable in tests |
| Prisma (`db`) | No interface | Prisma is already an abstraction; use it directly in services |

Prisma is the exception: it is already a typed, swappable abstraction. Wrapping it in another interface adds indirection without benefit. Use it directly in services; mock at the HTTP level in infrastructure tests.

---

### 4.6 Inversion of Control

IoC means the framework calls your code — you do not call the framework to wire things together. In Fleetr, this manifests in two places:

**Composition root (`src/lib/container.ts`):**

Services do not create their own dependencies. The container creates everything and injects it downward. Nothing outside `container.ts` calls `new FleetService(...)` or `new EsiClient(...)`.

```typescript
// src/lib/container.ts — the only place concrete classes are instantiated
const db    = new PrismaClient();
const esi   = new EsiClient();                        // implements IEsiClient
const fleet = new FleetService(db, esi);
const queue = new QueueService(db);

export const container = { fleet, queue } as const;
export type WorkerDeps = { db: PrismaClient; esi: IEsiClient; fleet: FleetService; queue: QueueService };
```

**Worker auto-discovery:**

Workers do not register themselves. The registry discovers and registers them. A worker file has no knowledge of the registry, the startup process, or other workers. This is IoC applied to the background job layer.

**What we do not use:** A DI container framework (InversifyJS, tsyringe, NestJS DI). These add decorators, `reflect-metadata`, and framework coupling. Manual constructor injection via a composition root is simpler, fully type-safe, and easier to trace — at this project's scale, the framework would cost more than it saves.

---

## 5. Error Handling

### 4.1 Error Hierarchy

All application errors extend a base `AppError`:

```typescript
export abstract class AppError extends Error {
    abstract readonly code: string;
    abstract readonly httpStatus: number;
    readonly isOperational = true;
}

export class NotFoundError extends AppError {
    readonly code = 'NOT_FOUND';
    readonly httpStatus = 404;
    constructor(readonly entity: string, readonly id: string) {
        super(`${entity} "${id}" not found`);
    }
}

export class ValidationError extends AppError {
    readonly code = 'VALIDATION_ERROR';
    readonly httpStatus = 400;
    constructor(message: string, readonly fields?: Record<string, string>) {
        super(message);
    }
}

export class ForbiddenError extends AppError {
    readonly code = 'FORBIDDEN';
    readonly httpStatus = 403;
}

export class UnauthorizedError extends AppError {
    readonly code = 'UNAUTHORIZED';
    readonly httpStatus = 401;
}

export class ExternalServiceError extends AppError {
    readonly code = 'EXTERNAL_SERVICE_ERROR';
    readonly httpStatus = 502;
}
```

### 4.2 Error Boundaries

Each interface layer has a single error boundary:

```typescript
// src/lib/api-handler.ts — wraps all API route handlers
export function apiHandler(
    handler: (req: NextRequest, ctx: RouteContext) => Promise<NextResponse>
) {
    return async (req: NextRequest, ctx: RouteContext) => {
        try {
            return await handler(req, ctx);
        } catch (err) {
            if (err instanceof AppError) {
                logger.warn({ err, path: req.nextUrl.pathname }, err.message);
                return NextResponse.json(
                    { error: err.code, message: err.message },
                    { status: err.httpStatus }
                );
            }
            logger.error({ err, path: req.nextUrl.pathname }, 'Unhandled error');
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
                { status: 500 }
            );
        }
    };
}
```

### 4.3 Rules

- Services throw `AppError` subclasses for expected failures. Never throw raw `Error` for business conditions.
- Infrastructure adapters catch external errors and wrap them in `ExternalServiceError` with context.
- Workers: operational errors → log + don't retry. Transient errors → throw to trigger BullMQ retry.
- Never swallow errors silently. If you intentionally ignore an error, log it at `debug` level with rationale.

---

## 6. Real-Time Layer (PartyKit)

PartyKit runs as a separate deployed process (`party/fleet.ts`). Each fleet maps to one PartyKit room (`fleet:{fleetId}`). The Next.js app is the source of truth for durable state (DB); PartyKit is the broadcast and ephemeral sync layer.

### 5.1 Room Model

```
PartyKit room ID: fleet:{fleetId}
Members: FC + all line members currently connected
Durable state: MySQL (via Next.js API)
Ephemeral state: PartyKit room (playback position, connection roster)
```

### 5.2 Message Types

All messages are typed and defined in a shared contract file imported by both the PartyKit server and the Next.js client:

```typescript
// src/config/party-messages.ts — shared by party/ and components/

export type ServerMessage =
    | { type: 'playback:state';  payload: PlaybackState }
    | { type: 'queue:updated';   payload: QueueSnapshot }
    | { type: 'fleet:mode';      payload: { mode: FleetMode } }
    | { type: 'queue:votes';     payload: VoteCounts };

export type ClientMessage =
    | { type: 'queue:vote';      payload: { entryId: string } }
    | { type: 'queue:submit';    payload: { youtubeUrl: string } }
    | { type: 'fleet:set-mode';  payload: { mode: FleetMode } }   // FC only
    | { type: 'playback:seek';   payload: { positionMs: number } }; // FC only
```

Never use inline string literals for message types — always reference this contract.

### 5.3 PartyKit Server

The PartyKit server handles connection auth, message routing, and state sync on join:

```typescript
// party/fleet.ts
import type * as Party from 'partykit/server';
import type { ClientMessage, ServerMessage } from '../src/config/party-messages';

export default class FleetParty implements Party.Server {
    constructor(readonly room: Party.Room) {}

    async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
        const token = new URL(ctx.request.url).searchParams.get('token');
        const session = await validateJoinToken(token);
        if (!session) { conn.close(4001, 'Unauthorized'); return; }

        conn.setState({ characterId: session.characterId, role: session.role });

        // Send full current state to the new connection
        const state = await fetchFleetState(this.room.id);
        conn.send(JSON.stringify({ type: 'playback:state', payload: state.playback } satisfies ServerMessage));
        conn.send(JSON.stringify({ type: 'queue:updated',  payload: state.queues  } satisfies ServerMessage));
        conn.send(JSON.stringify({ type: 'fleet:mode',     payload: { mode: state.mode } } satisfies ServerMessage));
    }

    async onMessage(message: string, sender: Party.Connection) {
        const msg = JSON.parse(message) as ClientMessage;
        const session = sender.state as ConnectionState;

        if ((msg.type === 'fleet:set-mode' || msg.type === 'playback:seek') && session.role !== 'fc') {
            sender.send(JSON.stringify({ type: 'error', payload: { code: 'FORBIDDEN' } }));
            return;
        }

        // Persist via Next.js API, then broadcast updated state
        await persistAction(this.room.id, session.characterId, msg);
        this.room.broadcast(message, [sender.id]);
    }
}
```

### 5.4 Authorization

- Auth is enforced in `onConnect` — unauthenticated connections are closed before they join the room.
- FC-only messages (`fleet:set-mode`, `playback:seek`) are re-checked in `onMessage` against `conn.state.role`.
- The PartyKit server calls the Next.js API to persist mutations — it does not have direct DB access.

### 5.5 Client Hook

React components connect via a typed hook:

```typescript
// src/lib/hooks/useFleetParty.ts
export function useFleetParty(fleetId: string, token: string) {
    const socket = usePartySocket({
        host: process.env.NEXT_PUBLIC_PARTYKIT_HOST,
        room: `fleet:${fleetId}`,
        query: { token },
        onMessage(event) {
            const msg = JSON.parse(event.data) as ServerMessage;
            dispatch(msg); // update local state via reducer
        },
    });

    const send = useCallback((msg: ClientMessage) => {
        socket.send(JSON.stringify(msg));
    }, [socket]);

    return { send };
}
```

---

## 7. Work Dispatch (Queue Patterns)

Workers run in a **separate process** from the Next.js server (`src/worker.ts`). They are never loaded inside the Next.js app. On startup, the worker process auto-discovers every `*.worker.ts` file, imports its definition, and registers it with the `WorkerRegistry`. No worker is manually wired in the composition root.

### 6.1 Queue Registry

All queues are declared in a single registry file. This is the only place queue names and concurrency limits are defined.

```typescript
// src/infra/redis/queues.ts
export const QUEUES = {
    ESI_TOKEN_REFRESH: { name: 'esi-token-refresh', concurrency: 5 },
    FLEET_CLEANUP:     { name: 'fleet-cleanup',     concurrency: 1 },
} as const;

export type QueueKey = keyof typeof QUEUES;
```

### 6.2 WorkerDefinition Interface

Every worker file exports a single `definition` object conforming to `WorkerDefinition`. This is the contract the registry consumes.

```typescript
// src/infra/redis/worker-types.ts
import type { Job } from 'bullmq';
import type { QueueKey } from './queues.js';
import type { WorkerDeps } from '../../lib/container.js';

export interface WorkerDefinition<TPayload = unknown> {
    queue:     QueueKey;
    schedule?: WorkerSchedule;
    handler:   (deps: WorkerDeps) => (job: Job<TPayload>) => Promise<void>;
}

export interface WorkerSchedule {
    cron?:  string;   // standard cron expression — '0 */6 * * *'
    every?: string;   // interval string — '4h', '30m', '45s'
    jobId?: string;   // stable dedup key — prevents duplicate repeatable jobs on restart
}
```

`WorkerDeps` is the same dependency bag used by services — workers receive injected dependencies, never self-instantiate.

### 6.3 Worker Files

Each worker is a single file in `src/workers/`. It exports one named export: `definition`.

```typescript
// src/workers/fleet-cleanup.worker.ts
import { z } from 'zod';
import type { WorkerDefinition } from '../infra/redis/worker-types.js';

const PayloadSchema = z.object({}).strict(); // no payload for scheduled sweeps

export const definition: WorkerDefinition = {
    queue: 'FLEET_CLEANUP',
    schedule: {
        cron:  '0 * * * *',           // top of every hour
        jobId: '__fleet-cleanup__',    // stable — survives restarts
    },
    handler: (deps) => async (job) => {
        PayloadSchema.parse(job.data);
        await deps.fleets.expireStaleFleets();
    },
};
```

```typescript
// src/workers/esi-token-refresh.worker.ts
import { z } from 'zod';
import type { WorkerDefinition } from '../infra/redis/worker-types.js';

const PayloadSchema = z.object({ characterId: z.number().int().positive() });

export const definition: WorkerDefinition<z.infer<typeof PayloadSchema>> = {
    queue: 'ESI_TOKEN_REFRESH',
    // No schedule — enqueued on-demand when a token nears expiry
    handler: (deps) => async (job) => {
        const { characterId } = PayloadSchema.parse(job.data);
        await deps.esi.refreshToken(characterId);
    },
};
```

**Rules:**
- One `definition` export per file. No other exports.
- Always validate `job.data` with Zod before using it — payloads are deserialized from Redis and may be stale or corrupt.
- Operational errors (bad data, resource not found) → log and return. Do not rethrow.
- Transient errors (network failure, DB timeout) → rethrow. BullMQ will retry according to queue config.

### 6.4 WorkerRegistry

The registry creates BullMQ `Worker` instances, registers repeatable schedules, and tracks everything for clean shutdown.

```typescript
// src/infra/redis/WorkerRegistry.ts
import { Worker, Queue } from 'bullmq';
import { QUEUES } from './queues.js';
import type { WorkerDefinition } from './worker-types.js';
import type { WorkerDeps } from '../../lib/container.js';

export class WorkerRegistry {
    private readonly workers: Worker[] = [];

    async register(def: WorkerDefinition, deps: WorkerDeps): Promise<void> {
        const queueMeta = QUEUES[def.queue];

        const worker = new Worker(
            queueMeta.name,
            def.handler(deps),
            { connection: deps.redis, concurrency: queueMeta.concurrency },
        );

        worker.on('failed', (job, err) => {
            logger.error({ jobId: job?.id, queue: queueMeta.name, err }, 'Job failed');
        });

        this.workers.push(worker);

        if (def.schedule) {
            const queue = new Queue(queueMeta.name, { connection: deps.redis });
            await queue.upsertJobScheduler(
                def.schedule.jobId ?? queueMeta.name,
                def.schedule.cron
                    ? { pattern: def.schedule.cron }
                    : { every: parseDuration(def.schedule.every!) },
            );
            await queue.close();
        }

        logger.info({ queue: queueMeta.name, scheduled: !!def.schedule }, 'Worker registered');
    }

    async shutdown(): Promise<void> {
        await Promise.all(this.workers.map(w => w.close()));
        logger.info('All workers shut down');
    }
}
```

### 6.5 Auto-Discovery on Startup

The worker process entry point discovers all `*.worker.ts` files, imports their definitions, and registers them. No worker is imported or referenced anywhere else.

```typescript
// src/worker.ts — worker process entry point (not part of Next.js)
import { glob } from 'glob';
import { WorkerRegistry } from './infra/redis/WorkerRegistry.js';
import { buildWorkerDeps } from './lib/container.js';
import type { WorkerDefinition } from './infra/redis/worker-types.js';

async function main() {
    const deps = await buildWorkerDeps();
    const registry = new WorkerRegistry();

    const files = await glob('src/workers/*.worker.{ts,js}');

    for (const file of files) {
        const mod = await import(file);
        const def = mod.definition as WorkerDefinition;
        await registry.register(def, deps);
    }

    logger.info({ count: files.length }, 'Worker process ready');

    // Graceful shutdown
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.on(signal, async () => {
            logger.info({ signal }, 'Shutting down workers');
            await registry.shutdown();
            process.exit(0);
        });
    }
}

main().catch(err => {
    logger.fatal({ err }, 'Worker process failed to start');
    process.exit(1);
});
```

### 6.6 Process Separation

Workers run as a separate process, not inside the Next.js server. In Docker Compose, this is a second service sharing the same image:

```yaml
# docker-compose.yml
services:
  app:
    command: node .next/standalone/server.js

  workers:
    command: node dist/worker.js
    depends_on: [db, redis]
```

This means:
- A crash in the worker process does not take down the web server.
- Workers can be scaled or restarted independently.
- The Next.js app never imports from `src/workers/` — that directory is only ever loaded by `src/worker.ts`.

### 6.7 Enqueue Helpers

Typed enqueue functions live alongside their queue definition and encapsulate job options (deduplication, delay, priority). They are the only way other code enqueues jobs — no raw `queue.add()` calls outside this file.

```typescript
// src/infra/redis/enqueue.ts
import { Queue } from 'bullmq';
import { QUEUES } from './queues.js';

const esiTokenQueue = new Queue(QUEUES.ESI_TOKEN_REFRESH.name, { connection: redis });

export async function enqueueEsiTokenRefresh(characterId: number): Promise<void> {
    await esiTokenQueue.add(
        'refresh',
        { characterId },
        { deduplication: { id: `esi-refresh-${characterId}` } },
    );
}
```

---

## 8. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files — services | `PascalCase` | `FleetService.ts` |
| Files — API routes | Next.js convention | `app/api/v1/fleets/route.ts` |
| Files — workers | `kebab-case.worker.ts` | `fleet-cleanup.worker.ts` |
| Files — types | `types.ts` within domain folder | `domain/fleet/types.ts` |
| Files — components | `PascalCase` | `MediaQueue.tsx` |
| Classes | `PascalCase` + role suffix | `FleetService`, `EsiClient` |
| Interfaces | `PascalCase`, no `I` prefix | `PlaybackState`, `QueueEntry` |
| Type aliases | `PascalCase` | `FleetMode`, `VoteResult` |
| Constants | `SCREAMING_SNAKE` for config objects | `QUEUES`, `SOCKET_EVENTS` |
| Functions | `camelCase`, verb-first | `addToQueue`, `validateJoinToken` |
| Boolean vars | `is`/`has`/`should` prefix | `isFc`, `hasVoted`, `shouldMute` |
| Private fields | no underscore prefix (TypeScript `private`) | `private readonly db` |

**Domain-specific naming:**
- Services that *do* something: verb-noun (`QueueVoter`, `FleetExpirer`)
- Services that *provide* something: noun (`FleetService`, `PlaybackService`)
- Infrastructure clients: `{System}Client` (`EsiClient`)
- Socket event constants: namespaced strings (`'playback:state'`, `'fleet:mode'`)

---

## 9. Abstractions

### 8.1 Service Boundaries

Each service owns a single bounded context.

| Bounded Context | Service | Owns |
|----------------|---------|------|
| Fleet lifecycle | `FleetService` | Fleet creation, join tokens, member roster, expiry |
| Media queue | `QueueService` | Submission, voting, dequeue, cruise/battle split |
| Playback | `PlaybackService` | Mode switching, volume state, now-playing, sync |
| Identity | `IdentityService` | ESI OAuth flow, session management, character profile |
| ESI | `EsiClient` | Token refresh, character info, fleet membership verification |

### 8.2 What NOT to Abstract

- Don't wrap Prisma in a generic repository layer. Prisma *is* the repository. Use it directly in services.
- **Exception:** Named transaction functions for multi-step workflows are encouraged:

```typescript
// ✅ Good — named workflow, not a generic repo
async function createFleetWithQueues(tx: Tx, params: CreateFleetParams) { ... }
```

- Don't create interfaces for services that will only ever have one implementation. Use concrete classes.
- Don't abstract Socket.io behind a generic "event bus" — the room and event semantics are part of the design.

---

## 10. Interface Layer Patterns

### 9.1 API Route Handler (Next.js App Router)

```typescript
// app/api/v1/queue/route.ts
export const POST = apiHandler(async (req) => {
    const session = await requireSession(req);
    const body = SubmitMediaSchema.parse(await req.json());
    const entry = await container.queue.submit(session.fleetId, session.characterId, body.youtubeUrl);
    return NextResponse.json(entry, { status: 201 });
});
```

### 9.2 PartyKit Action Endpoint

The PartyKit server calls the Next.js API to persist mutations. This keeps DB access in one place:

```typescript
// app/api/v1/party/action/route.ts
export const POST = apiHandler(async (req) => {
    // Requests come from the PartyKit server, authenticated with a shared secret
    requirePartyKitSecret(req);
    const body = PartyActionSchema.parse(await req.json());
    await container.queue.handleAction(body.fleetId, body.characterId, body.action);
    return NextResponse.json({ ok: true });
});
```

### 9.3 Server Component (data fetching)

```typescript
// app/fleet/[fleetId]/page.tsx
export default async function FleetPage({ params }: { params: { fleetId: string } }) {
    const session = await getServerSession();
    if (!session) redirect('/login');
    const fleet = await container.fleets.getFleet(params.fleetId);
    if (!fleet) notFound();
    return <FleetView initialState={fleet} session={session} />;
}
```

---

## 11. File Size Limits

| File type | Soft limit | Hard limit | Action when exceeded |
|-----------|-----------|-----------|---------------------|
| Service | 300 lines | 500 lines | Extract sub-service or helper |
| API route file | 100 lines | 200 lines | Split by sub-resource |
| Worker | 50 lines | 100 lines | Logic belongs in service, not worker |
| Component | 150 lines | 300 lines | Extract child components |
| Type file | 150 lines | 300 lines | Split by sub-domain |

Split by reason, not by line count: distinct workflow stage, distinct side-effect boundary, or distinct rendering concern. A coherent 400-line pipeline is better than three 130-line fragments.

---

## 12. Testing Standards

Every feature ships with a battery of tests. Tests run automatically on commit (pre-commit hook) and on every pull request (GitHub Actions CI). A PR cannot be merged if tests fail.

### 12.1 Test Types and Scope

| Type | What it tests | Tools | Runs on |
|------|--------------|-------|---------|
| Unit | Services, domain logic, workers, pure functions | vitest + mock factories | commit + CI |
| Integration | Infrastructure adapters (HTTP-level mocking) | vitest + `msw` | CI |
| Type | TypeScript contract correctness | `tsc --noEmit` | commit + CI |

End-to-end tests (full stack, real browser) are out of scope for now. The unit + integration layer is the primary safety net.

### 12.2 What Requires Tests

**Every service method** has a test covering at minimum:
- The happy path
- Each distinct error case (`NotFoundError`, `ForbiddenError`, etc.)
- Edge cases in domain logic (empty queue, concurrent votes, expired fleet)

**Every worker handler** is tested by calling it directly with mock deps:
```typescript
// fleet-cleanup.worker.test.ts
it('expires stale fleets', async () => {
    const mockFleets = createMockFleetService({ expireStaleFleets: vi.fn() });
    const handler = definition.handler({ fleets: mockFleets } as WorkerDeps);
    await handler({ data: {} } as Job);
    expect(mockFleets.expireStaleFleets).toHaveBeenCalledOnce();
});
```

**Every domain function** (pure logic in `src/domain/`) has exhaustive unit tests — these are the easiest and highest-value tests to write.

**Infrastructure adapters** are tested at the HTTP level using `msw` to intercept `fetch`. The test verifies our client correctly speaks the protocol — not that the external service works:
```typescript
// EsiClient.test.ts
it('returns null when character is not in a fleet', async () => {
    server.use(http.get('*/characters/*/fleet/', () => HttpResponse.json({}, { status: 404 })));
    const result = await client.getFleetMembership(12345);
    expect(result).toBeNull();
});
```

**What does NOT require tests:**
- Prisma schema definitions
- Next.js page components (visual — verify manually)
- Configuration constants
- Trivial pass-through types

### 12.3 Mock Factories

Never construct mocks inline in test files. Mock factories live in `tests/mocks/` and are the single source of truth for each interface's test double. This ensures every test uses the same baseline and deviations are explicit.

```typescript
// tests/mocks/esi.mock.ts
import type { IEsiClient } from '../../src/infra/esi/types.js';

export function createMockEsiClient(overrides?: Partial<IEsiClient>): IEsiClient {
    return {
        getFleetMembership: vi.fn().mockResolvedValue({
            fleetId: 'fleet-1',
            role: 'fleet_commander',
        }),
        refreshToken: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}
```

```typescript
// In a test — override only what this test cares about
const esi = createMockEsiClient({
    getFleetMembership: vi.fn().mockResolvedValue(null), // not in fleet
});
const service = new FleetService(db, esi);
```

Mock factories follow this pattern for every infrastructure interface: `IEsiClient`, `IEsiTokenStore`.

### 12.4 Test File Structure

Test files live adjacent to their source:

```
src/
├── services/
│   ├── FleetService.ts
│   └── FleetService.test.ts
├── workers/
│   ├── fleet-cleanup.worker.ts
│   └── fleet-cleanup.worker.test.ts
├── infra/
│   └── esi/
│       ├── EsiClient.ts
│       └── EsiClient.test.ts
└── domain/
    └── queue/
        ├── queue-logic.ts
        └── queue-logic.test.ts
tests/
└── mocks/              # Mock factories only — no test files here
    ├── esi.mock.ts
    └── token-store.mock.ts
```

### 12.5 Test Naming

Test names describe behaviour, not implementation:

```typescript
// ✅ Good — describes observable behaviour
it('rejects a join attempt when the character is not in the fleet')
it('returns the cruise queue sorted by vote count descending')
it('does not deduct from error budget on a 304 response')

// ❌ Bad — describes implementation
it('calls getFleetMembership')
it('sorts the array')
it('checks the status code')
```

Group with `describe` by method or scenario, not by file:
```typescript
describe('FleetService.join', () => {
    it('creates a session when the character is in the fleet')
    it('throws NotInFleetError when ESI returns null')
    it('throws FleetExpiredError when the fleet has ended')
})
```

### 12.6 Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: 'node',
        globals: false,                  // explicit imports only — no implicit describe/it globals
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/services/**', 'src/domain/**', 'src/workers/**', 'src/infra/**'],
            exclude: ['**/*.test.ts', 'src/app/**', 'src/components/**'],
            thresholds: {
                lines:      80,
                functions:  80,
                branches:   75,
            },
        },
    },
});
```

Coverage thresholds are enforced in CI. A PR that drops below threshold will not merge.

### 12.7 Pre-Commit and Pre-Push Hooks

Hooks are configured via Husky. Setup runs automatically after `npm install` via the `prepare` script.

```
# On git commit — fast checks only
.husky/pre-commit:  npx lint-staged    (typecheck + lint staged files)

# On git push — full suite
.husky/pre-push:    npm test
```

`lint-staged` configuration in `package.json`:
```json
"lint-staged": {
    "*.{ts,tsx}": [
        "tsc --noEmit --incremental",
        "eslint --fix"
    ]
}
```

To skip hooks in an emergency (never on main): `git push --no-verify`

### 12.8 CI Enforcement

GitHub Actions runs the full suite on every pull request and every push to `main`. See `.github/workflows/ci.yml`. A PR cannot be merged until all CI jobs pass — this is enforced via branch protection rules on `main`:

- Require status checks: `typecheck`, `test`, `lint`
- Require branches to be up to date before merging
- No direct pushes to `main`

---

## 13. Configuration Tiers

**Tier 1 — Environment variables:** Secrets, connection strings, and infrastructure coordinates. Set at deploy time; require a restart to change.

**Tier 2 — `Setting` table (UI-editable):** Operational knobs — fleet expiry duration, max queue length, vote weight rules. Flat key/value store backed by a `ConfigService` with an in-memory cache.

```typescript
const CONFIG_SCHEMA = {
    'fleet.defaultExpiryMinutes':  z.coerce.number().int().min(30).max(1440),
    'queue.maxLength':             z.coerce.number().int().min(10).max(200),
    'queue.maxSubmissionsPerUser': z.coerce.number().int().min(1).max(10),
    'playback.battleModeVolume':   z.coerce.number().min(0).max(1).default(0.25),
} as const;
```

**Tier 3 — Dedicated models:** Coherent multi-field entities backing a subsystem (`FleetConfig`). Managed through their own API.

**Decision test:**
- *Would changing this require a redeploy?* → Tier 1
- *Is this a single scalar knob an operator tweaks?* → Tier 2
- *Is this a coherent multi-field entity?* → Tier 3

---

## 14. Feature Modularity

Optional features are gracefully disabled when their configuration is absent.

```typescript
const FEATURES = {
    battleMode:     !!config.get('playback.battleModeVolume'),
    queueVoting:    !!config.get('queue.maxLength'),
} as const;
```

**Rules:**
- Workers for disabled features don't start.
- Routes for disabled features return 404 with a clear message.
- The UI hides navigation for disabled features.
- Startup logs which features are active.

---

## 15. Secrets Hygiene

- **No secrets in git history.** Before public release, squash history or use `git filter-repo`.
- **`.env.example`** contains every key with placeholder values and comments. Never real credentials.
- **No default values that leak identity.** `z.string().default('localhost')` is fine. `z.string().default('https://myserver.example.com')` is not.

---

## 16. Documentation Standards

| Document | Purpose |
|----------|---------|
| `README.md` | What it is, screenshots, quick-start |
| `docs/setup.md` | Full deployment guide (prerequisites, env vars, ESI app creation) |
| `docs/architecture.md` | System diagram and data flow |
| `CONTRIBUTING.md` | How to contribute, code style, PR process |
| `LICENSE` | License file |
| `CHANGELOG.md` | Version history starting from public release |
| `.env.example` | Annotated environment template |
| `docker-compose.yml` | One-command local development setup |

---

## 17. Deployment Portability

The app should be runnable by someone who has never seen the codebase:

- **`docker-compose.yml`** with MySQL, Redis, and the app.
- **Database migrations** via Prisma (`prisma migrate deploy`), not manual SQL.
- **Seed script** that creates minimum viable data (default settings).
- **Health check endpoint** (`GET /api/health`) that reports DB and Redis connectivity.
- **Startup validation** that fails fast with clear messages if required config is missing.

---

## 18. No Dead Code

- Commented-out code blocks are removed.
- Unused imports are removed.
- Experimental features that never shipped are removed.

**Rule:** If it's not called, it's not shipped. Use TypeScript's `noUnusedLocals` to enforce.

---

## 19. Consistent Logging

**Rules:**
- Every log line includes structured context: `logger.info({ fleetId, characterId }, 'Member joined fleet')`
- Log levels:
    - `error` — something broke, needs human attention
    - `warn` — degraded but recovering (token refresh failure, retry)
    - `info` — significant business events (fleet created, mode changed, member joined)
    - `debug` — internal flow details (job started, cache hit/miss, socket room joined)
- No `console.log`. Ever.
- No logging of secrets, tokens, or full request bodies in production.
- Startup logs the app version, enabled features, and connection status for each external system.

---

## 20. API Stability & Versioning

- Route paths are prefixed: `/api/v1/...`
- Breaking changes require a version bump.
- Response shapes are documented via TypeScript types exported from a shared location.
- Error responses follow a consistent envelope: `{ error: string, message: string, details?: unknown }`

---

## 21. Security Standards

### 20.1 Authentication & Token Handling

**ESI OAuth:**
- Exchange the authorization code server-side with PKCE. Never accept a bare access token from a client as proof of identity.
- On token exchange, validate the JWT `aud` claim matches *our* `client_id`.
- Access tokens are ephemeral — never persisted. Refresh tokens are stored in the DB; the DB must not be publicly accessible.
- When a refresh token fails with `invalid_grant`, immediately null it out and log the event.

**Session security:**
- Session cookies: `HttpOnly`, `SameSite=Lax`, `Secure` (when `BASE_URL` starts with `https`).
- Session IDs are cryptographically random (128+ bits of entropy).
- Sessions expire and are pruned from the DB.

### 20.2 Authorization

**Deny by default:**
- Every protected route uses middleware, not inline checks in handlers.
- Unauthenticated requests → 401. Unauthorized requests → 403.
- FC-only actions (mode switch, seek) are enforced in both the API layer and the socket event handler.

```typescript
// ✅ Correct — middleware guard
export const POST = apiHandler(requireFc(async (req, session) => {
    await container.playback.setMode(session.fleetId, data.mode);
    return NextResponse.json({ ok: true });
}));
```

**IDOR prevention:**
- Route handlers that access fleet or user data verify the requesting session has access to that specific resource.
- Never trust a user-supplied `fleetId` without checking session membership.

### 20.3 Input Validation

- All external input (route params, query strings, request bodies, socket payloads) is validated with Zod at the interface layer boundary before any business logic executes.
- Prisma parameterizes all queries. Any raw queries must use `$queryRaw` with tagged templates, never string interpolation.

### 20.4 SSRF Prevention

The server fetches YouTube metadata from user-submitted URLs. These must be constrained:

| Vector | Mitigation |
|--------|------------|
| YouTube URL submission | Validate against `https://www.youtube.com/*` and `https://youtu.be/*` allowlist only |
| ESI endpoints | Hardcoded base URL — never user-supplied |

**Rules:**
- Before fetching any user-provided URL, validate against an allowlist.
- Block requests to private/internal IP ranges.
- Resolve DNS and reject private IPs before making the outbound request (DNS rebinding defense).

### 20.5 XSS Prevention

- Never use `dangerouslySetInnerHTML` with unsanitized content.
- React's default escaping handles most cases. Only use `dangerouslySetInnerHTML` with DOMPurify-sanitized content.
- YouTube embeds use the standard iframe embed URL (`https://www.youtube.com/embed/{id}`) — never inject user-supplied strings into iframe `src` attributes.

### 20.6 Rate Limiting

- All API routes have rate limiting per IP (100 req/min authenticated, 20 req/min unauthenticated).
- Auth endpoints (ESI callback) have stricter limits (10 req/min per IP).
- PartyKit message handlers have per-connection rate limiting to prevent vote spam.

### 20.7 Security Headers

```typescript
// next.config.ts
const securityHeaders = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",   // needed for Next.js
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' https://images.evetech.net data:",
            "frame-src https://www.youtube.com",    // YouTube embeds only
            `connect-src 'self' wss://${process.env.NEXT_PUBLIC_PARTYKIT_HOST}`,
        ].join('; '),
    },
];
```

### 20.8 Audit Logging

Security-relevant actions are logged to a structured audit trail:

| Event | Data logged |
|-------|-------------|
| ESI token granted | characterId, characterName, scopes |
| ESI token revoked/expired | characterId, reason |
| Fleet created | fleetId, fcCharacterId |
| Fleet mode changed | fleetId, oldMode, newMode, initiatedBy |
| Member joined/left | fleetId, characterId |
| Vote cast | fleetId, characterId, queueEntryId |

```prisma
model AuditLog {
    id        String   @id @default(uuid())
    event     String
    actor     String   // characterId or "system"
    payload   Json
    ip        String?
    createdAt DateTime @default(now())

    @@index([event, createdAt])
    @@index([actor, createdAt])
}
```

### 20.9 Dependency Security

- Run `npm audit` as part of CI. No `critical` or `high` vulnerabilities ship.
- Pin dependency versions exactly (not ranges) to prevent supply-chain drift.

---

## Summary of Principles

| # | Principle | One-liner |
|---|-----------|-----------|
| 1 | Layered Architecture | Interface → Application → Infrastructure, strict direction |
| 2 | Directory Structure | Organized by architectural role |
| 3 | Dependency Injection | Inject, don't instantiate. Composition root wires everything. |
| 4 | SOLID & IoC | Named principles, adapter interfaces, manual composition root |
| 5 | Error Handling | Typed errors, caught at boundaries |
| 6 | Real-Time Layer | PartyKit rooms, typed message contracts, auth on connect |
| 7 | Work Dispatch | WorkerDefinition interface + auto-discovery + separate worker process |
| 8 | Naming Conventions | Consistent casing and suffixes by file type |
| 9 | Abstractions | One service per bounded context |
| 10 | Interface Layer Patterns | Thin handlers: parse, delegate, format |
| 11 | File Size Limits | Hard limits prevent god files |
| 12 | Testing Standards | DI enables unit tests; test adjacent to source |
| 13 | Configuration Tiers | Env vars for infra, DB for ops, dedicated models for subsystems |
| 14 | Feature Modularity | Disabled features are invisible, not broken |
| 15 | Secrets Hygiene | Clean history, no leaked credentials |
| 16 | Documentation Standards | A stranger can deploy from docs alone |
| 17 | Deployment Portability | docker-compose up and it works |
| 18 | No Dead Code | If it's not called, it's not shipped |
| 19 | Consistent Logging | Structured, leveled, useful to strangers |
| 20 | API Stability | Versioned routes, consistent error shapes |
| 21 | Security | ESI token hygiene, SSRF prevention, XSS protection, audit trail |

