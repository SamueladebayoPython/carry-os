# carry os

**protect the utility behind your NFTs, even when your everyday wallet changes.**

carry os is a multichain digital asset custody and utility-preservation platform. it is designed to let people move valuable utility NFTs out of everyday wallets and into dedicated chain-specific vaults, then manage who is entitled to use or withdraw those assets without repeatedly moving the NFT between personal wallets.

> **project status:** carry os is an active hackathon project and prototype, not a production custody service. the repository contains a foundation on `main`, plus separate prototype and experimental implementation branches. the complete user journey has not been verified as a live, end-to-end on-chain system. implementation status is described honestly below.

---

## the problem

people use NFTs for more than collecting images. an NFT can represent:

- membership in a community or private network
- access to events, experiences, or gated content
- in-game items and digital equipment
- a domain name or digital identity
- credentials, achievements, or proof of participation
- benefits, discounts, loyalty points, or other token-gated privileges

these assets can carry value beyond their resale price. losing access to the wallet that holds one can mean losing the asset and the utility attached to it.

everyday wallets are used for many activities: trading, minting, connecting to unfamiliar applications, signing transactions, and interacting with smart contracts. that creates exposure. a compromised wallet can put every asset it controls at risk, including NFTs that represent memberships, access, or other ongoing benefits.

moving an NFT to a new wallet is not always a complete solution. it can be inconvenient, and applications that check the NFT's direct owner may stop recognising the new holder. custody therefore needs to address both asset control and the way an authorised person proves their entitlement.

## the carry os approach

carry os separates **where an NFT is held** from **who is authorised to benefit from it**.

a user deposits an eligible NFT into a dedicated carry vault on its native blockchain. the vault records the original depositor and the currently authorised beneficiary. the depositor can reassign the beneficiary when control needs to move to another wallet. the beneficiary can withdraw the NFT according to the vault's rules.

the intended result is that the NFT does not need to move every time the user's everyday wallet changes.

### the intended user journey

1. **create a carry account** — enter carryos through its account and authentication flow.
2. **connect a wallet** — connect the wallet that currently holds the NFT.
3. **discover assets** — view eligible NFTs associated with that wallet and supported network.
4. **select an NFT** — review the collection, token, network, and custody details before proceeding.
5. **secure it in carry** — authorise a deposit into the corresponding chain-specific carry vault.
6. **verify custody** — confirm the resulting transaction and vault record on the relevant blockchain.
7. **change the beneficiary when needed** — the original depositor authorises a new beneficiary wallet. the previous beneficiary loses the rights assigned to the previous authorisation.
8. **withdraw when required** — the currently authorised beneficiary can request withdrawal under the vault's rules.

the original depositor and the beneficiary have distinct responsibilities. the depositor is the authority for beneficiary reassignment; the current beneficiary is the authority for withdrawal. the smart contract, not a frontend screen or database record, must enforce these permissions.

## what carry os is designed to protect

| capability | purpose |
| --- | --- |
| dedicated custody | keep selected NFTs separate from assets used in an everyday wallet |
| beneficiary management | change the wallet authorised to benefit from a deposited NFT |
| withdrawal control | restrict withdrawal to the currently authorised beneficiary |
| custody verification | use on-chain state and transaction evidence as the source of truth |
| multichain design | support assets on their native networks through chain-specific vault implementations |
| utility-aware access | provide a way for integrated applications to recognise an authorised beneficiary |

## an important distinction: custody is not automatic utility portability

when an NFT is deposited into a vault, the vault becomes its on-chain owner. a third-party application that checks only the NFT's direct owner may not automatically recognise the beneficiary recorded by carry os.

carry os therefore treats utility preservation as an integration problem, not a promise that every NFT benefit will continue working without changes. applications may need to verify a beneficiary through a supported proof, interface, or integration. the exact mechanism depends on the NFT standard, the application, and the chain.

the goal is to make custody and beneficiary entitlement verifiable while giving third-party products a practical way to recognise the authorised user.

---

## product model

### carry account

the carry account is the user's entry point to the platform. the intended authentication experience uses NEAR authentication and passkey-friendly access. account identity and control of an external wallet are separate concepts: signing in to carry should not, by itself, be treated as proof that a user owns an NFT.

### connected wallets

users connect external wallets to discover assets and authorise blockchain actions. wallet connection, wallet ownership verification, and carry account authentication are separate steps and must be represented accurately in the implementation.

### carry vault

each supported network requires a vault or equivalent custody program deployed on that network. it holds the NFT and maintains the custody record, including the original depositor and current beneficiary.

### beneficiary

the beneficiary is the wallet currently authorised under the vault's rules. reassignment changes the authorised beneficiary without requiring the NFT to leave custody. the previous beneficiary must no longer be able to exercise rights that belong to the newly authorised beneficiary.

### secure and withdraw

- **secure:** keep the NFT in the carry vault under its current custody and beneficiary configuration.
- **withdraw:** release the NFT from the vault to the currently authorised beneficiary, subject to the contract's rules.

marketplace sales and other exit routes may be supported through future integrations. they must not bypass the same custody and authorisation rules.

---

## architecture

carry os is designed around a separation of responsibilities:

| component | responsibility |
| --- | --- |
| web application | account experience, connected wallets, NFT views, custody actions, beneficiary management |
| authentication layer | establish the carry account session and protect account-level actions |
| wallet integration | connect external wallets and request user-authorised signatures |
| backend API | coordinate requests, validate sessions, prepare operations, index and present relevant data |
| chain adapters | provide network-specific wallet, NFT, transaction, and contract interactions |
| carry vault contracts | enforce deposits, beneficiary reassignment, and withdrawals on-chain |
| database | store application metadata and operational records, without overriding on-chain custody state |

**the blockchain is the custody source of truth.** the API and database may help coordinate and display information, but they must not be able to change who owns an NFT in the vault or bypass contract permissions.

### network strategy

carry os is intended to be multichain, but networks are not all at the same implementation stage.

| network | role | status |
| --- | --- | --- |
| [NEAR](https://near.org/) | first implementation target; intended account/authentication and initial vault experience | primary hackathon network; end-to-end deployment and lifecycle verification remain outstanding |
| Ethereum | future chain-specific NFT custody support | planned |
| Solana | future chain-specific NFT custody support | planned |
| Robinhood Chain | future chain-specific NFT custody support | planned |

each network needs its own appropriate custody implementation and integration. a single contract cannot be assumed to work across different chains or token standards.

---

## current implementation status

the repository has several branches because the project has been developed in parallel. the branches are public, but they are not automatically one integrated release.

| area | current status |
| --- | --- |
| repository foundation and workspace | available on `main` |
| Next.js web application foundation | available in the repository |
| NestJS API foundation | available in the repository |
| shared types, configuration, and documentation | foundation available |
| interactive Carry OS frontend prototype | available in the [OpenCode snapshot](https://github.com/SamueladebayoPython/carry-os/tree/archive/opencode-snapshot) |
| frontend state, vault flow, beneficiary flow, and local persistence prototype | represented in the prototype branch; local UI state is not proof of an on-chain transaction |
| backend authentication and session experiments | available in the [Codex backend branch](https://github.com/SamueladebayoPython/carry-os/tree/codex/backend-near-auth-session) |
| wallet verification and linking experiments | present in experimental backend work; full frontend-to-backend integration is not verified |
| NEAR vault contract implementation and tests | available in the [Codex snapshot](https://github.com/SamueladebayoPython/carry-os/tree/archive/codex-snapshot) |
| deployed NEAR vault and complete live deposit-to-withdrawal journey | not verified as complete |
| Ethereum, Solana, and Robinhood Chain integrations | planned |
| production security review and audit | not completed |

**important:** a feature being present in a branch does not mean it is deployed, integrated with the frontend, or verified end-to-end. the prototype is useful for demonstrating the intended product experience; it must not be represented as proof of live custody unless the corresponding on-chain transaction and state can be independently verified.

### public development branches

- [main — repository foundation](https://github.com/SamueladebayoPython/carry-os/tree/main)
- [OpenCode snapshot — frontend prototype](https://github.com/SamueladebayoPython/carry-os/tree/archive/opencode-snapshot)
- [Codex snapshot — broader implementation snapshot](https://github.com/SamueladebayoPython/carry-os/tree/archive/codex-snapshot)
- [Codex backend persistence branch](https://github.com/SamueladebayoPython/carry-os/tree/codex/carry-os-backend-persistence)
- [NEAR authentication and session branch](https://github.com/SamueladebayoPython/carry-os/tree/codex/backend-near-auth-session)
- [Backend architecture](https://github.com/SamueladebayoPython/carry-os/tree/feat/backend-architecture)
- [Prisma schema proposal](https://github.com/SamueladebayoPython/carry-os/tree/feat/prisma-schema-proposal)

---

## repository structure

the foundation is organised as a pnpm and turborepo monorepo:

```text
carry-os/
├── apps/
│   ├── api/                  # NestJS backend API
│   └── web/                  # Next.js web application
├── packages/
│   ├── config/               # shared tooling configuration
│   └── shared/               # shared types and validation
├── contracts/                # NEAR contract workspace in implementation snapshots
├── docs/                     # architecture, roadmap, security, and API notes
├── .github/workflows/        # CI workflows
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

the exact files available depend on the branch being viewed. use the branch links above when reviewing work that is not yet part of `main`.

## running the repository

the root workspace pins its toolchain in the repository configuration. check the selected branch's `package.json`, `.nvmrc`, and lockfile before installing dependencies, because experimental branches may have different requirements.

for the foundation branch, the documented setup is:

```bash
corepack enable
corepack prepare pnpm@12.18.0 --activate
pnpm install
pnpm dev
```

the foundation's expected local services are:

| service | local address |
| --- | --- |
| web application | http://localhost:3000 |
| API health endpoint | http://localhost:3001/api/health |
| API documentation | http://localhost:3001/api/docs |

to run an individual application:

```bash
pnpm --filter @carry-os/web dev
pnpm --filter @carry-os/api dev
```

these commands describe the repository foundation. they do not imply that the prototype branch, backend experiments, or contracts are already connected into one running system. follow the scripts and instructions in the branch you choose to run.

---

## security principles

custody software must be designed around explicit permissions and verifiable state. carry os is intended to follow these principles:

1. **on-chain enforcement:** deposit, reassignment, and withdrawal permissions must be enforced by the vault contract.
2. **least authority:** the backend must not have unilateral power to redirect or withdraw user assets.
3. **separate identity from ownership:** a carry account session is not a substitute for wallet ownership verification.
4. **explicit authorisation:** users must understand and approve the wallet and contract actions they sign.
5. **beneficiary revocation:** after reassignment, the previous beneficiary must not retain the rights that were transferred to the new beneficiary.
6. **verifiable custody:** the application should show the relevant network, contract, token identifier, transaction, and current vault state.
7. **safe failure handling:** failed or incomplete transactions must not be presented as successful custody operations.
8. **no secret leakage:** private keys, seed phrases, API secrets, and production credentials must never be committed to the repository.

carry os is a prototype and has not completed a production security audit. do not deposit valuable assets into experimental or unaudited contracts.

## roadmap

### phase 1 — product prototype
- establish the Carry OS account and dashboard experience
- connect a wallet and display eligible NFTs
- demonstrate the secure, vault, beneficiary, and withdrawal journeys
- make the user experience understandable before adding more networks

### phase 2 — NEAR testnet lifecycle
- complete NEAR authentication and session integration
- connect a supported NEAR wallet
- verify wallet ownership before sensitive actions
- deploy and configure the vault contract on testnet
- complete and verify NFT deposit, beneficiary reassignment, and withdrawal
- display transaction links and on-chain custody state in the application

### phase 3 — utility-aware beneficiary access
- define a verifiable beneficiary proof or integration interface
- work with NFT applications and membership providers to recognise beneficiaries
- document which utility models are supported and which require application-level integration

### phase 4 — production readiness
- independent contract and application security reviews
- monitoring, recovery procedures, and operational controls
- reliable indexing, transaction reconciliation, and error handling
- clear user disclosures and support procedures

### phase 5 — additional networks
- evaluate and implement Ethereum custody
- evaluate and implement Solana custody
- evaluate and implement Robinhood Chain custody
- maintain separate, audited integrations for each network

---

## project goals

carry os aims to make digital ownership more resilient by protecting the asset separately from the wallet a person uses every day.

the long-term goal is not simply to store NFTs. it is to build a custody layer where users can change their authorised wallet without losing control of the NFT, while applications have a clear way to verify who is entitled to use it.

**secure the asset. move the authority. preserve the utility.**

## license

a license has not yet been selected for this repository. until one is added, do not assume that the code is available for unrestricted reuse.
