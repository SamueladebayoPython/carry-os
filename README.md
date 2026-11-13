# carry os

A multichain digital asset custody and utility-preservation platform. NEAR is
the initial implementation target.

> **Status: backend foundation plus interactive frontend demo.**
>
> The frontend demonstrates sign-in, wallet, NFT, custody, beneficiary, and
> withdrawal flows with simulated data and transactions. The Next.js app is not
> connected to a real wallet, blockchain, custody operation, smart contract, or
> backend authentication flow.
>
> A separate opt-in, PostgreSQL-backed NEAR Auth JWT exchange and session slice
> exists in the API. It is disabled by default and is not production-ready.
> The initial PostgreSQL schema and migration are prepared but still need local
> validation before use.
>
> Ethereum, Solana, NEAR, and Robinhood Chain are all **planned** networks. No
> chain integration is implemented. Nothing should be described as live or
> production-ready at this stage.

## What carry os is intended to do

carry os is intended to let a user:

1. Authenticate using NEAR.
2. Connect an external wallet.
3. Discover NFTs across supported blockchains.
4. Select an NFT and authorise its deposit.
5. Move the NFT into the chain-specific carry vault.
6. Verify custody through blockchain evidence.
7. Disconnect the original wallet.
8. Connect a replacement wallet and prove ownership.
9. Change the beneficiary without transferring the NFT out of custody.
10. Withdraw the NFT to the currently authorised beneficiary.

The custody source of truth is the blockchain vault or program state, not the
database or the API. The backend coordinates and verifies operations; it must
not be able to override on-chain custody state.

## Current implementation status

| Area | Status |
| --- | --- |
| pnpm + Turborepo workspace | Foundation implemented |
| Next.js web application | Interactive mock product UI; not connected to real auth, wallets, or chain integrations |
| NestJS API with health endpoint | Foundation implemented |
| OpenAPI/Swagger documentation | Foundation implemented for current endpoints |
| Shared types and validation contracts | Foundation implemented |
| PostgreSQL + Prisma schema | Backend-owned schema and initial migration prepared; local PostgreSQL uses Docker Compose |
| NEAR authentication and sessions | Opt-in PostgreSQL-backed NEAR Auth JWT exchange and session routes implemented; disabled by default and not production-ready |
| Wallet connection and ownership proof | Not implemented |
| NFT discovery | Not implemented |
| Custody/vault contracts | Not implemented |
| Beneficiary changes and withdrawals | Not implemented |
| Ethereum integration | Planned — not implemented |
| Solana integration | Planned — not implemented |
| NEAR integration | Planned — not implemented |
| Robinhood Chain integration | Planned — not implemented |
| CI workflow | Foundation implemented — install, lint, type-check, build, and tests |

NEAR authentication is a backend identity flow only. It does not prove control
of an external wallet and is separate from the planned NEAR asset and custody
integration.

## Repository structure

```text
carry-os/
├── apps/
│   ├── api/                  # NestJS REST API
│   │   ├── prisma/           # Prisma schema and initial migration
│   │   └── src/              # API source
│   └── web/                  # Next.js frontend
├── packages/
│   ├── config/               # Shared ESLint configuration
│   └── shared/               # Shared types and validation contracts
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── NETWORK-SUPPORT.md
│   ├── ROADMAP.md
│   └── SECURITY.md
├── .github/
│   └── workflows/
│       └── ci.yml            # Install, lint, type-check, build, test
├── .env.example
├── .editorconfig
├── .gitignore
├── .nvmrc
├── compose.yaml              # Local PostgreSQL 17 development database
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── turbo.json
```

## Prerequisites

- Node.js 24.x — pinned in `.nvmrc` and `package.json`
- pnpm 12.x — pinned through the `packageManager` field

Corepack is the preferred way to activate the pinned package manager:

```bash
corepack enable
corepack prepare pnpm@12.18.0 --activate
```

If Corepack is unavailable in your environment, install the pinned version
directly:

```bash
npm install --global pnpm@12.18.0
```

## Getting started

```bash
pnpm install
Copy-Item .env.example .env
docker compose up -d postgres
pnpm --filter @carry-os/api prisma:migrate:dev
pnpm dev
```

Local URLs:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:3000` |
| API health | `http://localhost:3001/api/health` |
| Swagger UI | `http://localhost:3001/api/docs` |

The frontend and backend can also be run independently:

```bash
pnpm --filter @carry-os/web dev
pnpm --filter @carry-os/api dev
```

## Backend API

The NestJS API is mounted under `/api` and currently exposes:

| Endpoint | Status |
| --- | --- |
| `GET /api/health` | Implemented liveness check; does not check the database, blockchain, or custody state |
| `POST /api/auth/near/verify` | Opt-in development/test NEAR Auth JWT exchange; returns 503 while `AUTH_ENABLED=false` |
| `GET /api/auth/session` | Opt-in session read and CSRF token re-derivation |
| `POST /api/auth/logout` | Opt-in session revocation with Origin and CSRF checks |

The API validates configuration at startup, applies Helmet security headers and
CORS, and rate-limits matched API routes. Product-domain endpoints beyond health
and the opt-in auth routes are not implemented. Swagger UI documents the current
endpoints at `http://localhost:3001/api/docs`.

## Root commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the web and API development servers |
| `pnpm build` | Build shared packages and both applications |
| `pnpm lint` | Run ESLint across the workspace |
| `pnpm typecheck` | Type-check the workspace |
| `pnpm test` | Build and run the available foundation tests |

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:

1. Install with the frozen lockfile.
2. Lint.
3. Type-check.
4. Build.
5. Run the available tests.

Branch protection and required-check configuration are still **TBD**.

## Environment variables

The API and Prisma CLI load the root `.env` file. Start from `.env.example` and
keep local credentials out of commits. `.env.example` currently documents the
runtime, CORS, and rate-limit settings; add the database and authentication
values to `.env` when enabling the opt-in auth flow. Authentication stays
disabled by default until the NEAR Auth identity JWT handoff has been tested.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime environment: `development`, `test`, or `production` |
| `PORT` | `3001` | NestJS API port |
| `WEB_ORIGIN` | `http://localhost:3000` | Comma-separated browser origins allowed by CORS; required in production |
| `DATABASE_URL` | Prisma CLI fallback to the local Docker Compose database | PostgreSQL connection used by Prisma; required when `AUTH_ENABLED=true` |
| `AUTH_ENABLED` | `false` | Enables the opt-in NEAR Auth session routes; intended for development/test and not production-ready |
| `AUTH_SESSION_STORE` | `database` | Session store; `database` is the only supported value |
| `AUTH_CSRF_SECRET` | unset | Server-side CSRF HMAC secret; at least 32 bytes when auth is enabled |
| `NEAR_AUTH_ISSUER` | unset | Required NEAR Auth token issuer when auth is enabled |
| `NEAR_AUTH_AUDIENCE` | unset | Required NEAR Auth token audience when auth is enabled |
| `NEAR_AUTH_JWKS_URI` | unset | Required JWKS endpoint; HTTPS except non-production HTTP |
| `RATE_LIMIT_LIMIT` | `100` | Maximum requests per client IP per window, shared across matched API routes (1–100000) |
| `RATE_LIMIT_TTL_SECONDS` | `60` | Rate-limit window in seconds (1–86400) |

Rate limiting uses the throttler's in-memory store, so counters are per API
process and are not shared between instances. `GET /api/health` is exempt.
Forwarded IP headers are not trusted; the client IP is the direct connection
address.

### Authentication and sessions

Authentication is disabled by default. The current implementation is intended
for development/test use and is not production-ready. When enabled, the API
validates an RS256 NEAR Auth identity JWT against the configured issuer,
audience, subject, expiry, and JWKS endpoint. It does not accept a NEAR account
ID or email as proof of identity.

Enabling authentication requires `DATABASE_URL`, an `AUTH_CSRF_SECRET` of at
least 32 bytes, and the NEAR Auth issuer, audience, and JWKS values. Sessions are
stored in PostgreSQL with only hashes of the opaque session and CSRF tokens. The
session cookie is HttpOnly, scoped to `/api`, and SameSite=Lax. The CSRF value
must be sent in `X-CSRF-Token` for state-changing protected routes, and logout
also requires an allowed `Origin`.

The flow is not production-ready. The frontend is not yet wired to it, the exact
NEAR Auth token handoff still needs verification, and protected product routes
and authorization policies are not implemented. See
[docs/API.md](docs/API.md) and [docs/SECURITY.md](docs/SECURITY.md).

## Database setup

`compose.yaml` provides a local PostgreSQL 17 development database. The Prisma
schema and initial migration live under `apps/api/prisma` and are owned by the
backend. Run `docker compose up -d postgres`, then
`pnpm --filter @carry-os/api prisma:migrate:dev` to apply the migration.

The Prisma CLI reads `DATABASE_URL` from the root `.env` and otherwise falls back
to the local Docker Compose database. The API requires `DATABASE_URL` when
`AUTH_ENABLED=true` because authentication sessions are persisted through
Prisma. Validate the initial migration against a local PostgreSQL database
before relying on it. The database is coordination and evidence storage, not
proof of custody.

## Developer ownership

**Frontend developer:** Next.js application, UI and user-facing pages, wallet
connection interfaces, NEAR Wallet Selector frontend integration, frontend API
integration, and the real NEAR Auth testnet login/JWT handoff check.

**Backend developer:** NestJS services and APIs, NEAR authentication
verification, backend sessions and protected access, wallet ownership
verification, NFT discovery services, custody operation coordination,
beneficiary changes, withdrawals, transaction monitoring, blockchain
integrations.

**Shared:** architecture, API contracts, shared types, security decisions,
smart contract design, integration testing.

Ownership boundaries must not be changed without approval. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Security](docs/SECURITY.md)
- [Network support](docs/NETWORK-SUPPORT.md)
- [Decisions](docs/DECISIONS.md)
- [API](docs/API.md)

## Scope boundary

This repository currently contains foundation scaffolding, an interactive mock
frontend, and an opt-in authentication backend. Do not enable Carry
authentication until the NEAR Auth JWT handoff is verified. Product features,
blockchain integrations, and contract work still require the relevant decisions
in [docs/DECISIONS.md](docs/DECISIONS.md).
