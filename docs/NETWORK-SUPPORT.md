# carry os network support

> **Status:** all four networks are planned. **None is implemented.**
> No contract or program has been deployed to any testnet or mainnet.

## 1. Support policy

A network moves through these states:

| State | Meaning |
| --- | --- |
| **Planned** | Named in the product scope. No working integration is claimed. |
| **In progress** | Active implementation exists, but is incomplete and not approved for use. |
| **Implemented** | Integration, tests, documentation, and required security review are complete for the stated environment. |

Rules:

- A network is never marked implemented because another network works.
- Testnet and mainnet are separate claims; testnet success does not imply
  mainnet support.
- The network status must match the code and tests.
- Unresolved details are documented as **TBD**, not guessed.

## 2. Current status

| Network | Status | Environment | Contracts/programs | Integration tests |
| --- | --- | --- | --- | --- |
| Ethereum | Planned — not implemented | TBD | None | None |
| Solana | Planned — not implemented | TBD | None | None |
| NEAR | Planned — not implemented | TBD | None | None |
| Robinhood Chain | Planned — not implemented | TBD | None | None |

The shared contract package lists all four as `planned` so the UI and API
cannot accidentally present them as live.

## 3. Integration dependencies

### Ethereum

Planned dependency areas:

- EVM RPC provider and testnet selection — **TBD**
- Block explorer and verification workflow — **TBD**
- NFT discovery source or indexer — **TBD**
- Supported token standards (for example ERC-721/ERC-1155) — **TBD**
- Solidity + Foundry + OpenZeppelin contract workspace — not created
- Vault architecture, upgradeability, and admin model — **TBD**
- Confirmation/finality and reorg handling — **TBD**
- Signer/key-management model — **TBD**
- Testnet deployment and end-to-end tests — not started

### Solana

Planned dependency areas:

- Solana RPC provider and testnet/cluster selection — **TBD**
- NFT metadata standard and ownership model — **TBD**
- Discovery source or indexer — **TBD**
- Rust + Anchor program workspace — not created
- Program-derived account/vault model — **TBD**
- Commitment level, finality, and fork handling — **TBD**
- Signer/key-management model — **TBD**
- Testnet deployment and end-to-end tests — not started

### NEAR

NEAR has two integration roles: authentication/coordination and asset custody.

Planned dependency areas:

- NEAR RPC provider and testnet selection — **TBD**
- NEAR Wallet Selector configuration and frontend flow — **TBD**
- Backend verification of NEAR authentication — **TBD**
- NFT standards (for example NEP-171/NEP-177) and metadata discovery — **TBD**
- Rust + NEAR SDK contract workspace — not created
- Custody contract model and beneficiary representation — **TBD**
- Discovery source or indexer — **TBD**
- Finality and transaction monitoring — **TBD**
- Signer/key-management model — **TBD**
- Testnet deployment and end-to-end tests — not started

### Robinhood Chain

Technical details are **TBD**. Do not assume EVM compatibility, token standards,
RPC behavior, or testnet availability until confirmed.

Planned dependency areas:

- Network identity, architecture, and EVM compatibility — **TBD**
- Testnet availability and RPC/explorer providers — **TBD**
- Supported token/NFT standards — **TBD**
- Vault/program model — **TBD**
- Discovery source or indexer — **TBD**
- Finality and transaction monitoring — **TBD**
- Signer/key-management model — **TBD**
- Deployment and tests — not started

## 4. Shared cross-network dependencies

These must be resolved once and reused carefully, without hiding chain-specific
differences:

- chain abstraction/adapter boundaries;
- identity linking between NEAR and external wallets;
- challenge/signature verification per chain;
- custody transaction state machine and idempotency;
- transaction monitoring, confirmations, and reorg handling;
- metadata normalisation and spam filtering;
- provider failover and rate-limit handling;
- secrets and key management;
- testnet funding and environment access;
- audit and deployment approval.

## 5. Evidence required before marking a network implemented

- Working testnet integration in the repository.
- Automated unit and integration tests passing in CI.
- Documented contract/program addresses and deployment process.
- Confirmed token standard scope and discovery coverage.
- Transaction monitoring and failure-mode tests.
- Security review and, where applicable, contract audit.
- Updated product UI and API documentation.
- Explicit approval in `docs/DECISIONS.md`.

Until all applicable evidence exists, the network remains planned or in
progress.
