# carry os decisions

> This document records approved decisions and unresolved questions. It must be
> updated before work depends on an unresolved item. **TBD** means no answer has
> been approved; do not invent one.

## 1. Approved decisions

### Product and ownership

- **D-001 — Product scope.** carry os is a multichain digital asset custody and
  utility-preservation platform supporting the ten-step workflow in
  [ARCHITECTURE.md](ARCHITECTURE.md).
- **D-002 — Planned networks.** Ethereum, Solana, NEAR, and Robinhood Chain are
  planned. No network is implemented.
- **D-003 — Testnet-first.** Development and validation begin on testnets.
  Mainnet requires a separate readiness decision.
- **D-004 — Custody source of truth.** Blockchain vault/program state is the
  authoritative record of custody.
- **D-005 — Developer ownership.** Frontend, backend, and shared
  responsibilities are fixed as documented in [ARCHITECTURE.md](ARCHITECTURE.md).
  Changes require approval.

### Repository and technology

- **D-006 — Monorepo.** pnpm workspaces plus Turborepo.
- **D-007 — Node.js.** Node 24 is pinned.
- **D-008 — Integration branch.** `main` is the integration branch. Work is done
  on feature branches.
- **D-009 — Frontend.** Next.js with TypeScript.
- **D-010 — Backend.** NestJS.
- **D-011 — Database.** PostgreSQL with Prisma. Schema and migrations are owned
  by the frontend developer.
- **D-012 — API.** REST with NestJS Swagger/OpenAPI documentation.
- **D-013 — Shared contracts.** Shared types and validation contracts live in
  a shared workspace package.
- **D-014 — Package manager pin.** pnpm 12.18.0 via `packageManager`.
- **D-015 — TypeScript version.** TypeScript 6.0.3 for compatibility with the
  current NestJS toolchain. TypeScript 7 is not used.
- **D-016 — Foundation scope.** The foundation includes workspace tooling, two
  minimal applications, shared config/contracts, and documentation only.
- **D-017 — CI baseline.** A GitHub Actions workflow runs install, lint,
  type-check, build, and tests. Required status checks and branch protection are
  still **TBD**.

## 2. Deferred technology work

These are approved directions but were intentionally excluded from the
foundation task:

- Tailwind CSS setup.
- shadcn/ui component setup.
- Prisma package, schema, migrations, and database container.
- Contract workspaces using Foundry, Anchor, and the NEAR SDK.
- Wallet, authentication, NFT discovery, and custody implementation.
- Docker-based local infrastructure.

## 3. Open decisions requiring approval

### Network and chain scope

- **TBD: First implementation network and testnet.** Ethereum is a likely
  candidate, but this is not approved.
- **TBD: Supported NFT/token standards** on each network.
- **TBD: Robinhood Chain technical details**, including EVM compatibility,
  RPC/explorer, token standards, and testnet availability.
- **TBD: RPC/indexer providers** and failover policy per network.
- **TBD: Confirmation/finality and reorg policy** per network.

### Custody and contracts

- **TBD: Vault/program architecture** — one vault per asset, per user, factory
  deployment, or another model.
- **TBD: Contract upgradeability and administrative powers.**
- **TBD: Emergency pause, recovery, and incident authority.**
- **TBD: Beneficiary representation and change rules**, including timelocks,
  confirmation steps, and dispute handling.
- **TBD: Withdrawal authorisation model** — which signatures and on-chain
  checks are required.
- **TBD: Signing/key-management architecture**, including whether MPC, HSM, or
  another model is used.
- **TBD: Contract audit scope and deployment approval process.**

### Identity and sessions

- **TBD: NEAR authentication message format and verification procedure.**
- **TBD: Backend session storage, lifetime, rotation, and revocation.**
- **TBD: Challenge format and ownership-proof standards per wallet/network.**
- **TBD: Linking a NEAR identity to external wallet addresses.**
- **TBD: Recovery and re-authentication rules after wallet replacement.**
- **TBD: Step-up authentication requirements for high-risk actions.**

### Data and API

- **TBD: Prisma package boundary, schema, migration workflow, and ownership
  handoff details.**
- **TBD: Database hosting, encryption, access control, retention, and backups.**
- **TBD: API versioning strategy, error envelope, pagination, and idempotency
  conventions.**
- **TBD: OpenAPI generation/publication policy.**
- **TBD: NFT metadata normalisation, spam filtering, and caching.**
- **TBD: Audit-log content and retention.**

### Operations and governance

- **TBD: CI provider configuration and required checks.**
- **TBD: Deployment environments and hosting.**
- **TBD: Secret management.**
- **TBD: Observability, alerting, and incident response.**
- **TBD: Repository license.**
- **TBD: Contributor workflow and review requirements beyond using feature
  branches and `main`.**
- **TBD: Privacy and data-retention policy.**

## 4. Decision process

When an open decision is resolved:

1. Add or update the decision here with status, rationale, and date.
2. Update affected architecture, security, network-support, API, and roadmap
   documents.
3. Do not update implementation or documentation to claim completion before
   tests and review are complete.
