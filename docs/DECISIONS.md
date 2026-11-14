# carry os decisions

> This document records approved decisions and unresolved questions. It must be
> updated before work depends on an unresolved item. **TBD** means no answer has
> been approved; do not invent one.

## 1. Approved decisions

### Product and ownership

- **D-001 — Product scope.** carry os is a multichain digital asset custody and
  utility-preservation platform supporting the ten-step workflow in
  [ARCHITECTURE.md](ARCHITECTURE.md).
- **D-002 — Network order.** NEAR is the first implementation target, beginning
  on NEAR testnet. Ethereum, Solana, and Robinhood Chain are planned for later
  phases. This is a development priority, not a claim that any network is fully
  integrated or production-ready.
- **D-003 — Testnet-first.** Development and validation begin on testnets.
  Mainnet requires a separate readiness decision.
- **D-004 — Custody source of truth.** Blockchain vault/program state is the
  authoritative record of custody. Database records and frontend state may
  describe or index custody, but cannot prove that an asset was deposited.
- **D-005 — Developer ownership.** Frontend, backend, and shared
  responsibilities are fixed as documented in [ARCHITECTURE.md](ARCHITECTURE.md).
  Changes require approval.
- **D-018 — Utility while in custody.** A supported utility NFT should remain
  usable by its currently authorised beneficiary while the NFT stays inside the
  Carry vault. The intended design separates NFT custody from beneficiary
  rights. This does not guarantee compatibility with every third-party
  application; each integration must support a way to verify the beneficiary.
- **D-019 — Connected wallet and beneficiary are separate.** Connecting or
  disconnecting an external wallet must not silently change the NFT's recorded
  beneficiary. Beneficiary changes require a separate authorised action.
- **D-020 — External sale flow.** An NFT held in a Carry vault cannot be sold or
  freely transferred through an external marketplace while it remains in
  custody. The authorised beneficiary must first withdraw it to an eligible
  wallet, then use the external marketplace. An internal Carry marketplace is
  not part of the approved scope.

### Identity and access

- **D-021 — Carry account sign-in.** NEAR Auth is the intended authentication
  method for creating and accessing a Carry account. It is separate from
  connecting an external wallet and does not, by itself, prove ownership of an
  NFT in that wallet. The backend identity-token handoff and session flow remain
  experimental and must be verified before being treated as implemented.

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

- **TBD: NEAR testnet NFT standards and supported asset types** for the first
  implementation.
- **TBD: RPC and indexer providers** for NEAR, including rate limits and
  failover policy.
- **TBD: Confirmation/finality and reorg policy** for each supported network.
- **TBD: Ethereum, Solana, and Robinhood Chain implementation details**, to be
  resolved when each network enters active development. This includes
  standards, wallet support, RPC/indexer providers, and testnet environments.
- **TBD: Robinhood Chain technical details**, including EVM compatibility,
  RPC/explorer, token standards, and testnet availability.

### Custody and contracts

- **TBD: Vault architecture** — one vault per asset, per user, factory
  deployment, or another model.
- **TBD: Contract upgradeability and administrative powers.**
- **TBD: Emergency pause, recovery, and incident authority.**
- **TBD: Exact beneficiary authority rules**, including who may assign or
  replace a beneficiary, whether the original depositor retains that power
  after reassignment, and any timelocks, confirmations, or dispute process.
- **TBD: Withdrawal authorisation model** — which signatures and on-chain
  checks are required.
- **TBD: Signing/key-management architecture**, including whether MPC, HSM, or
  another model is used.
- **TBD: Contract audit scope and deployment approval process.**

### Utility verification

- **TBD: Beneficiary verification mechanism** for applications that recognise
  Carry-held NFTs. The first implementation should include a reference
  application or integration that demonstrates benefit access while the NFT
  remains in the vault.
- **TBD: Integration interface and proof format**, including how an application
  checks the current beneficiary and how it handles revoked or reassigned
  rights.
- **TBD: Utility session expiry, caching, and revocation behaviour** so an old
  beneficiary cannot keep using a benefit after reassignment.

### Identity and sessions

- **TBD: NEAR Auth identity-token format and backend verification procedure.**
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

## 5. Decision history

- **2026-11-14:** Clarified NEAR testnet as the first implementation target;
  recorded utility preservation, beneficiary/wallet separation, external
  marketplace withdrawal flow, and NEAR Auth's intended account-sign-in role.
  Kept implementation-specific security and integration choices open.
