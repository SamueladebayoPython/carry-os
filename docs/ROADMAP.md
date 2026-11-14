# carry os roadmap

> **development status:** Carry OS is in active development. This roadmap describes the complete system we intend to build. It includes work that is implemented in development branches, work in progress, and planned capabilities. It does not mean every feature is already integrated, deployed, or available.
>
> **product goal:** secure utility NFTs in dedicated blockchain vaults while allowing the authorised beneficiary wallet to continue accessing supported NFT benefits. The NFT stays in the vault while secured. To sell or freely transfer it, the user must first withdraw it to the currently authorised wallet.
>
> **delivery strategy:** build and verify one complete NEAR testnet experience first. Add Ethereum, Solana, and Robinhood Chain only after the first lifecycle works securely.

This roadmap answers four questions for every major part of Carry OS:

- **what:** what we need to build;
- **why:** why the system needs it;
- **how:** how it works with the other parts of Carry OS;
- **proof:** what evidence will show that it works.

A feature is not complete because a screen, API route, database table, or contract function exists by itself. Completion means the frontend, backend, database, wallet, and relevant smart contract work together and the result can be independently verified.

## the complete Carry OS experience

The first complete version on NEAR should let a user:

1. Create a Carry account and sign in using NEAR Auth.
2. Connect an external wallet that holds an eligible NFT.
3. Prove control of that wallet.
4. Discover NFTs and check which ones the vault can receive.
5. Select an NFT and understand the custody action before signing.
6. Approve the transaction that deposits the NFT into Carry Vault.
7. Verify from NEAR blockchain state that the vault holds the NFT.
8. Keep using supported NFT benefits through the authorised beneficiary wallet while the NFT remains in the vault.
9. Disconnect the original wallet and connect another without losing the Carry account's verified custody record.
10. Change the beneficiary according to the vault's permission rules.
11. Confirm that the previous beneficiary no longer has rights that were reassigned.
12. Withdraw the NFT to the currently authorised beneficiary when they want to leave Carry custody.
13. Sell or transfer the NFT through their usual wallet or external marketplace after withdrawal.
14. Review the history and blockchain evidence for important actions.

Utility access is a core requirement, not an automatic result of depositing an NFT. A third-party application must support Carry's beneficiary verification method. An application that checks only the NFT's direct owner may not recognise the beneficiary while the NFT is held by the vault. We must build and demonstrate a working reference integration.

## status language

- **Implemented:** integrated into the main product, tested, and verified for the stated environment.
- **Prototype / branch work:** code or a demonstration exists in a development branch but is not yet integrated and verified as part of the complete product.
- **In progress:** integration or testing is actively underway.
- **Planned:** work remains to be done.
- **Decision needed:** a technical or product choice must be approved before implementation can be finalised.

The current repository contains a foundation on \`main\`, frontend prototypes, backend and database work, authentication and wallet-verification experiments, and NEAR vault implementation work in separate branches or snapshots. Those pieces must not be described as one completed system until they are integrated and tested together.

---

## phase 0: repository and development foundation

**Status:** workspace foundation exists on \`main\`. Full feature integration and development workflow improvements remain.

### what we are building

- A maintainable monorepo with the Next.js frontend, NestJS backend, shared types, database tooling, and contract workspaces.
- Reproducible local development, environment configuration, automated tests, builds, and CI.
- Clear ownership of the integration branch and feature branches.
- Documentation that matches the actual code and clearly labels prototypes, testnet work, and planned features.

### why it matters

Carry OS combines several systems that must work together. Developers need a reliable way to run, test, review, and integrate each part. Without that foundation, a feature can work on one developer's machine but fail when connected to the rest of the product.

### how it connects

The frontend calls the backend through shared API contracts. The backend uses the database for application records and coordinates with chain adapters. Chain adapters communicate with wallets, RPC providers, indexers, and vault contracts.

### proof that it works

- A new developer can clone the integration branch and follow the setup instructions.
- The frontend and backend start successfully in the documented environment.
- CI runs installation, linting, type checks, builds, and tests.
- Secrets are kept out of source control.
- Documentation identifies which capabilities are integrated, experimental, or planned.

## phase 1: Carry account and NEAR Auth

**Status:** authentication and session experiments exist in development branches. The complete NEAR Auth identity handoff and account lifecycle are not yet verified in the integrated product.

### what we are building

- Carry account creation and sign-in using NEAR Auth.
- A stable Carry profile linked to the verified NEAR Auth identity.
- Backend session creation, expiry, renewal, logout, and revocation.
- Account recovery and re-authentication rules.

### why it matters

Users need one account they can return to when managing connected wallets, NFTs, and custody records. NEAR Auth provides a familiar sign-in experience and a NEAR-native account path for the first network. Users should not need to understand external wallet setup before they can create a Carry account.

### how it works

1. The user chooses to create an account or log in.
2. NEAR Auth handles the configured identity provider flow.
3. Carry OS verifies the authentication result using the official integration requirements.
4. The backend finds or creates one Carry profile for that verified identity.
5. The backend creates a Carry session and returns the user to their dashboard.

NEAR Auth login and external wallet ownership are separate. Signing in does not prove control of an unrelated wallet or authorise NFT custody actions. NEAR Auth transaction signing must follow the current official SDK and network configuration. The backend must not invent its own JWT verification rules.

### proof that it works

- A first-time user creates one Carry profile.
- A returning user signs in to the same profile without creating duplicates.
- Invalid, expired, forged, and wrong-audience authentication results are rejected.
- Logout invalidates the Carry session.
- The user can access the dashboard before connecting an external NFT wallet.
- NEAR testnet signing works through the documented NEAR Auth flow, with transaction evidence for any sponsored or delegated action.

## phase 2: external wallet connection and ownership verification

**Status:** NEAR wallet-linking and signature-verification experiments exist. Full product integration remains.

### what we are building

- External wallet connection and disconnection.
- Wallet switching and linking to a Carry account.
- Chain-specific ownership challenges and signature verification.
- Secure handling of wallet-link status and replacement.

### why it matters

A wallet address is public. Anyone can enter another person's address. Carry OS must prove that the user controls the wallet before allowing it to be linked or used to authorise a deposit.

### how it works

1. The user connects an external wallet.
2. The backend creates a unique challenge tied to the Carry account, wallet address, network, purpose, and expiry.
3. The wallet signs the challenge.
4. The backend verifies the signature using the correct chain-specific method.
5. The backend consumes the nonce and records the verified wallet link.

NEAR, EVM, and Solana wallets use different signing and verification methods. A signature from one network must never be treated as proof of control over another network.

Connecting a replacement wallet must not automatically change an NFT's beneficiary or custody permissions. Wallet connection and beneficiary reassignment are separate actions.

### proof that it works

- A user can connect and verify a supported wallet.
- A user cannot link another person's address without the required signature.
- Replayed, expired, malformed, wrong-chain, and wrong-address proofs are rejected.
- A user can disconnect one wallet and connect another.
- Changing the connected wallet does not change the vault's on-chain permissions.

## phase 3: NFT discovery and deposit eligibility

**Status:** limited NEAR testnet discovery work exists. Reliable discovery and eligibility checks remain.

### what we are building

- NFT discovery for a verified wallet.
- A consistent asset view across supported networks.
- Collection, token, owner, and metadata retrieval.
- Deposit eligibility checks for supported NFT standards.
- Clear handling for unsupported, spam, or malformed assets.

### why it matters

Users need to see which NFTs they own and which ones Carry Vault can safely receive. An NFT appearing in a list is not proof of current ownership or deposit eligibility.

### how it works

The backend and chain adapter query the relevant blockchain or indexer. The application normalises the result for the frontend. Before a deposit is prepared, Carry OS checks authoritative chain state again to confirm the current owner, token identity, supported standard, and vault receiving requirements.

For NEAR, the initial scope uses supported NEP-171 NFTs. The implementation must account for NEP-145 storage requirements and the receiving contract's ability to accept the NFT.

### proof that it works

- The connected wallet's eligible NFTs appear with the correct network, collection, token ID, and metadata.
- Ownership is rechecked against chain state before deposit.
- Unsupported standards and ineligible collections are clearly rejected.
- Stale indexer data cannot cause the application to report an NFT as depositable when the chain says otherwise.

## phase 4: NEAR Carry Vault and on-chain custody

**Status:** Rust NEP-171 vault implementation and tests exist in a development snapshot. Integration, local validation, testnet deployment, and full lifecycle verification remain.

### what we are building

A NEAR smart contract that can receive eligible NFTs, record custody information, and enforce the permissions for beneficiary changes and withdrawals.

The initial contract scope includes:

- supported collection and NFT checks;
- NFT receipt and custody records;
- original depositor and current beneficiary records;
- beneficiary reassignment under the approved authority model;
- withdrawal to the currently authorised beneficiary;
- safe handling of storage, failed transfers, and invalid requests.

### why it matters

The vault is the actual custody layer. The NFT must be owned by the vault on-chain. A database entry or frontend label cannot secure an asset or enforce withdrawal permissions.

### how it works

The user selects an eligible NFT and approves the appropriate NEAR NFT transfer to Carry Vault. The contract receives the NFT through the supported NEP-171 flow, records the relevant custody details, and exposes state that the backend can read. The backend and frontend must wait for transaction completion and verify the resulting contract state before showing the NFT as secured.

The contract must not rely on the backend to decide who can withdraw or reassign a beneficiary. Those permissions must be enforced on-chain.

### proof that it works

- A testnet NFT transfers from the user's wallet to the deployed Carry Vault.
- The vault records the correct collection, token ID, depositor, and beneficiary.
- The contract reports that it holds the NFT after transaction finality.
- Invalid deposits and unauthorised actions are rejected.
- Failed or incomplete transactions are never shown as successful custody.

## phase 5: beneficiary management

**Status:** beneficiary and permission experiments exist in contract and frontend development work. The complete integrated lifecycle remains unverified.

### what we are building

- An explicit beneficiary for each secured NFT.
- A secure flow to assign or change the beneficiary wallet.
- On-chain enforcement of beneficiary permissions.
- Clear display of the depositor, current beneficiary, and permission state.

### why it matters

The main purpose of separating custody from beneficiary authority is to let users change the wallet authorised to benefit from an NFT without withdrawing and depositing the NFT again.

### how it works

The depositor initiates and authorises a beneficiary change according to the final approved contract rules. The vault updates the current beneficiary. The old beneficiary must lose the rights that were reassigned. The NFT remains in the vault throughout the change.

The intended permission model is that the original depositor authorises beneficiary reassignment and the current beneficiary can withdraw. The exact signing requirements, recovery rules, and edge cases must be formally approved in the decisions and security documents before the model is treated as final.

### proof that it works

- The authorised depositor can change the beneficiary.
- An unauthorised wallet cannot change the beneficiary.
- The new beneficiary is recorded in contract state.
- The previous beneficiary cannot exercise rights that have been reassigned.
- The NFT remains in the vault and its token owner does not change during reassignment.

## phase 6: utility preservation and beneficiary verification

**Status:** product requirement and design work. A working reference integration remains to be built and tested.

### what we are building

A verification method that allows a compatible third-party application to recognise the wallet authorised to benefit from an NFT held by Carry Vault.

This may be exposed through a documented contract interface, read method, or integration SDK. The chosen mechanism must let an application verify the NFT, vault, current beneficiary, and relevant permission state.

### why it matters

This is a defining part of Carry OS. A basic vault can hold an NFT, but holding it in a vault can cause an application that checks only direct NFT ownership to stop recognising the user. Carry OS must address the gap between the vault holding the asset and the beneficiary using its supported utility.

### how it works

1. A user deposits a membership NFT into Carry Vault.
2. The vault records the authorised beneficiary.
3. The user connects or presents that beneficiary wallet to a compatible membership application.
4. The application checks Carry's supported verification method.
5. If the wallet is the current authorised beneficiary, the application grants the relevant membership benefit while the NFT remains in the vault.
6. If the beneficiary changes, the application recognises the new beneficiary and rejects the old beneficiary's reassigned rights.

Carry OS cannot force every unrelated application to support this. Applications must integrate the verification method. A direct-owner-only application may still see Carry Vault as the owner and may not recognise the beneficiary.

### proof that it works

- Build a reference application that grants a real test benefit based on an NFT.
- Deposit the NFT into Carry Vault.
- Demonstrate that the authorised beneficiary can still access the benefit without withdrawing the NFT.
- Change the beneficiary and demonstrate that the new beneficiary receives access.
- Demonstrate that the old beneficiary loses access.
- Verify the result against current on-chain state, not a manually edited database record.

## phase 7: withdrawal and asset exit

**Status:** withdrawal implementation experiments exist. The complete authorised withdrawal flow remains to be integrated and verified.

### what we are building

A withdrawal flow that releases a secured NFT from Carry Vault to the currently authorised beneficiary.

### why it matters

Users must be able to leave Carry custody and manage their NFT normally. The vault must also prevent an old or unauthorised wallet from withdrawing an asset.

### how it works

The currently authorised beneficiary requests withdrawal and approves the required transaction. The contract checks its permission rules and transfers the NFT from the vault to the authorised wallet. Carry OS verifies the transaction and resulting ownership before updating the interface and database.

Carry OS does not need an internal marketplace for this workflow. Once the NFT has been withdrawn, the user can sell it through an external NFT marketplace or transfer it using their wallet. The NFT cannot be sold or freely transferred while it remains secured in the vault.

### proof that it works

- The current beneficiary can withdraw the NFT.
- The previous beneficiary and unrelated wallets cannot withdraw it.
- The NFT returns to the correct wallet.
- The frontend and database update only after chain state confirms the withdrawal.
- The user can then list or transfer the NFT through an external wallet or marketplace.

## phase 8: backend API, database, and transaction reliability

**Status:** substantial backend and database foundations exist in development branches. Full integration with the frontend and chain lifecycle remains.

### what we are building

- PostgreSQL persistence managed through Prisma.
- Carry account, identity reference, session, and linked-wallet records.
- NFT and custody references that identify the correct network, collection, and token.
- Transaction and operation records.
- API endpoints for account, wallet, NFT, custody, beneficiary, and transaction workflows.
- Transaction monitoring, reconciliation, idempotency, and safe error handling.

### why it matters

The backend and database connect the user experience to the blockchain. They let users return to their account, view verified custody records, follow pending operations, and inspect transaction history. They must not become an alternative source of truth for asset ownership.

### how it works

The backend validates the Carry session and wallet proof, prepares requests, coordinates chain adapters, and records operation status. The database stores application metadata and references to chain evidence. For custody and permission state, the backend reads the relevant contract or blockchain state.

Operations need explicit states such as pending, submitted, confirmed, failed, and requiring review. Repeated requests must not create duplicate deposits or withdrawals. If a service restarts, it must be able to reconcile pending operations against chain state.

### proof that it works

- Account, session, and wallet records persist across application restarts.
- The frontend can complete the supported flows through documented API endpoints.
- Each operation is linked to the correct chain, wallet, NFT, and transaction.
- Repeated requests do not create duplicate operations.
- Pending and failed transactions are displayed accurately.
- Database records can be reconciled against on-chain custody and beneficiary state.
- A connected wallet can change without losing the Carry account's verified vault records.

## phase 9: complete NEAR testnet integration and end-to-end verification

**Status:** planned. Individual components and experiments are not yet proof of one complete lifecycle.

### what we are building

The first integrated Carry OS release candidate on NEAR testnet, connecting the account, wallet, NFT discovery, backend, database, vault, beneficiary verification, and withdrawal flows.

### why it matters

Passing isolated tests does not prove the whole product works. The user must be able to complete the real journey without developers manually editing database records or bypassing normal application flows.

### proof that it works

An independent tester can:

1. Create a Carry account using NEAR Auth.
2. Connect and prove control of an external NEAR wallet.
3. Discover an eligible testnet NFT.
4. Deposit the NFT into the deployed Carry Vault.
5. Verify the vault owns the NFT on-chain.
6. Access a supported NFT benefit through the authorised beneficiary while the NFT remains in the vault.
7. Disconnect the original wallet and connect another without losing the custody record.
8. Change the beneficiary and verify that the old beneficiary loses the reassigned rights.
9. Withdraw the NFT to the current beneficiary.
10. Sell or transfer it externally after withdrawal.
11. Inspect transaction history and verify each important result against NEAR testnet.

The test must include successful, rejected, repeated, expired, interrupted, and failed operations. Publish the contract address, source revision, test instructions, and explorer evidence.

## phase 10: security and production readiness

**Status:** planned. A production security audit has not been completed.

### what we are building

- Independent smart contract and application security reviews.
- Threat modelling and permission tests.
- Monitoring, alerting, incident response, and recovery procedures.
- Secure deployment and secret management.
- Database backup, access control, retention, and recovery.
- Clear user disclosures and operational support.

### why it matters

A successful testnet demonstration does not prove that a custody service is safe for valuable assets. Production custody needs reviewed contracts, tested recovery procedures, reliable operations, and clear user understanding of the risks.

### how it connects

Security applies to every phase. The vault enforces custody permissions. The backend protects sessions and coordinates actions. The database stores only necessary application information. Monitoring detects failed or unusual operations. Recovery procedures define what happens when a provider, wallet, contract, or application component fails.

### proof that it works

- Independent reviews are completed and findings are addressed.
- Tests cover unauthorised access, replay, beneficiary changes, withdrawal, and transaction failure.
- Monitoring and incident alerts are tested.
- Backups and recovery procedures are exercised.
- Deployment configuration and secrets are reviewed.
- Mainnet deployment receives a separate explicit approval.

Do not encourage users to deposit valuable assets into experimental or unaudited contracts.

## phase 11: additional blockchain networks

**Status:** planned. NEAR is the first implementation target. Ethereum, Solana, and Robinhood Chain are not complete Carry OS integrations.

### what we are building

A shared multichain application model with separate network adapters and custody implementations.

Each network needs its own:

- wallet connection and ownership verification;
- NFT discovery and supported asset standards;
- transaction preparation and monitoring;
- vault contract or program;
- beneficiary assignment and verification;
- withdrawal flow and security tests.

### why it matters

One Carry account and a shared interface do not mean one smart contract can custody assets across different blockchains. Each network has different wallet signatures, NFT standards, transaction formats, contract environments, fees, and finality rules.

### how it works

The application uses shared product actions. A chain adapter translates those actions into the correct network-specific wallet, RPC, NFT, transaction, and vault operations. Every asset and transaction is identified by its network as well as its collection or contract and token ID.

**Ethereum**

- Start with an explicitly selected Ethereum testnet.
- Connect EVM wallets and verify ownership using a chain-bound signature challenge.
- Begin with ERC-721 custody. Add ERC-1155 only after quantity and batch-transfer behavior are designed and tested.
- Build and deploy a separate Solidity vault.
- Verify deposits, beneficiary changes, and withdrawals against Ethereum state.

**Solana**

- Start on devnet.
- Connect Solana wallets and verify signatures using Solana-specific methods.
- Finalise the initial supported NFT standards, evaluating Metaplex Core and Token Metadata as separate models.
- Build a native Solana program with explicit account and authority rules.
- Verify deposits, beneficiary changes, and withdrawals against Solana state.

**Robinhood Chain**

- Start on the official Robinhood Chain testnet.
- Confirm current chain IDs, RPC endpoints, explorer, and gas configuration from official documentation.
- Connect EVM-compatible wallets and deploy a separate EVM-compatible vault.
- Verify every operation against Robinhood Chain state, not Ethereum state.

### proof that each network works

A network can only be labelled supported after a tester completes its full custody lifecycle: wallet ownership proof, NFT discovery, deposit, on-chain custody verification, beneficiary reassignment, beneficiary utility verification through a compatible integration, and withdrawal.

A wallet connector or NFT display alone is not multichain custody support. Do not bridge an NFT as a shortcut for native custody.

---

## cross-cutting requirements

These requirements apply to every phase:

- **Security:** validate sessions and wallet proofs. Enforce asset permissions in the relevant smart contract.
- **Correctness:** use blockchain state as the source of truth for custody and beneficiary permissions.
- **Transaction safety:** handle pending, failed, repeated, and interrupted operations without false success.
- **Transparency:** show the network, NFT identity, current beneficiary, operation status, and transaction evidence.
- **Privacy:** store only necessary user data. Never store seed phrases or private keys.
- **Reliability:** handle provider outages, rate limits, timeouts, and application restarts.
- **Testing:** cover normal use, invalid input, replay, unauthorised actions, and failure cases.
- **Accessibility:** provide clear status messages, readable interfaces, and keyboard support.
- **Honest status:** distinguish mock data, frontend prototypes, branch experiments, testnet deployments, and production features.
- **Documentation:** keep setup instructions, API contracts, architecture, security decisions, and roadmap status aligned with the implementation.

## definition of done

A Carry OS capability is complete only when:

1. The user can perform it through the application.
2. The backend validates the request and the user's authority.
3. The wallet approves the correct signature or transaction.
4. The smart contract enforces the required custody or permission rule.
5. The result is read and verified from the relevant blockchain.
6. The database and interface reflect the verified result.
7. Automated tests cover success, rejection, replay, duplicate requests, and failure.
8. The behavior and verification steps are documented.

For utility preservation, completion also requires a working third-party reference integration that recognises the current beneficiary while the NFT remains in the vault.

## current limitations

Until the relevant evidence is published, do not claim that Carry OS has:

- a fully integrated production authentication and account recovery system;
- complete wallet verification across all networks;
- universal NFT discovery or support for every NFT standard;
- a deployed and audited production vault;
- automatic compatibility with every NFT utility application;
- complete end-to-end NEAR custody and beneficiary utility verification;
- live Ethereum, Solana, or Robinhood Chain custody;
- production-grade monitoring, recovery, or mainnet support.
