# carry os roadmap

> **Status:** planning document. Nothing below is implemented unless explicitly
> marked. All networks are planned and testnet-first.

No dates are committed. Phases are ordered to reduce security and integration
risk, not to promise delivery dates.

## Status definitions

- **Delivered in foundation task:** repository scaffolding and local development
  commands only.
- **Planned:** approved direction, not implemented.
- **TBD:** unresolved decision or dependency that requires approval.

## Phase 0 — Repository foundation

**Status:** delivered in this foundation task, pending review.

- pnpm workspace and Turborepo task graph
- Node 24 and pnpm 12 version pins
- Next.js and NestJS applications
- Health endpoint and Swagger/OpenAPI setup
- Shared contracts package
- Shared ESLint configuration
- GitHub Actions CI for install, lint, type-check, build, and tests
- Documentation baseline

**Not included:** database schema, authentication, wallets, NFT discovery,
contracts, and custody operations.

## Phase 1 — Architecture and custody design

**Status:** planned.

- Approve vault/program architecture for each chain.
- Define beneficiary-change and withdrawal authorisation rules.
- Define signer/key-management model.
- Define contract upgradeability and emergency controls.
- Define account/identity and session model.
- Agree API contract conventions and shared validation approach.
- Define database responsibilities and schema ownership handoff.
- Establish testnet provider/RPC/indexer choices.

**Exit criteria:** architecture decisions recorded and approved before code
that depends on them is implemented.

## Phase 2 — NEAR authentication and backend sessions

**Status:** planned. Ownership: frontend flow + backend verification.

- Frontend FastAuth integration is owned outside the backend task.
- Backend JWT verification and opaque session exchange are implemented as an
  opt-in development/test slice; production persistence remains outstanding.
- Session expiry, logout revocation, CSRF token issuance, and a reusable
  session guard are implemented for development/test.
- Integration tests for authentication and session behavior.

**Dependencies:** frontend confirmation of supported identity JWT handoff;
confirmed NEAR Auth issuer/audience/JWKS configuration; approved persistent
session and identity storage design before production use.

## Phase 3 — External wallet connection and ownership proof

**Status:** planned. Ownership: frontend interfaces + backend verification.

- Wallet connection UX for the supported chain.
- Challenge/nonce lifecycle and domain binding.
- Signature verification per chain.
- Replay protection and address-linking rules.
- Tests for valid, invalid, expired, and replayed proofs.

**Dependencies:** approved signature standards per network; NEAR identity link
model.

## Phase 4 — NFT discovery

**Status:** planned. Ownership: backend services + frontend presentation.

- Select indexers/RPC sources per chain.
- Normalise NFT metadata and ownership.
- Handle pagination, rate limits, failures, and spam filtering.
- Cache/index strategy and data retention.
- Integration tests against testnet or provider sandboxes.

**Dependencies:** provider selection, token standard scope, database schema.

## Phase 5 — First custody integration (EVM testnet)

**Status:** planned. Ownership: shared contract design + backend integration.

- Solidity vault contract using Foundry and OpenZeppelin.
- Deposit authorisation and on-chain custody evidence.
- Transaction monitoring and confirmation rules.
- Testnet deployment and end-to-end tests.

**Dependencies:** approved vault model, signer model, testnet, audit policy.
Ethereum is the likely first EVM target, but the first-network order is **TBD**
and requires approval.

## Phase 6 — Beneficiary changes and withdrawals

**Status:** planned. Ownership: backend coordination + shared contract design.

- Beneficiary-change authorisation without asset transfer.
- Replacement-wallet ownership proof integration.
- Withdrawal to the currently authorised beneficiary.
- Recovery, emergency, and dispute behavior.
- Adversarial and integration tests.

**Dependencies:** approved beneficiary model and withdrawal authority, contract
security review, session/ownership verification.

## Phase 7 — Additional networks

**Status:** planned. Each network is independent.

- Solana programs with Rust and Anchor.
- NEAR contracts with Rust and the NEAR SDK.
- Robinhood Chain integration after its technical details are confirmed.
- Network-specific discovery, transaction monitoring, and tests.

A network is not marked implemented until its integration and tests pass. No
network inherits another network's status.

## Phase 8 — Hardening and production readiness

**Status:** planned.

- Smart contract audits.
- Threat modelling and penetration testing.
- Key-management/HSM/KMS deployment.
- Observability, alerting, and incident runbooks.
- Backup/restore and disaster recovery validation.
- Mainnet readiness review and explicit approval.

**No mainnet support should be claimed before this phase is complete.**

## Cross-cutting work

The following are planned but not assigned to a single phase:

- Basic CI hardening, required status checks, and branch protection.
- Integration test environments.
- API versioning and error contract.
- Documentation maintenance and ADR process.
- Dependency and contract security review.
- Privacy/data retention policy.
- Frontend design system and accessibility.
- Tailwind CSS and shadcn/ui setup — approved technology direction, deferred
  from the minimal foundation task.

## Current non-claims

- No network integration is implemented.
- No contract or program is deployed.
- No external wallet ownership verification exists. Carry account auth is an
  opt-in development/test backend slice and is not production-ready.
- No NFT discovery exists.
- No database schema or migration exists.
- No custody operation exists.
- No custody, wallet, or NFT product endpoints exist beyond health and the
  opt-in development/test auth routes.
