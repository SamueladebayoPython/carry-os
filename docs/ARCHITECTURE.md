# carry os architecture

> **Development status:** Carry OS is still in active development. This document describes the intended architecture. Some components exist as prototypes or separate branch experiments, while other components remain planned. It does not claim that the complete system is integrated, deployed, or production-ready.
>
> **Purpose:** this document explains what each part of carry os is responsible for, how information and authority move through the system, and what must be built for the product to work.

**Product:** carry os is a multichain NFT custody and utility-preservation platform. It separates the wallet that holds an NFT from the wallet currently authorised to benefit from it.

**Delivery strategy:** build and verify the first complete lifecycle on NEAR testnet. Add other networks only through their own contracts, wallet verification, discovery, and transaction integrations.

## 1. The problem carry os solves

An NFT can represent more than a collectible. It may provide access to a community, membership, event, game item, credential, domain, discount, or another digital benefit.

If that NFT sits in a wallet used for trading, minting, and connecting to many applications, a compromise of that wallet can put the NFT and its associated benefits at risk. Moving the NFT to another personal wallet can help separate it from daily activity, but it creates another problem: the new wallet may not be the one an application recognises, and changing wallets repeatedly can be inconvenient.

carry os is designed around two separate roles:

- **custody:** the vault contract holds the NFT on its native blockchain.
- **beneficiary:** a wallet address recorded by the vault is currently authorised to exercise the rights defined by the product.

The NFT stays in the vault when the beneficiary changes. The system changes who is authorised, not who owns the NFT in the vault. When the user chooses to leave custody, the contract releases the NFT according to its withdrawal rules.

This is not automatic compatibility with every NFT application. An application that checks only the NFT's direct owner will see the vault as owner. To preserve that application's utility, it must integrate a way to verify the beneficiary recorded by carry os. See the beneficiary entitlement section below.

## 2. Core terms and authority

| Term | Meaning in carry os |
| --- | --- |
| Carry account | The user's identity and application account used to access Carry OS |
| Connected wallet | An external blockchain wallet connected to the account |
| Original depositor | The wallet/account that authorised the NFT deposit and is recorded by the vault |
| Vault | The chain-specific smart contract or program that receives and holds the NFT |
| Beneficiary | The wallet address currently authorised by the vault's rules |
| Custody record | On-chain record identifying the NFT, depositor, beneficiary, and relevant status |
| Deposit | The NFT transfer from its current owner to the vault |
| Reassignment | Changing the beneficiary record without transferring the NFT out of the vault |
| Withdrawal | Releasing the NFT from the vault to the currently authorised destination |

The intended authority model is:

1. The original depositor is authorised to request a beneficiary change, subject to the contract's rules.
2. The current beneficiary is authorised to withdraw, subject to the contract's rules.
3. A previous beneficiary loses the rights that were reassigned. It must not be able to withdraw merely because it was once the beneficiary.
4. The backend cannot appoint a beneficiary, transfer an NFT, or override the contract.
5. A Carry account login alone does not prove ownership of an external wallet.

The final contract must encode these rules. The exact recovery, dispute, upgrade, and emergency powers remain explicit design decisions.

## 3. System at a glance

```text
User
 |
 v
Next.js web app
 |-- Carry account sign-in / session
 |-- connect wallet / sign ownership challenge
 |-- display NFTs and custody records
 |-- request user approval for blockchain actions
 |
 | HTTPS / REST
 v
NestJS API
 |-- verify Carry session
 |-- verify wallet ownership proofs
 |-- prepare and validate operations
 |-- read chain and indexer data
 |-- monitor transactions and reconcile state
 |
 +--------------------+-----------------------+
 |                    |                       |
 v                    v                       v
PostgreSQL         Chain adapters         NEAR authentication
app metadata       RPC / indexer           identity proof
operation state    transaction reads      and session bootstrap
audit references
                       |
                       v
                 NEAR vault contract
                 |-- receive NFT
                 |-- record depositor
                 |-- record beneficiary
                 |-- reassign beneficiary
                 |-- enforce withdrawal
                 +-- emit/read custody evidence
```

The web application is the user interface. The API coordinates work and verifies information. The database stores application records. Wallets sign messages and transactions. The vault contract enforces custody permissions. These responsibilities must not be mixed.

## 4. Carry account and NEAR authentication

### What it does

The Carry account is the user's identity inside the application. It allows the user to return to their dashboard, view their linked wallets and custody records, and manage account-level settings.

The intended sign-in experience uses the selected NEAR authentication flow with passkey-friendly access. The exact provider and protocol must be confirmed before the implementation is treated as final.

### Why NEAR authentication is used

NEAR authentication provides the identity/authentication entry point for Carry OS. It establishes that the user has successfully authenticated through the chosen NEAR account flow. The backend verifies the authentication result and creates or resumes the Carry session.

This is useful for account access and continuity. It does **not** automatically prove that the user controls an Ethereum, Solana, or other external wallet. Those wallets need their own ownership proof.

### What a NEAR signature proves

A cryptographic signature proves that the holder of the relevant signing key approved a specific message. Carry OS must use signatures for clearly separated purposes:

- **authentication proof:** proves control of the identity used to sign in, according to the chosen NEAR authentication protocol.
- **wallet ownership proof:** proves control of a particular connected wallet by signing a server-generated challenge for that wallet and network.
- **transaction authorisation:** approves a specific blockchain transaction, such as depositing an NFT or withdrawing it.

These proofs are not interchangeable. A login signature must not be reused as permission to withdraw an NFT. A NEAR signature cannot prove control of an Ethereum or Solana private key.

### What must be implemented

1. The user starts the NEAR sign-in flow.
2. The authentication provider returns a verifiable result.
3. The backend validates the result, including issuer/provider, audience, expiry, nonce or replay controls, and account identity as required by the selected protocol.
4. The backend creates a Carry session with a defined expiry and revocation behavior.
5. Protected API routes require a valid session.
6. Sign-out revokes or invalidates the session.
7. Sensitive actions can require fresh authentication or a separate wallet signature.

The browser must not be allowed to invent an authenticated account ID or declare a session valid by itself.

## 5. Connected wallets and ownership proof

### What it does

A connected wallet identifies the blockchain address from which the user wants to discover or manage NFTs. It also provides the signing interface needed to approve chain transactions.

Connecting a wallet is not the same as proving ownership. A malicious browser could submit someone else's public address. Carry OS must verify control before linking the address or allowing sensitive actions.

### Ownership challenge

The backend creates a unique, short-lived challenge containing at least:

- the Carry OS application/domain;
- the wallet address being verified;
- the network or chain identifier;
- the purpose of the proof, such as linking a wallet;
- a unique nonce;
- an issue time and expiry.

The wallet signs the exact challenge using its chain's supported signing method. The backend verifies the signature against the expected address and network, then consumes the nonce so the proof cannot be replayed.

Each network requires its own correct signature verification. A NEAR proof is not accepted as an EVM or Solana proof.

### Wallet replacement

When the user changes their everyday wallet, the new wallet must prove control before it is linked. The old wallet connection can then be removed from the application. This must not alter the vault's custody record by itself.

If the user wants the new wallet to become the beneficiary, Carry OS starts a separate beneficiary-reassignment operation. That operation must be authorised according to the vault contract, not merely because a new wallet was connected.

## 6. NFT discovery and eligibility

### What it does

NFT discovery finds assets associated with the connected wallet and presents them in a form the user can inspect before depositing anything.

The discovery service reads blockchain data directly or through an indexer. Indexers make large collections easier to query, but their data can be delayed or incomplete. Before a deposit is prepared, Carry OS must verify the current owner and token details against an authoritative chain read.

### Data shown to the user

For each NFT, the application should display:

- network and chain identifier;
- collection name and contract/account;
- token ID;
- media and metadata, when available;
- current owner;
- collection verification or eligibility status;
- whether the token standard is supported by the vault.

### Eligibility checks

The system must reject or clearly mark assets that cannot safely be deposited. Checks include supported token standard, current ownership, collection policy, token existence, and whether the vault can receive that asset.

Metadata is untrusted input. Images and external metadata must be handled defensively. Spam NFTs, malformed metadata, missing media, pagination, and rate limits must not break the user's account.

## 7. Vault contract and NFT custody

### What the vault does

The vault is the on-chain component that actually receives and holds the NFT. It is the core security boundary of Carry OS.

When a user deposits an NFT, the NFT's ownership changes from the user's wallet to the vault contract. The contract creates a custody record that associates the deposited token with its original depositor and current beneficiary.

The vault must prevent arbitrary wallets, the backend, or a former beneficiary from transferring the NFT out of custody. Only the permissions encoded in the contract can authorise custody-changing operations.

### Deposit flow

1. The user selects an eligible NFT.
2. Carry OS checks the token's current owner and supported standard.
3. The frontend asks the wallet to approve the required transfer or deposit call.
4. The wallet signs and submits the transaction.
5. The NFT contract transfers the NFT to the Carry vault using the relevant standard's transfer mechanism.
6. The vault validates the incoming token and creates the custody record.
7. The API waits for the required chain confirmation and reads the vault state.
8. The UI marks the NFT as secured only after the chain evidence confirms the vault owns the token and the expected custody record exists.

A submitted transaction is not yet proof of a successful deposit. It can fail, be rejected, or remain pending.

### Custody record

The contract record must be sufficient to identify:

- the NFT collection/contract;
- the token ID;
- the original depositor;
- the current beneficiary;
- the custody status;
- the relevant deposit and later operation references.

The exact storage model (one record per token, a shared vault, or another pattern) must be selected during contract design. Whatever model is chosen, the contract must prevent the same token from being recorded as deposited more than once.

### Secure state

"Secure" means the NFT remains owned by the Carry vault and cannot be withdrawn or reassigned by an arbitrary wallet. The contract checks the caller and the current record before accepting each privileged operation.

The user interface may display the asset as secured only while the chain state confirms that custody remains active. A database flag or local UI state is not enough.

## 8. Beneficiary reassignment and withdrawal

### Beneficiary reassignment

Reassignment changes the wallet authorised to benefit from the NFT without moving the NFT out of the vault.

1. The user connects and proves control of the proposed new beneficiary wallet.
2. Carry OS identifies the custody record and the authority allowed to change its beneficiary.
3. The authorised original depositor approves the reassignment transaction.
4. The vault checks that the caller is permitted to make the change.
5. The contract replaces the current beneficiary with the new beneficiary.
6. The API reads the updated on-chain record.
7. The UI displays the new beneficiary only after the change is confirmed.

The previous beneficiary must immediately lose the rights associated with the old record, subject to the final contract's explicitly documented rules. It must not retain withdrawal access because it was previously authorised.

### Withdrawal

Withdrawal ends custody for that NFT. The current beneficiary requests the release, and the contract checks that the caller and destination satisfy the approved withdrawal rules.

The vault transfers the NFT to the authorised destination and updates or closes the custody record. Carry OS verifies the resulting owner and transaction before showing withdrawal as complete.

The contract must reject withdrawal attempts by the original depositor if that wallet is no longer the authorised beneficiary, by a former beneficiary, by an unlinked wallet, or by the backend acting without the required user authority.

The precise relationship between beneficiary and destination address must be fixed in the contract design. The destination must not be silently substituted by an API parameter.

## 9. Beneficiary entitlement and utility

### Why this is a separate system

After deposit, the vault is the NFT's direct owner. A third-party website that checks only the NFT's direct owner will see the vault, not the beneficiary. That application may therefore deny access even though the user is the beneficiary recorded by Carry OS.

Utility preservation requires a way for applications to verify the beneficiary without taking custody away from the vault.

### Intended integration

Carry OS should provide a verifiable read interface or proof that allows an integrated application to check:

- which network and NFT collection are involved;
- which token ID is being checked;
- whether the NFT is currently in Carry custody;
- which wallet is the current beneficiary;
- whether the custody record is active and the proof is current.

The proof must be tied to the exact NFT and current beneficiary. A stale proof must not remain valid after reassignment or withdrawal.

The first reference integration should demonstrate one concrete utility, such as access to a gated membership page. It should show that the current beneficiary receives access, and that the previous beneficiary loses access after reassignment.

This feature cannot guarantee compatibility with every third-party product. Each product must either query the vault or integrate the Carry proof mechanism.

## 10. Backend API and transaction orchestration

### What the API does

The NestJS API coordinates the application. It authenticates requests, validates input, prepares operations, reads blockchain and indexer data, tracks transactions, and provides the frontend with consistent status.

It is not a custodian and must not have unilateral authority to move assets.

### Operation lifecycle

Every custody operation should have a durable lifecycle, for example:

- **created:** the user has requested an operation;
- **awaiting_signature:** the wallet must approve the transaction;
- **submitted:** a transaction hash exists, but final success is not verified;
- **confirmed:** the required chain evidence has been checked;
- **failed:** the chain rejected or reverted the operation;
- **expired/cancelled:** the operation can no longer be completed.

The API must distinguish transaction submission from final confirmation. It must handle retries, dropped transactions, timeouts, duplicate requests, and chain reorganisations or finality rules where applicable.

Before reporting success, it reads the chain and verifies the expected result: vault ownership after deposit, beneficiary record after reassignment, or new owner after withdrawal.

## 11. Database and audit history

The PostgreSQL database stores application data needed to make Carry OS usable. It may store Carry account metadata, linked wallet records, session metadata, NFT metadata cache, operation state, transaction hashes, and audit events.

The database is not proof of ownership or custody. If a database row says an NFT is secured but the vault does not own it, the chain state wins and the application must flag the mismatch.

The database should make it possible to reconstruct what the user requested, what transaction was submitted, what the chain returned, and what the application displayed. It must not store seed phrases or private keys.

## 12. Chain adapters and multichain support

### Why Carry OS needs chain adapters

Carry OS should present one understandable product experience, but it cannot pretend that every blockchain handles NFTs in the same way. NEAR, Ethereum, Solana, and Robinhood Chain use different account models, wallet signatures, NFT standards, transaction execution, contract storage, and confirmation rules.

A **chain adapter** is the network-specific part of Carry OS that translates common product actions into the correct blockchain operations. The frontend can ask to discover an NFT, prepare a deposit, read a custody record, reassign a beneficiary, or withdraw. The selected adapter performs that action using the correct wallet, RPC, NFT interface, and vault for the active network.

The adapter must not weaken or replace the contract's permission checks. It prepares and verifies actions; the vault remains responsible for enforcing custody authority.

### Shared Carry account, separate network wallets

The intended model is one Carry OS account with multiple connected wallets.

- NEAR Auth is the planned sign-in and account onboarding path.
- A user may connect a NEAR wallet, an Ethereum wallet, a Solana wallet, or an EVM wallet configured for Robinhood Chain.
- Each connected wallet is stored with its network identity and address.
- Each wallet must prove control using a challenge and signature method appropriate to its network.
- Signing in with NEAR Auth does not prove ownership of any external wallet.
- A wallet connection does not automatically make that wallet the beneficiary of an NFT already in custody.

The Carry account identifies the person using the application. The connected wallet proves control of a particular blockchain address. The vault decides which address has custody-related authority.

### Shared application interface

The common application layer should expose consistent operations:

| Common operation | What the chain adapter must do |
| --- | --- |
| Connect wallet | Open a compatible wallet and identify the active network and address |
| Prove wallet ownership | Create or verify a chain-specific signed challenge |
| Discover NFTs | Query supported NFT standards and return normalized asset records |
| Check eligibility | Verify current ownership, supported standard, collection policy, and vault compatibility |
| Prepare deposit | Build the correct network-specific approval and transfer instructions |
| Read custody | Query the relevant vault and return the current on-chain custody record |
| Reassign beneficiary | Prepare the authorised contract or program instruction |
| Withdraw | Prepare the release operation for the currently authorised beneficiary |
| Track transaction | Read network-specific transaction status and verify resulting chain state |

The shared interface normalizes product behavior, not blockchain semantics. Each adapter must preserve chain-specific data and error details rather than hiding important differences.

### Network registry and asset identity

Carry OS needs a network registry that defines the networks and environments available to the application.

Each entry should include:

- stable internal network identifier;
- chain ID or network identifier used by the blockchain;
- environment, such as local, testnet, devnet, or mainnet;
- native gas token;
- wallet connection configuration;
- RPC and indexer configuration;
- explorer base URL;
- supported NFT standards;
- vault contract or program address;
- confirmation and finality policy;
- feature status and release state.

Every NFT must have a network-scoped identity. The normalized asset reference should contain at least the network, collection or contract address, and token identifier. For standards that represent balances or multiple units, it must also include the amount or token-account context required by that standard.

This prevents an asset from being confused with another NFT that happens to use the same token ID on a different chain. Every transaction request must bind the account, wallet, asset, network, vault, and intended action together.

### Network implementation matrix

| Network | Wallet and asset model | Vault implementation | Current development status |
| --- | --- | --- | --- |
| NEAR | NEAR accounts and NEP-171 NFTs, with NEAR-specific ownership proofs and transaction signing | Rust-based NEAR smart contract | First implementation target. Contract, authentication, and backend experiments exist in public branches. Integrated testnet lifecycle remains to be verified |
| Ethereum | EVM wallets; ERC-721 first, with ERC-1155 added only if the custody model supports quantities and batch transfers | Solidity EVM contract | Planned. No complete Carry OS Ethereum integration is claimed |
| Solana | Solana wallets; Metaplex Core and selected Token Metadata NFTs require explicit support decisions | Solana program using its native account and authority model, likely Rust and Anchor | Planned. Asset scope and custody design remain to be finalised |
| Robinhood Chain | EVM wallets and selected ERC-721 or ERC-1155 assets | Separate Solidity deployment on Robinhood Chain | Planned. EVM compatibility allows tooling reuse, but network deployment and verification remain separate |

### NEAR adapter: first reference implementation

The NEAR adapter is the first complete target because NEAR is the selected initial network.

It must:

1. connect a supported NEAR wallet for users who hold NFTs outside the Carry account's NEAR authentication flow;
2. verify wallet control independently from NEAR Auth login;
3. discover NEP-171 NFTs and retrieve collection, token ID, owner, and metadata;
4. check the receiving contract's storage requirements and NFT transfer compatibility;
5. prepare the required NFT transfer or transfer-call interaction;
6. call the Carry vault and create a custody record;
7. read the custody record after transaction confirmation;
8. prepare beneficiary reassignment and withdrawal instructions;
9. monitor transaction execution and confirm the resulting owner and custody state.

Relevant standards include [NEP-171](https://github.com/near/NEPs/blob/master/neps/nep-0171.md) for NFTs, [NEP-145](https://github.com/near/NEPs/blob/master/neps/nep-0145.md) for storage management, and [NEP-177](https://github.com/near/NEPs/blob/master/neps/nep-0177.md) for NFT metadata.

### Ethereum adapter

Ethereum uses the EVM account and smart-contract model. The first implementation should target ERC-721 because it represents individually owned NFTs with a well-defined transfer interface. ERC-1155 can be added after the vault supports token quantities, batch operations, and the additional authorization rules it requires.

The adapter must:

- connect EVM wallets and verify the active chain ID;
- verify wallet ownership with a domain-bound, nonce-protected message such as a Sign-In with Ethereum challenge;
- discover ERC-721 assets and later ERC-1155 assets through an indexer, while checking current ownership on-chain before deposit;
- prepare the correct approval and safe-transfer operation;
- call a Solidity vault that records the collection contract, token ID, depositor, beneficiary, and custody status;
- enforce reassignment and withdrawal permissions in the contract;
- wait for the selected confirmation policy and handle chain reorganisations;
- verify the vault's token balance and custody record before showing success.

Relevant references: [ERC-721](https://eips.ethereum.org/EIPS/eip-721), [ERC-1155](https://eips.ethereum.org/EIPS/eip-1155), [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193), and [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361).

### Solana adapter

Solana uses public keys, accounts, instructions, and program-derived addresses. It does not use EVM contracts or ERC token interfaces. Carry OS therefore needs a Solana program and a separate custody account model.

The initial asset scope should explicitly evaluate:

- Metaplex Core assets;
- existing NFTs created with the Metaplex Token Metadata program;
- compressed NFTs as a separate future decision, not an assumed part of the first release.

The adapter must connect a compatible Solana wallet, verify a signed challenge against the wallet public key, discover assets through a suitable Solana data provider, and verify ownership and asset details from chain state before preparing a deposit.

The vault program must define how each supported asset standard is transferred into program-controlled custody, how the custody record stores the depositor and beneficiary, and how reassignment and withdrawal instructions enforce authority. Program-derived addresses, account ownership, token accounts, rent, compute limits, transaction size, and confirmation behavior must be handled explicitly.

Relevant references: [Metaplex Core](https://www.metaplex.com/docs/smart-contracts/core), [Metaplex Token Metadata](https://www.metaplex.com/docs/smart-contracts/token-metadata), and [Solana token metadata documentation](https://solana.com/docs/tokens/metaplex).

### Robinhood Chain adapter

Robinhood Chain is an Ethereum-compatible Layer 2 built on Arbitrum. Its EVM compatibility means Solidity contracts and standard Ethereum development tools can be used. It does not mean an Ethereum deployment automatically works on Robinhood Chain.

The adapter must use a separate network configuration, wallet chain selection, RPC endpoint, explorer, vault deployment, and monitoring setup. Chain IDs and endpoints must be checked against official documentation again during deployment.

Carry OS can evaluate reusing the reviewed EVM adapter and Solidity vault after verifying compatibility with the chain's RPC, transaction, fee, and finality behavior. The contract must still be deployed and tested independently on Robinhood Chain.

References: [Robinhood Chain developer documentation](https://docs.robinhood.com/chain/), [network connection details](https://docs.robinhood.com/chain/connecting/), and [smart contract deployment](https://docs.robinhood.com/chain/deploy-smart-contracts/).

### Provider, indexing, and transaction reliability

Each adapter depends on RPC endpoints, wallet providers, and often an indexer. These services help the application read chain data, but they are not the authority for custody.

- Use indexers to discover and paginate NFT collections.
- Verify current ownership and important custody results against authoritative chain reads.
- Track provider freshness and surface stale or unavailable data.
- Apply timeouts, bounded retries, rate limits, and provider health checks.
- Do not silently switch a user's active network during a transaction.
- Record transaction identifiers with their network so identical-looking hashes or token IDs cannot be mixed across networks.
- Use each chain's appropriate confirmation or finality policy.
- Reconcile pending operations after API restarts or provider outages.
- Never display a deposit, reassignment, or withdrawal as complete until the resulting chain state has been checked.

### What makes a network supported

A network is not supported just because its wallet connects or its NFTs appear in the dashboard. It becomes a supported Carry OS network only after wallet ownership proof, discovery, eligibility checks, vault custody, beneficiary reassignment, withdrawal, transaction monitoring, security tests, and reproducible deployment evidence are complete.

NEAR is the first target. Ethereum, Solana, and Robinhood Chain remain planned integrations. No network inherits another network's implementation or audit status.


## 13. Security boundaries

- The browser can request actions but cannot decide whether they are authorised.
- The API verifies sessions, wallet proofs, and operation rules, but cannot override vault permissions.
- Wallet signatures prove approval of a specific message or transaction, not general trustworthiness.
- RPC providers and indexers can be stale or unavailable; critical custody results must be checked against authoritative chain state.
- The contract is responsible for enforcing deposit, beneficiary, and withdrawal permissions.
- The database records application state but cannot create or override custody.

Sensitive actions must fail closed if identity, ownership, transaction, or contract state cannot be verified.

## 14. Current implementation boundaries

The public repository contains a foundation branch and separate prototype and experimental implementation branches. Code existing in a branch is not automatically integrated into a working release.

The public snapshots contain frontend prototype work, backend authentication and wallet-verification experiments, and NEAR vault contract code and tests. Those components still require review, integration, deployment, and end-to-end verification. The existence of contract code does not prove that a contract is deployed. A passing contract test does not prove that the web app can complete the lifecycle.

Use the root README and roadmap for the current status. Update this section when branches are integrated or testnet evidence becomes available.

## 15. Open architecture decisions

The following decisions must be recorded before dependent implementation is treated as final:

- exact NEAR authentication provider and signed-result verification;
- whether the Carry account is anchored to a NEAR account, a provider identity, or another stable identity model;
- session storage, lifetime, revocation, and recovery;
- wallet challenge formats and signature standards per network;
- supported NFT standards and collection eligibility policy;
- vault deployment model and custody-record storage layout;
- exact authority for beneficiary reassignment and withdrawal destination;
- contract upgradeability, admin powers, emergency pause, and recovery;
- key management and transaction-signing boundaries;
- utility entitlement proof format and reference integration;
- RPC/indexer providers, finality, and reconciliation policy;
- database schema, privacy, retention, and audit-event policy.

Record decisions in [DECISIONS.md](DECISIONS.md) before code depends on them.
