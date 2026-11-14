# carry os

**secure your utility NFTs without giving up the benefits they provide.**

Carry OS (Carry Ownership Security) is a multichain digital asset custody and utility-preservation platform. It is being developed to help users protect valuable NFTs in dedicated blockchain vaults while retaining access to the benefits associated with those NFTs through an authorised beneficiary wallet.

Carry OS separates **where an NFT is held** from **which wallet is authorised to benefit from it**. The NFT remains in custody while the authorised beneficiary can continue using supported utility. If the user wants to sell or transfer the NFT, they must first withdraw or it called sell to the authorised wallet.

> **development status:** Carry OS is in active development. The GitHub repository contains the product architecture, implementation foundations, prototypes, backend and database work, and NEAR vault experiments. Substantial backend and database foundations have been developed in separate branches. The components are not yet one fully integrated, production-ready custody service. Authentication, wallet verification, contract deployment, beneficiary verification, and the complete deposit-to-withdrawal journey still require integration and testing.

---

## the problem

NFTs are no longer limited to digital collectibles. They can represent access, membership, ownership, and other useful privileges.

An NFT may provide:

- membership in a community or private network;
- access to events, experiences, or gated content;
- in-game items and digital equipment;
- domain names and digital identity;
- credentials, achievements, or proof of participation;
- discounts, rewards, loyalty benefits, and other token-gated privileges.

These assets can have value beyond their resale price. Losing the wallet that holds one can also mean losing the asset and the benefits attached to it.

People use everyday wallets for many blockchain activities, including trading, minting, connecting to applications, signing transactions, and approving smart contract permissions. A compromised wallet or malicious approval can put the assets it controls at risk.

Moving an NFT into another wallet can reduce exposure, but it may introduce a second problem. Some applications check the NFT's direct on-chain owner when deciding who receives its benefits. If the NFT is held by a separate custody contract, those applications may no longer recognise the person who is entitled to use it.

**Protecting an NFT should not mean losing access to what makes that NFT valuable.**

## how Carry OS solves the problem

Carry OS is designed around two separate responsibilities:

1. **asset custody:** the vault holds the NFT and enforces the rules for deposits, beneficiary changes, and withdrawals.
2. **beneficiary access:** a wallet authorised under the vault's rules remains associated with the NFT and can prove its entitlement to supported applications.

A user connects the wallet that currently holds an eligible NFT and authorises its deposit into the corresponding Carry Vault on the NFT's native blockchain. The vault becomes the NFT's on-chain owner and records the original depositor and current beneficiary.

The NFT does not need to remain in the user's everyday wallet for the user to retain access to supported benefits. The authorised beneficiary wallet can continue to use those benefits when the application providing them supports Carry's beneficiary verification method.

### the intended user journey

1. **create a Carry account:** sign in through Carry OS using NEAR Auth as the intended account authentication system.
2. **connect a wallet:** connect the external blockchain wallet that holds the NFT.
3. **discover NFTs:** view eligible assets associated with that wallet and supported network.
4. **select an NFT:** review its collection, token identifier, network, and custody details.
5. **secure the NFT:** approve a deposit into the corresponding Carry Vault.
6. **verify custody:** confirm the transaction and resulting vault state on the relevant blockchain.
7. **retain beneficiary access:** use the authorised beneficiary wallet to access benefits from applications that support beneficiary verification.
8. **change the beneficiary when needed:** authorise a new beneficiary wallet according to the vault's permission rules.
9. **withdraw when required:** release the NFT to the currently authorised beneficiary wallet.

### accessing benefits while an NFT is secured

Consider an NFT that provides membership access to a community. A user deposits it into Carry Vault. The vault becomes the NFT's direct on-chain owner, but the user's authorised beneficiary wallet remains recorded against that NFT.

A compatible membership application can check the vault's current beneficiary information and recognise that wallet as entitled to the membership benefit. The NFT can remain secured in Carry Vault while the user accesses the supported benefit through the authorised wallet.

This requires an integration or verification method that the application understands. An application that checks only the NFT's direct owner may see Carry Vault as the owner and fail to recognise the beneficiary. Carry OS cannot automatically change how unrelated applications check NFT ownership.

Utility preservation is therefore a core product objective, but compatibility depends on beneficiary verification being supported by the application providing the benefit. The exact integration can vary by application, NFT standard, and blockchain.

### selling or transferring a secured NFT

An NFT cannot be sold or freely transferred from Carry Vault as if it were held in an ordinary personal wallet.

When the user wants to sell or transfer the NFT, they must first withdraw it to the currently authorised beneficiary wallet. They can then use their preferred external NFT marketplace or wallet transfer flow.

This keeps the custody model clear: while the NFT is secured, it remains under the vault's rules. Withdrawal returns it to the authorised wallet so the user can manage it normally.

---

## why the system is technically feasible

Carry OS is designed to use existing blockchain capabilities and standards rather than treating a database record as proof of asset ownership.

The first implementation target is NEAR. Its NEP-171 NFT standard provides the NFT transfer and receiver interfaces needed for a vault to accept eligible NFTs and maintain on-chain custody records. The NEAR vault implementation in the development snapshot explores this model, including approved collections, depositor and beneficiary records, beneficiary reassignment, and withdrawal by the current beneficiary.

The wider application separates account authentication, wallet ownership proof, backend coordination, persistent application data, chain-specific integrations, and smart contract-enforced custody. Each component has a defined responsibility.

| component | responsibility |
|---|---|
| NEAR Auth | intended sign-up and sign-in experience for a Carry account |
| external wallet integration | connects wallets and requests user-approved signatures and transactions |
| backend API | coordinates account operations, validates sessions and wallet proofs, and prepares and monitors product operations |
| PostgreSQL and Prisma | persist Carry accounts, identity references, linked wallets, sessions, and operational records |
| chain adapters | handle network-specific wallets, NFT discovery, transactions, and contract interactions |
| Carry Vault contracts | enforce NFT custody, beneficiary permissions, and withdrawals on-chain |
| beneficiary verification | lets compatible applications recognise the wallet authorised to use an NFT's supported benefits |

The backend and database coordinate the application. They do not become the authority over NFT custody. The relevant blockchain and vault contract must enforce asset ownership and permission changes.

A frontend screen or database record cannot prove that an NFT has been deposited. Carry OS must verify the relevant transaction and resulting contract state before presenting an asset as secured.

### the intended custody and permission model

The NEAR vault MVP explores the following authority model:

- the original depositor can authorise a beneficiary reassignment;
- the current beneficiary can request withdrawal;
- after reassignment, the previous beneficiary must no longer have the rights assigned to the new beneficiary;
- the contract enforces these permissions instead of relying only on backend checks or frontend state.

This model must be tested against the deployed contract before it is treated as a completed security guarantee. The implementation also needs clear handling for pending transactions, failed transfers, and recovery.

---

## account authentication and connected wallets

Carry OS separates the user's Carry account from the external wallets used to hold and authorise blockchain assets.

### Carry account and NEAR Auth

NEAR Auth is the intended authentication system for creating a Carry account and signing in. It provides the account-level entry point to the platform.

Signing in identifies the user within Carry OS. It does not, by itself, prove that the user controls an external wallet or owns a particular NFT. The NEAR Auth identity flow and the verification of an external wallet are separate operations.

The backend work includes an opt-in development and test authentication exchange with session persistence. It remains disabled by default while the exact NEAR Auth identity-token handoff is verified.

### connected external wallets

Users connect external wallets to discover NFTs and authorise blockchain actions. Each wallet must prove control using a verification method appropriate to its blockchain.

A user should be able to disconnect the original wallet and connect another without making the custody of an already deposited NFT depend on the wallet currently connected to the interface. The Carry account should continue to display the secured asset based on its verified custody record and on-chain state.

Changing the connected wallet and changing the NFT's beneficiary are different actions. Connecting another wallet does not automatically change the beneficiary or transfer custody rights.

---

## multichain strategy

Carry OS is being designed as a multichain platform. NEAR is the first implementation target. Ethereum, Solana, and Robinhood Chain are planned as separate integrations.

A single contract cannot custody assets across unrelated blockchains. Each network has its own wallet model, NFT standards, transaction format, and contract execution environment. Carry OS therefore uses a shared product experience with network-specific adapters and vault implementations.

| network | wallet and asset model | intended custody implementation | status |
|---|---|---|---|
| NEAR | NEAR accounts and NEP-171 NFTs | Rust-based NEAR vault contract | first implementation target; vault code and tests exist in a development snapshot; integration, local validation, and testnet deployment remain outstanding |
| Ethereum | EVM wallets and ERC-721 assets initially | separate Solidity vault contract | planned |
| Solana | Solana wallets and supported NFT standards | separate Solana program with its own account and authority model | planned; supported standards and implementation approach need to be finalised |
| Robinhood Chain | EVM-compatible wallets and selected NFT standards | separate EVM-compatible vault deployment | planned; requires its own deployment, configuration, testing, and verification |

### how multichain support will work

- **one Carry account:** users will have one Carry OS profile for managing their connected wallets and custody records.
- **separate wallet links:** users can connect wallets from different networks to the same Carry account.
- **network-specific ownership proof:** each wallet must prove control using that network's supported signature method.
- **network-specific asset identity:** an NFT is identified by its network, collection or contract, and token identifier. Similar token IDs on different networks are not the same asset.
- **chain adapters:** shared product actions use network-specific adapters for wallet operations, NFT standards, RPC access, transactions, vault interfaces, and finality rules.
- **separate custody implementations:** every supported network requires its own vault contract or program.
- **independent transaction verification:** deposits, beneficiary changes, and withdrawals must be checked against the relevant blockchain.

NEAR Auth is the intended Carry account login system. It does not create one universal wallet for every network and does not prove ownership of external Ethereum, Solana, or Robinhood Chain wallets.

A network will only be described as supported when its wallet connection, ownership proof, NFT discovery, vault, beneficiary permissions, withdrawal, transaction monitoring, tests, and deployment evidence work together. Listing a network here describes product direction, not current availability.

---

## current development progress

Carry OS has been developed across a foundation branch, backend feature branches, and implementation snapshots. These branches contain different stages of the work and should not be treated as one integrated release.

Substantial backend and database foundations have been developed. This includes PostgreSQL and Prisma schema work, initial migration work, identity and session persistence, wallet-linking experiments, and read-only NEAR testnet NFT discovery work. The next step is to integrate and verify these components with the frontend and deployed vault.

| area | current status |
|---|---|
| pnpm and Turborepo workspace | foundation available on the main branch |
| Next.js web application | interactive frontend prototype available; wallet, authentication, and blockchain actions are not fully connected |
| NestJS API | foundation and health endpoint available on the main branch |
| shared types and validation | foundation available |
| PostgreSQL and Prisma | schema and initial migration work available in the backend persistence branch; local migration validation and integration remain |
| NEAR Auth and sessions | opt-in development/test JWT exchange and PostgreSQL-backed session work available in a feature branch; disabled by default pending verification of the identity-token handoff |
| wallet linking | NEAR wallet challenge and NEP-413 signature-verification work available in a feature branch; full product integration remains |
| NFT discovery | read-only NEAR testnet demo collection and vault view work available in an implementation snapshot |
| NEAR Carry Vault | Rust NEP-171 custody contract MVP and tests available in a development snapshot; local validation, deployment, and end-to-end verification remain |
| beneficiary reassignment and withdrawal | contract and frontend call experiments exist; complete integrated lifecycle is not yet verified |
| utility beneficiary verification | design and integration work remain; third-party compatibility is not universal |
| Ethereum, Solana, and Robinhood Chain | planned, not implemented |
| production security review | not completed |

The main branch is the repository integration branch. Work in a feature branch or archived snapshot is not automatically part of the main application. A feature is not complete merely because code or a prototype exists. It must be integrated, tested, and verified in the environment being claimed.

### public development branches

- [main: repository foundation and integration branch](https://github.com/SamueladebayoPython/carry-os/tree/main)
- [OpenCode snapshot: frontend prototype](https://github.com/SamueladebayoPython/carry-os/tree/archive/opencode-snapshot)
- [Codex snapshot: broader implementation and NEAR contract work](https://github.com/SamueladebayoPython/carry-os/tree/archive/codex-snapshot)
- [backend persistence branch](https://github.com/SamueladebayoPython/carry-os/tree/codex/carry-os-backend-persistence)
- [NEAR authentication and session branch](https://github.com/SamueladebayoPython/carry-os/tree/codex/backend-near-auth-session)
- [backend architecture branch](https://github.com/SamueladebayoPython/carry-os/tree/feat/backend-architecture)
- [Prisma schema proposal branch](https://github.com/SamueladebayoPython/carry-os/tree/feat/prisma-schema-proposal)

---

## repository structure

The main branch contains the monorepo foundation. Some contract and prototype files are available only in the development snapshots linked above.

~~~text
carry-os/
├── apps/
│   ├── api/                  # NestJS backend API
│   └── web/                  # Next.js web application
├── packages/
│   ├── config/               # shared tooling configuration
│   └── shared/               # shared types and validation
├── docs/                     # architecture, roadmap, security, and API notes
├── .github/workflows/        # CI workflows
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
~~~

The NEAR contract workspace, demo NFT contract, and additional prototype files are present in the implementation snapshots. Their presence in a snapshot does not mean they have been merged into the main branch or deployed.

## running the repository foundation

The root workspace pins Node.js 24 and pnpm 12.18.0.

~~~bash
corepack enable
corepack prepare pnpm@12.18.0 --activate
pnpm install
pnpm dev
~~~

The foundation's local application addresses are:

| service | local address |
|---|---|
| web application | http://localhost:3000 |
| API health endpoint | http://localhost:3001/api/health |
| API documentation | http://localhost:3001/api/docs |

To run an individual application:

~~~bash
pnpm --filter @carry-os/web dev
pnpm --filter @carry-os/api dev
~~~

The backend persistence branch also includes a local PostgreSQL 17 Docker Compose configuration and Prisma setup. Follow that branch's README and environment instructions before running its database migrations. Do not assume those files or database features are already present on the main branch.

These commands run the repository foundation. They do not imply that the frontend prototype, backend experiments, and NEAR contracts are already connected into one working custody system.

---

## roadmap

### phase 1: product foundation and integration

- maintain the Carry OS account and dashboard experience;
- complete the NEAR Auth identity-token handoff and account session integration;
- connect and verify the first supported external wallet;
- complete the PostgreSQL and Prisma persistence integration;
- connect the frontend to the backend through agreed API contracts.

### phase 2: NEAR testnet custody lifecycle

- complete NEAR wallet ownership verification;
- complete NFT discovery and deposit eligibility checks;
- validate and deploy the NEAR Carry Vault on testnet;
- complete NFT deposit and on-chain custody verification;
- complete beneficiary reassignment and old-beneficiary revocation;
- complete withdrawal to the current beneficiary;
- display transaction links and verified on-chain custody state.

### phase 3: utility-aware beneficiary access

- define a verifiable beneficiary proof or integration interface;
- build a reference integration with an application that provides NFT-based access;
- verify that the current beneficiary receives access while the NFT remains in custody;
- verify that the previous beneficiary loses access after reassignment;
- document which utility models and integrations are supported.

### phase 4: security and production readiness

- complete independent contract and application security reviews;
- establish monitoring, recovery procedures, and operational controls;
- improve transaction reconciliation and error handling;
- define production deployment, incident response, and user support procedures.

### phase 5: additional networks

- implement Ethereum custody;
- implement Solana custody;
- implement Robinhood Chain custody;
- test each network's complete custody lifecycle;
- maintain separate deployment and security reviews for each network.

See [the detailed roadmap](docs/ROADMAP.md) for the work, rationale, and completion evidence for each phase.

---

## security principles

Carry OS is being designed around explicit permissions and verifiable blockchain state.

1. **on-chain enforcement:** custody, beneficiary reassignment, and withdrawal permissions must be enforced by the relevant vault contract.
2. **least authority:** the backend must not have unilateral power to redirect or withdraw user assets.
3. **separate authentication from ownership:** a Carry account session is not a substitute for external wallet ownership verification.
4. **explicit authorisation:** users must understand and approve the wallet and contract actions they sign.
5. **beneficiary revocation:** after reassignment, the previous beneficiary must no longer retain the rights transferred to the new beneficiary.
6. **verifiable custody:** the application must show the relevant network, contract, token identifier, transaction, and current vault state.
7. **safe transaction handling:** failed or incomplete transactions must not be presented as successful custody operations.
8. **secure application data:** private keys, seed phrases, API secrets, and production credentials must never be committed to the repository.

Carry OS remains in development and has not completed a production security audit. Experimental or unaudited contracts must not be used to secure valuable assets.

See [the security document](docs/SECURITY.md) for the threat model and required verification controls.

## project goals

Carry OS aims to make digital ownership more resilient by protecting utility NFTs separately from the wallets people use for everyday blockchain activity.

The goal is not simply to store NFTs. It is to build a custody system where users can change their authorised wallet without moving the NFT out of the vault, while compatible applications have a reliable way to verify who is entitled to use its benefits.

**secure the asset. preserve the utility. control the access.**

## license

A license has not yet been selected for this repository. Until one is added, do not assume that the code is available for unrestricted reuse.
