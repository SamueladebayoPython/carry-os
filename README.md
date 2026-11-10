# carry os

A multichain digital asset custody and utility-preservation platform.

> **Status: backend foundation plus interactive frontend demo.**
>
> The frontend demonstrates sign-in, wallet, NFT, custody, beneficiary, and
> withdrawal flows with simulated data and transactions. No real wallet,
> authentication, blockchain, custody operation, or smart contract is connected.
> The initial PostgreSQL schema and migration are prepared but still need local
> validation before use.
> Ethereum, Solana, NEAR, and Robinhood Chain are all **planned** networks.
> Nothing should be described as live or production-ready at this stage.

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
| Next.js web application | Interactive mock product UI; real auth, wallets, and chain integrations are not connected |
| NestJS API with health endpoint | Foundation implemented |
| OpenAPI/Swagger documentation | Foundation implemented for current endpoints |
| Shared types and validation contracts | Foundation implemented |
| PostgreSQL + Prisma schema | Backend-owned schema and initial migration prepared; local PostgreSQL uses Docker Compose |
| NEAR authentication and sessions | PostgreSQL-backed backend flow implemented; disabled pending FastAuth JWT handoff validation |
| Wallet connection and ownership proof | Not implemented |
| NFT discovery | Not implemented |
| Custody/vault contracts | Not implemented |
| Beneficiary changes and withdrawals | Not implemented |
| Ethereum integration | Planned — not implemented |
| Solana integration | Planned — not implemented |
| NEAR integration | Planned — not implemented |
| Robinhood Chain integration | Planned — not implemented |
| CI workflow | Foundation implemented — install, lint, type-check, build, and tests |

## Repository structure

```text
carry-os/
├── apps/
│   ├── api/                  # NestJS REST API
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
keep local credentials out of commits. Authentication stays disabled until the
FastAuth token handoff has been tested.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | NestJS API port |
| `WEB_ORIGIN` | `http://localhost:3000` | Comma-separated browser origins allowed by CORS |
| `DATABASE_URL` | Local PostgreSQL URL in `.env.example` | PostgreSQL connection used by Prisma |
| `AUTH_ENABLED` | `false` | Keep false until the FastAuth JWT handoff is confirmed |

## Database setup

`compose.yaml` provides a local PostgreSQL 17 development database. The Prisma
schema and initial migration live under `apps/api/prisma` and are owned by the
backend. Run `docker compose up -d postgres`, then
`pnpm --filter @carry-os/api prisma:migrate:dev` to apply the migration.

## Developer ownership

**Frontend developer:** Next.js application, UI and user-facing pages, wallet
connection interfaces, NEAR Wallet Selector frontend integration, frontend API
integration, and the real FastAuth testnet login/JWT handoff check.

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

This repository currently contains foundation scaffolding and an opt-in
authentication backend. Do not enable Carry authentication until the FastAuth
JWT handoff is verified. Product features, blockchain integrations, and
contract work still require the relevant decisions in
[docs/DECISIONS.md](docs/DECISIONS.md).
