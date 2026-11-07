# carry os architecture

> **Status:** foundation only. This document describes the intended product and
> the boundaries for future work. It does not claim that any product workflow,
> network integration, contract, or database feature is implemented.

## 1. Product purpose

carry os is a multichain digital asset custody and utility-preservation
platform. It is intended to let a user authenticate with NEAR, connect external
wallets, discover NFTs, deposit selected NFTs into chain-specific custody
vaults, prove custody through blockchain evidence, replace the controlling
wallet, change the beneficiary without moving the asset, and withdraw to the
currently authorised beneficiary.

The product is **testnet-first**. All four named networks — Ethereum, Solana,
NEAR, and Robinhood Chain — are planned. Each network requires its own
integration, contract or program work, transaction model, and test suite.

## 2. Architectural principles

1. **Blockchain custody state is authoritative.** A vault or program holds the
   asset. Database records and API responses are indexes, coordination state,
   or evidence references, not substitutes for chain state.
2. **The backend coordinates; it does not silently override custody.** Any
   operation that changes ownership or beneficiary rights must be backed by
   on-chain state and the required cryptographic authorisation.
3. **Network integrations are independent.** A successful integration on one
   chain does not imply support for another.
4. **No integration is complete without tests.** Testnet deployment and
   integration evidence are required before a network is marked implemented.
5. **Security decisions are shared and explicit.** Challenge formats, signing
   authority, session behavior, key management, and upgradeability are recorded
   as decisions before implementation.
6. **No secrets in source control.** Only placeholder environment examples are
   committed.

## 3. System context

```text
                         +---------------------------+
                         |        Browser            |
                         |  Next.js web application  |
                         +-------------+-------------+
                                       |
                                 REST / JSON
                                       |
                         +-------------v-------------+
                         |      NestJS REST API      |
                         | auth · discovery · ops    |
                         +------+----------+---------+
                                |          |
                    +-----------+          +---------------------+
                    |                                              |
       +------------v------------+                  +--------------v--------------+
       | PostgreSQL + Prisma     |                  | Chain integration adapters  |
       | schema owner: frontend  |                  | (planned, per network)      |
       | not implemented         |                  +--------------+--------------+
       +-------------------------+                                 |
                                             +---------------------+---------------------+
                                             |                     |                     |
                                  +----------v------+   +----------v------+   +----------v------+
                                  | Ethereum vaults |   | Solana programs |   | NEAR contracts  |
                                  | planned         |   | planned         |   | planned         |
                                  +-----------------+   +-----------------+   +-----------------+
                                                                                        |
                                                                              Robinhood Chain
                                                                              vaults: planned,
                                                                              details TBD
```

NEAR also participates in authentication and wallet coordination. NEAR Wallet
Selector integration belongs to the frontend; verification of NEAR
authentication belongs to the backend.

## 4. Monorepo layout and responsibilities

| Path | Responsibility | Current status |
| --- | --- | --- |
| `apps/web` | Next.js UI, pages, wallet interfaces, NEAR Wallet Selector flow, API integration | Foundation page only |
| `apps/api` | NestJS REST API, session enforcement, ownership verification, discovery, custody coordination, monitoring, chain integrations | Health endpoint only |
| `packages/shared` | Shared types and validation contracts used across the workspace | Foundation contracts only |
| `packages/config` | Shared tooling configuration, currently ESLint | Foundation tooling |
| `packages/database` | Intended home for Prisma schema/client if the team chooses a package boundary | Does not exist yet |
| `contracts/` | Intended home for EVM, Solana, and NEAR contract workspaces | Does not exist yet |

A database package was intentionally not created in this foundation task. The
frontend developer owns the initial Prisma schema and migrations and must
coordinate the package boundary, schema, and migration workflow before
implementation.

## 5. Product workflow and trust boundaries

The intended workflow is:

1. **NEAR authentication.** The user authenticates through a NEAR wallet flow.
2. **External wallet connection.** The user connects the wallet that controls
   the NFT on its source chain.
3. **NFT discovery.** The API discovers candidate assets, using chain-native
   reads and/or indexers depending on the approved provider decision.
4. **Asset selection and deposit authorisation.** The user selects an NFT and
   authorises its deposit.
5. **Vault deposit.** The chain-specific carry vault receives the NFT.
6. **Custody verification.** The system verifies vault state and on-chain
   evidence before treating the asset as held.
7. **Original wallet disconnect.** The original wallet is disconnected and a
   replacement wallet is connected.
8. **Replacement wallet proof.** The user connects the replacement wallet and
   proves control through the approved challenge/signature mechanism.
9. **Beneficiary change.** The beneficiary is changed without transferring the
   NFT out of custody, subject to the approved on-chain authorisation rules.
10. **Withdrawal.** The asset is withdrawn only to the currently authorised
    beneficiary.

Each transition requires explicit authorisation rules. The challenge format,
beneficiary model, recovery model, and withdrawal authority are **TBD** and
must be approved before implementation. The backend must not be treated as the
source of truth for any of these rights.

## 6. Chain integration boundaries

Each chain requires a separate integration boundary, covering:

- RPC and indexer access;
- token/NFT standard detection and metadata normalisation;
- vault or program interaction;
- transaction construction and monitoring;
- confirmation/finality rules and reorg handling;
- error, retry, and idempotency behavior;
- testnet deployment and integration tests.

The concrete adapter interface, signer model, and transaction monitoring design
are **TBD**. No contracts or programs exist in this repository.

Ethereum, Solana, NEAR, and Robinhood Chain are all planned. See
[NETWORK-SUPPORT.md](NETWORK-SUPPORT.md) for per-network dependencies.

## 7. Database responsibilities (not implemented)

The database is expected to support coordination, indexing, and auditability,
while remaining subordinate to on-chain custody state. The frontend developer
owns the initial PostgreSQL/Prisma schema and migrations; the backend developer
consumes it.

Expected responsibilities to coordinate, subject to schema design approval:

- NEAR identities and their linked wallet addresses;
- backend session and revocation metadata, if persisted;
- NFT discovery cache/index records;
- deposit requests and references to on-chain custody evidence;
- beneficiary-change intents and approval history;
- withdrawal requests and transaction monitoring records;
- idempotency keys and operation state machines;
- audit events;
- chain/network configuration references that do not contain secrets.

Explicit constraints:

- No Prisma schema or migration has been created in this task.
- The database must not be presented as the authoritative owner of a vaulted
  asset.
- Storing private keys, seed phrases, wallet secrets, or unencrypted session
  secrets is out of scope and requires a separate security decision.
- Retention, encryption, access-control, and migration policies are **TBD**.

## 8. API and shared contracts

The API is REST, documented with NestJS Swagger/OpenAPI. Shared request and
response contracts belong in `packages/shared` and must be agreed by both
developers before product endpoints are implemented.

The only implemented endpoint is `GET /api/health`. All product endpoint
contracts are **TBD**. See [API.md](API.md).

## 9. Deployment and operations

Deployment topology, hosting, database hosting, secret management, observability,
backup/restore, and incident response are **TBD**. Testnet-first is approved:
no mainnet deployment should be treated as supported until explicitly approved
after security review.

## 10. Developer ownership

**Frontend developer**

- Next.js application
- UI and user-facing pages
- Wallet connection interfaces
- NEAR Wallet Selector frontend flow
- PostgreSQL and Prisma schema and migrations
- Frontend API integration

**Backend developer**

- NestJS services and APIs
- NEAR authentication verification
- Backend sessions and protected access
- Wallet ownership verification
- NFT discovery services
- Custody operation coordination
- Beneficiary changes
- Withdrawals
- Transaction monitoring
- Blockchain integrations

**Shared**

- Architecture
- API contracts
- Shared types
- Security decisions
- Smart contract design
- Integration testing

These boundaries must not be changed without approval.
