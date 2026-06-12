# Fleetr

Real-time fleet music for EVE Online. The FC sets the queue; the fleet listens.

---

## What is Fleetr?

Fleetr is a web app built for EVE Online fleet operations. Fleet commanders create a room, share a join link, and their fleet gets a shared media queue — submitted by members, ordered by votes, and managed by the FC. Each member runs their own independent player, so non-premium YouTube users won't have their track cut off by someone else advancing the queue.

When a battle kicks off, the FC switches to Battle Mode. Every player interrupts and jumps to the battle queue.

---

## Features

### For Line Members
- Join a fleet room via a shared link with a one-time ESI verification
- Submit YouTube or SoundCloud tracks to the queue
- Vote on submitted tracks to move them up
- Independent local player — you control your own play, pause, and seek
- **Catch Up** button to resync with where the fleet currently is
- Personal mute (never synced — your ears, your choice)

### For Fleet Commanders
- Create a fleet room in seconds using your active EVE fleet
- Choose YouTube or SoundCloud as the fleet's media platform
- Two queues: **Cruise** (background music) and **Battle** (combat-ready)
- Switch modes mid-session — all players interrupt and jump to the active queue
- Set fleet-wide volume; battle mode applies an automatic reduction on top
- Skip the fleet reference track or let auto-advance handle it
- Full member roster with optional solar system locations
- Remove queue entries, kick members, and regenerate the join link
- Delegate FC access to other pilots in your fleet

### For Operators
- System stats dashboard (active fleets, connected members, ESI health)
- Force-disband any fleet
- Manage operator accounts
- Full audit log

---

## How it works

Fleetr separates **fleet state** from **individual playback**. The server tracks a single *fleet reference track* — which entry the fleet is currently on, and when it started. Every client displays this as "Now Playing" and can compute the fleet's current approximate position. Members play through the queue at their own pace; the fleet reference advances automatically when the track's duration expires, or immediately when the FC skips.

Real-time events (mode changes, queue updates, member join/leave, volume changes) are pushed to all connected clients via [PartyKit](https://partykit.io). Queue data is fetched over HTTP and kept current via incremental WebSocket updates.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js](https://nextjs.org) 14 (App Router) + TypeScript |
| Database | MySQL 8 + [Prisma](https://prisma.io) ORM |
| Background jobs | [BullMQ](https://bullmq.io) + Redis |
| Real-time | [PartyKit](https://partykit.io) |
| UI | [Tailwind CSS](https://tailwindcss.com) v4 + [shadcn/ui](https://ui.shadcn.com) |
| Auth | EVE Online ESI OAuth (SSO) |
| Infrastructure | Docker + Docker Compose |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- A registered EVE Online ESI application — create one at [developers.eveonline.com](https://developers.eveonline.com). Set the callback URL to `http://localhost:3000/api/v1/auth/callback`. Register the scope `esi-fleets.read_fleet.v1`.
- A Google Cloud project with the YouTube Data API v3 enabled — [console.cloud.google.com](https://console.cloud.google.com)
- A PartyKit account (or run locally without one using `npx partykit dev`)

### Quickstart

```bash
# 1. Clone
git clone https://github.com/your-org/fleetr.git
cd fleetr

# 2. Install dependencies (also sets up Husky git hooks)
npm install

# 3. Start MySQL and Redis
docker compose up -d

# 4. Configure environment
cp .env.example .env
# Edit .env — fill in ESI credentials, YouTube API key, and generate secrets

# 5. Apply database schema
npx prisma migrate dev

# 6. Bootstrap the first Operator account
npm run db:seed

# 7. Start the app
npm run dev

# 8. Start the worker process (separate terminal)
npm run worker

# 9. Start the PartyKit server (separate terminal)
npx partykit dev
```

The app will be at `http://localhost:3000`. The PartyKit server will be at `http://localhost:1999`.

For full setup instructions, environment variable reference, and contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Project Structure

```
src/
├── app/              # Next.js App Router — pages and API routes
├── components/       # React components (see docs/COMPONENT-CONTRACT.md)
├── services/         # Application layer — one service per bounded context
├── domain/           # Pure domain logic and types
├── infra/            # Infrastructure adapters (DB, ESI, Redis, PartyKit)
├── workers/          # BullMQ background workers
├── providers/        # React context providers (FleetProvider)
├── lib/              # Shared utilities, hooks, reducers
└── config/           # Constants, message contracts, scope definitions
party/                # PartyKit server
prisma/               # Schema and migrations
docs/                 # Architecture and design documents
```

### Documentation

| Document | Contents |
|----------|----------|
| [docs/CODING-STANDARDS.md](docs/CODING-STANDARDS.md) | Architecture, DI/IoC, SOLID, real-time patterns, testing standards |
| [docs/COMPONENT-CONTRACT.md](docs/COMPONENT-CONTRACT.md) | Approved UI components, layout models, color tokens |
| [docs/ACCESS-CONTROL.md](docs/ACCESS-CONTROL.md) | Three access levels, session model, enforcement rules |
| [docs/ESI-GATEWAY.md](docs/ESI-GATEWAY.md) | ESI client design, error budgets, caching, token rotation |
| [docs/ESI-SCOPES.md](docs/ESI-SCOPES.md) | Scope selection UX, auth tiers, reauth flow |
| [docs/MEDIA-PLAYERS.md](docs/MEDIA-PLAYERS.md) | YouTube/SoundCloud integration, compliance, advisory notices |
| [docs/API-CONTRACT.md](docs/API-CONTRACT.md) | REST API reference, HTTP vs WebSocket boundary |
| [docs/WORKERS.md](docs/WORKERS.md) | Background worker inventory and schedules |

---

## Running Tests

```bash
# Start test services (isolated MySQL + Redis on offset ports)
docker compose --profile test up -d

# Run the full suite
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

Tests run automatically on commit (lint + typecheck via Husky) and on every pull request (full suite via GitHub Actions).

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request — it covers branching conventions, commit style, the PR checklist, and code standards.

Key points:
- All ESI calls go through `EsiClient` in `src/infra/esi/` — no direct `fetch` to ESI
- New components must follow [docs/COMPONENT-CONTRACT.md](docs/COMPONENT-CONTRACT.md)
- Every new service method needs a corresponding test
- PRs require passing CI and at least one maintainer approval

---

## EVE Online

Fleetr is an independent third-party application and is not affiliated with CCP hf. EVE Online and all associated marks and logos are trademarks of CCP hf. Use of EVE Online data via the ESI API is subject to the [EVE Online Developer License Agreement](https://developers.eveonline.com/license-agreement).

This application does not access wallet, assets, contacts, mail, market, or corporation data.

---

## License

[GNU Affero General Public License v3.0](LICENSE)

Copyright (C) 2026 Fleetr Contributors

Fleetr is free software. You may use, modify, and distribute it under the terms of the AGPL v3. Any publicly hosted modification must also be made available under the same license.
