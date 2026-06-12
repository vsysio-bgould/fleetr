# Contributing to Fleetr

Thanks for your interest in contributing. This document covers how to get a local environment running, the branching and PR workflow, and the standards your code needs to meet before it will be merged.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Setup](#local-setup)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Submitting a Pull Request](#submitting-a-pull-request)
6. [Code Standards](#code-standards)
7. [Reporting Bugs](#reporting-bugs)
8. [Suggesting Features](#suggesting-features)

---

## Prerequisites

- **Node.js** 20+ (LTS)
- **Docker** and **Docker Compose** (for MySQL and Redis)
- **A registered EVE Online ESI application** — create one at [developers.eveonline.com](https://developers.eveonline.com). Set the callback URL to `http://localhost:3000/api/v1/auth/callback`.
- A **PartyKit** account for local real-time development (or use the `--dev` flag to run PartyKit locally without an account)

---

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/fleetr.git
cd fleetr

# 2. Install dependencies
npm install

# 3. Start MySQL and Redis
docker compose up -d

# 4. Copy and fill in environment variables
cp .env.example .env
# Edit .env — at minimum you need:
#   DATABASE_URL, REDIS_URL, ESI_CLIENT_ID, ESI_CLIENT_SECRET, SESSION_SECRET

# 5. Run database migrations
npx prisma migrate dev

# 6. Seed default settings
npm run db:seed

# 7. Start the Next.js dev server
npm run dev

# 8. (Separate terminal) Start the PartyKit dev server
npx partykit dev
```

The app will be at `http://localhost:3000`. The PartyKit server will be at `http://localhost:1999`.

---

## Project Structure

```
src/
├── app/          # Next.js App Router — pages and API routes
├── components/   # React components (see docs/COMPONENT-CONTRACT.md)
├── services/     # Application layer — one service per bounded context
├── domain/       # Pure domain logic and types
├── infra/        # Infrastructure adapters (DB, ESI, Redis, PartyKit)
├── workers/      # BullMQ workers
├── lib/          # Shared utilities and hooks
├── providers/    # React context providers
└── config/       # Constants, schedules, scope definitions
party/            # PartyKit server
docs/             # Architecture and design documents
prisma/           # Schema and migrations
```

Full architecture, naming conventions, and file organisation rules are in [docs/CODING-STANDARDS.md](docs/CODING-STANDARDS.md).

---

## Development Workflow

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/{short-description}` | `feature/battle-mode-volume` |
| Bug fix | `fix/{short-description}` | `fix/queue-vote-dedup` |
| Documentation | `docs/{short-description}` | `docs/esi-gateway` |
| Refactor | `refactor/{short-description}` | `refactor/extract-fleet-service` |
| Chore | `chore/{short-description}` | `chore/update-prisma` |

Branch off `main`. Keep branches short-lived and focused on one concern.

### Commit messages

Use the imperative mood, present tense. One line for simple changes; add a blank line and body for anything non-obvious.

```
Add battle mode volume reduction to playback service

Volume is reduced to the configurable battleModeVolume setting (default 0.25)
when the FC switches to Battle Mode. The YouTube IFrame API setVolume call
is broadcast to all connected clients via the PartyKit room.
```

Do not reference internal ticket numbers or personal context in commit messages — they are meaningless to external contributors.

### Running tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Type checking only
npx tsc --noEmit
```

Tests use `vitest`. Test files live adjacent to their source (`Foo.ts` → `Foo.test.ts`). See [docs/CODING-STANDARDS.md](docs/CODING-STANDARDS.md) §12 for testing standards.

---

## Submitting a Pull Request

1. **Fork** the repository and create your branch from `main`.
2. **Make your changes.** Follow the code standards below.
3. **Write or update tests** for any changed behaviour.
4. **Run the test suite** and confirm it passes: `npm test && npx tsc --noEmit`.
5. **Open a Pull Request** against `main` on GitHub.

### PR checklist

Before marking your PR as ready for review, confirm:

- [ ] `npm test` passes with no failures
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] New ESI calls go through `EsiClient` in `src/infra/esi/` — no direct `fetch` to ESI
- [ ] No secrets, tokens, or real credentials are included anywhere
- [ ] Component additions follow [docs/COMPONENT-CONTRACT.md](docs/COMPONENT-CONTRACT.md)
- [ ] New services use constructor injection — no self-instantiation of infrastructure
- [ ] `console.log` has not been introduced (use the structured logger)

### PR description

A good PR description includes:

- **What** changed (one or two sentences)
- **Why** it was necessary (motivation, bug context, or feature request)
- **How to test** it manually (steps a reviewer can follow)
- Screenshots for any UI changes

Small, focused PRs are much easier to review than large ones. If your change is large, consider splitting it into a structural PR (file moves, renames) followed by a logic PR.

### Review process

- At least one maintainer approval is required before merge.
- Maintainers may request changes or ask clarifying questions — please respond or update the PR within a reasonable timeframe.
- PRs with failing checks will not be merged until the checks pass.
- Squash merging is used — your individual commits are collapsed into one on `main`. Write a clean PR title; it becomes the squash commit message.

---

## Code Standards

All contributions must follow the conventions in [docs/CODING-STANDARDS.md](docs/CODING-STANDARDS.md). The short version:

- **Architecture**: Interface → Application → Infrastructure. Inner layers never import from outer layers.
- **Dependency injection**: Services receive dependencies via constructor. No service instantiates its own infrastructure.
- **Errors**: Throw `AppError` subclasses for expected failures. Never throw raw `Error` for business conditions.
- **ESI**: All ESI calls go through `EsiClient`. Respect `expires` headers. Never circumvent caching.
- **Components**: Build from the approved component set in [docs/COMPONENT-CONTRACT.md](docs/COMPONENT-CONTRACT.md). Do not invent one-off patterns.
- **Logging**: Structured `pino` logger only. No `console.log`.
- **Dead code**: Do not ship commented-out code, unused imports, or unreachable branches.

---

## Reporting Bugs

Open an issue on GitHub using the **Bug Report** template. Include:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, browser if relevant)
- Any relevant log output (redact tokens and credentials)

---

## Suggesting Features

Open an issue using the **Feature Request** template. Describe the problem you're trying to solve, not just the solution you have in mind. If the feature involves a new ESI scope or new EVE Online data access, note that in the issue — scope additions require extra design consideration.

---

## A note on EVE Online

Fleetr is a third-party EVE Online application. All contributors are expected to be familiar with the [EVE Online Third-Party Developer License Agreement](https://developers.eveonline.com/license-agreement) and ensure their contributions remain compliant with it. In particular: do not add features that use ESI for bulk discovery of structures, characters, or other game entities.
