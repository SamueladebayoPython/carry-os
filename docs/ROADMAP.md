# carry os roadmap

> **Purpose:** this roadmap explains what must be built, what each part does, why the system needs it, and how we will know it works. It covers the complete product, including features that have not yet been implemented.
>
> **Delivery strategy:** build one complete, verifiable NEAR testnet experience first. Add Ethereum, Solana, and Robinhood Chain as separate integrations after the first lifecycle is secure and reliable.

A roadmap item is not evidence of implementation. Status must be checked against integrated code, automated tests, deployment records, and real transaction evidence.

## Status language

- **Implemented:** integrated into the main product, tested, documented, and verified for the stated environment.
- **Prototype / branch work:** code or a demonstration exists in a branch but is not yet integrated and verified as part of one complete product.
- **In progress:** integration or testing is actively underway.
- **Planned:** work still required.
- **Decision needed:** a product or technical choice must be approved before implementation can be considered final.

A page that looks finished is not proof that the backend works. An API method is not proof that the contract enforces the permission. A contract test is not proof that the frontend can complete the user journey. Completion requires these parts to work together.

---

## The complete product we are building

The finished NEAR version of Carry OS should let a person:

1. Create a Carry account and sign in.
2. Connect the wallet that currently holds an NFT.
3. Prove that they control that wallet.
4. See the NFTs they can actually deposit.
5. Select an NFT and understand exactly what will happen.
6. Approve a transaction that transfers the NFT into a Carry vault.
7. Verify that the vault, not just the user interface, now holds the NFT.
8. Disconnect the original wallet and connect a replacement wallet.
9. Prove control of the replacement wallet.
10. Change the NFT's beneficiary without moving the NFT out of the vault.
11. Confirm that the old beneficiary no longer has the reassigned rights.
12. Withdraw the NFT to the currently authorised beneficiary when they choose to leave Carry custody.
13. Inspect the history and blockchain evidence for every important action.

The larger utility-preservation goal is to let a third-party application verify the current beneficiary of a vaulted NFT. This requires an integration or proof mechanism. Simply holding an NFT in a vault cannot force unrelated applications to recognise its beneficiary.

---

## Phase 0 — Repository foundation and one source of truth

**Status: foundation exists on main; integration and documentation review remain.**

### What we are building

A repository that developers can clone, understand, run, test, and extend without guessing which branch or document describes the real product.

### Work

- Keep the Next.js frontend, NestJS API, shared TypeScript contracts, and workspace tooling organised in the monorepo.
- Define which branch is the integration source and require feature work to be reviewed before it becomes part of the product.
- Keep environment variables documented with safe example values.
- Make installation, local development, tests, and builds reproducible from a clean clone.
- Run CI on every proposed integration so broken types, builds, or tests are caught before merging.
- Add dependency and secret scanning so vulnerable packages and accidentally committed credentials are detected early.
- Add a licence only after the project owner chooses the reuse terms.
- Keep README, architecture, API, security, network support, and roadmap descriptions aligned with actual code.

### Why it matters

Carry OS combines a web application, backend, database, wallets, and smart contracts. If the repository is not reproducible, developers cannot reliably integrate those pieces or verify a reported bug.

### Completion evidence

- A new developer can clone the integration branch and follow the documented setup without relying on private machine state.
- CI passes on the integration branch.
- Each major feature has a clear implementation location and tests.
- Documentation identifies what is integrated, experimental, and planned.

## Phase 1 — Carry account and secure sign-in

**Status: authentication/session experiments exist in public branches; the final integrated sign-in flow is not yet verified.**

### What we are building

A Carry account is the user's identity inside Carry OS. It gives the user a stable place to return to, view linked wallets, and manage their custody records even when the wallet they use every day changes.

The selected NEAR authentication approach is intended to provide the sign-in experience, with passkey-friendly access where supported. The exact provider and protocol must be confirmed before it is treated as final.

### What the NEAR authentication proof does

A NEAR authentication signature or provider-issued proof establishes that the user controls or has authenticated through the NEAR identity accepted by the chosen protocol. The backend verifies that proof and creates a Carry session.

The session tells the API which Carry account is making a request. It does not prove control of every external wallet and does not authorise an NFT withdrawal by itself.

### Work

- Implement the sign-in and account creation flow.
- Verify the authentication result on the backend, including its issuer, intended audience, account identity, expiry, and replay protections required by the selected protocol.
- Map the verified identity to one Carry account so repeated sign-ins return to the same account.
- Create a protected session with a defined expiry, renewal, and revocation policy.
- Require a valid session for account-specific API operations.
- Implement sign-out and invalidate the session.
- Protect browser sessions against CSRF, session fixation, unsafe cookie settings, and overly broad CORS.
- Define recovery if a user loses access to the NEAR authentication method.
- Require fresh authentication or an additional proof for high-risk account changes when appropriate.

### Why it matters

Without a secure Carry identity, the system cannot reliably know which account is requesting wallet linking or viewing custody records. Authentication must also remain separate from blockchain ownership: signing in must not give the account automatic control over an NFT.

### Completion evidence

- A valid user can create or access their Carry account.
- The backend, not the browser, verifies the authentication proof.
- Expired, forged, wrong-audience, and replayed proofs are rejected.
- Sessions expire and can be revoked.
- Tests cover sign-in, sign-out, expiry, renewal, and account recovery behavior.

## Phase 2 — Connect wallets and prove ownership

**Status: wallet verification and linking experiments exist in public branches; full application integration remains.**

### What we are building

Users must be able to connect the wallet that currently holds their NFTs. Carry OS must prove that the user controls the wallet before it links that address to their Carry account or allows it to authorise sensitive actions.

A wallet address is public information. Anyone can type another person's address into a form. Connection alone is therefore not ownership proof.

### What the wallet signature does

The backend creates a unique challenge. The wallet signs that challenge with its private key. The backend verifies the signature against the wallet address and chain.

The challenge must identify the Carry OS domain, wallet address, network, purpose, unique nonce, and expiry. This stops a proof created for one wallet, network, or action from being reused for another.

A NEAR signature proves control of the relevant NEAR account. An EVM wallet requires an EVM-compatible signature verification method. Solana requires its own wallet-signature verification. One chain's signature must never be accepted as proof of another chain's private key.

### Work

- Connect the supported NEAR wallet through the selected wallet interface.
- Let the user connect, disconnect, and switch wallets explicitly.
- Create a server-generated, single-use ownership challenge.
- Ask the wallet to sign the exact challenge.
- Verify the signature on the backend using the correct chain-specific method.
- Consume the nonce after verification and reject reused or expired challenges.
- Bind the proof to the account, wallet, chain, and requested purpose.
- Store the verified wallet link and its status.
- Define what happens when a wallet is disconnected, compromised, or replaced.
- Require a new proof when the user connects a replacement wallet.

### Why it matters

Wallet proof prevents a user from linking an address they do not control. It also creates a reliable foundation for proving who authorised a deposit and which wallet is proposed as the new beneficiary.

### Completion evidence

- A user can connect and verify a wallet.
- A user cannot link someone else's address without its signature.
- Replayed, expired, malformed, wrong-chain, and wrong-address proofs fail.
- Replacing a connected wallet does not silently change vault permissions.

## Phase 3 — Discover NFTs and decide what can be secured

**Status: limited discovery experiments exist; reliable discovery and eligibility checks remain.**

### What we are building

An NFT discovery service that finds assets owned by a connected wallet and presents enough information for the user to make an informed deposit decision.

### What discovery does

The service queries the relevant chain or an indexer for NFTs associated with the wallet. It normalises different token standards into a common Carry OS asset view so the frontend can display assets consistently.

Indexers can make discovery faster, but they may be delayed or wrong. Before a deposit, Carry OS must re-check the token's current owner and token details against the blockchain.

### Work

- Select the NEAR RPC and indexer sources.
- Query NFTs owned by the verified wallet.
- Support the chosen NFT standard and identify unsupported token types.
- Normalise collection/account, token ID, metadata, media, and owner fields.
- Add pagination so large wallets do not return an incomplete or unusable list.
- Handle missing images, malformed metadata, slow providers, rate limits, and temporary RPC/indexer failures.
- Filter or label spam NFTs and collections that are not eligible for custody.
- Check that the vault can receive the token before asking the user to deposit.
- Re-check ownership immediately before preparing the deposit transaction.
- Cache descriptive metadata for performance, but never use the cache as proof of current ownership.

### Why it matters

Users must know which asset they are securing and whether Carry OS can actually hold it. A stale indexer result must not cause a deposit attempt for an NFT the user no longer owns.

### Completion evidence

- The list belongs to the verified connected wallet and selected network.
- Each asset shows its collection, token ID, network, and eligibility.
- Unsupported or suspicious assets are clearly identified.
- Deposit preparation checks current chain ownership.

## Phase 4 — Build the NEAR vault: the custody engine

**Status: NEAR vault contract code and tests exist in a public snapshot; review, integration, deployment, and full lifecycle verification remain.**

### What we are building

The NEAR vault is the smart contract that receives and holds an NFT after deposit. It is the component that enforces custody rules. The frontend and backend can request operations, but neither should be able to bypass the contract's permissions.

### How the vault secures an NFT

Before deposit, the NFT is owned by the user's wallet. During deposit, the user approves a transaction that transfers the NFT to the Carry vault. Once the transfer is accepted and the contract records it, the vault becomes the on-chain owner.

The contract keeps a custody record identifying the NFT, original depositor, current beneficiary, and custody status. While the NFT is in custody, the contract rejects transfers or withdrawals that do not satisfy its authorisation rules.

This is the actual custody boundary. A database entry saying "secured" or a frontend animation is not security. The chain must show that the vault owns the NFT and that the custody record is valid.

### Work

- Review the existing NEAR contract implementation against the product's authority model.
- Confirm the NFT standard and supported collection policy.
- Finalise how vault records are keyed and how duplicate deposits are prevented.
- Implement the NFT receiver/deposit path and validate the incoming collection and token.
- Record the original depositor and initial beneficiary.
- Ensure only the contract's approved methods can change custody state.
- Ensure arbitrary accounts cannot transfer or withdraw a secured NFT.
- Define contract storage deposits, storage accounting, and cleanup behavior.
- Define upgrade permissions, emergency pause, and recovery before deployment.
- Add tests for successful deposit, wrong collection, duplicate deposit, invalid token, unauthorised caller, and failed transfer.
- Deploy the reviewed contract to NEAR testnet.
- Publish the contract address, source revision, deployment transaction, and explorer links.

### Why it matters

Without the vault contract, Carry OS is only an interface for managing information. The vault is what makes the custody promise enforceable on-chain.

### Completion evidence

- A testnet NFT moves from the user's wallet to the vault.
- A chain explorer and contract read confirm the vault owns the NFT.
- The custody record identifies the correct token, depositor, and beneficiary.
- Unauthorised accounts cannot transfer or withdraw it.
- Contract tests pass and deployment details are public.

## Phase 5 — Change beneficiary without moving the NFT

**Status: beneficiary logic exists in contract experiments; final authority rules and end-to-end verification remain.**

### What we are building

A beneficiary is the wallet currently authorised to benefit from a vaulted NFT. When the user changes their everyday wallet, Carry OS should let them appoint the replacement wallet without withdrawing and depositing the NFT again.

### How reassignment works

The proposed new wallet first proves control by signing a fresh ownership challenge. The authorised original depositor then approves a beneficiary-change transaction. The vault checks that the caller has permission and updates the beneficiary stored in the custody record.

The NFT itself remains owned by the vault. Only the beneficiary record changes. After the change is confirmed, the previous beneficiary must no longer be able to use the rights assigned to the new beneficiary, including withdrawal rights where the contract defines them.

### Work

- Require the proposed beneficiary wallet to prove control.
- Confirm the custody record is active and the NFT is still held by the vault.
- Enforce the approved reassignment authority in the contract.
- Update the beneficiary atomically on-chain.
- Emit an event or provide a read method that exposes the updated record.
- Reconcile the API and database with the new chain state.
- Invalidate cached beneficiary data and any previously issued entitlement proofs.
- Display the old and new beneficiary and the transaction evidence.
- Test attempts by the old beneficiary, an unrelated wallet, and the backend to change the record without permission.
- Define recovery and dispute handling for a lost or compromised depositor wallet before mainnet.

### Why it matters

This is the feature that separates Carry OS from simply transferring NFTs between wallets. The user changes who is authorised while the NFT remains in protected custody.

### Completion evidence

- The NFT remains in the vault before and after reassignment.
- The on-chain beneficiary changes to the intended verified wallet.
- The previous beneficiary is rejected when attempting an action it no longer controls.
- The new beneficiary is recognised by the vault.
- Reassignment events and transaction details can be independently verified.

## Phase 6 — Withdraw the NFT safely

**Status: withdrawal logic exists in contract experiments; full integrated testnet verification remains.**

### What we are building

Withdrawal is the controlled exit from Carry custody. It releases the NFT from the vault to the currently authorised beneficiary when that person chooses to take the asset out.

### How withdrawal works

The current beneficiary requests withdrawal. The vault reads its custody record and checks that the caller is the currently authorised beneficiary and that the requested destination is permitted by the contract. If the checks pass, the contract transfers the NFT out and updates or closes the custody record.

The backend then verifies the transaction and checks the NFT's new owner. Only after that verification should Carry OS display the NFT as withdrawn.

### Work

- Define whether the beneficiary must withdraw only to its own verified wallet or may nominate another destination with explicit proof.
- Require the appropriate wallet signature and transaction approval.
- Check the current beneficiary and active custody status on-chain.
- Reject the original depositor if it is no longer the authorised beneficiary.
- Reject former beneficiaries and unrelated wallets.
- Transfer the NFT using the supported NFT standard.
- Update custody status and emit a withdrawal event.
- Verify the new owner and transaction result.
- Handle failed transfers, duplicate requests, retries, and pending transactions.
- Add tests for authorised and unauthorised withdrawal attempts.

### Why it matters

A custody system must provide a clear and secure way to leave. Withdrawal rules must be enforced by the vault, not by a button being hidden in the frontend.

### Completion evidence

- The current beneficiary can withdraw under the approved rules.
- The NFT is transferred to the approved destination.
- Former beneficiaries and unrelated wallets cannot withdraw.
- The API and UI show completion only after chain verification.

## Phase 7 — Backend API: connect every part of the system

**Status: NestJS foundation and backend experiments exist; full product integration remains.**

### What we are building

The API is the coordinator between the Carry account, connected wallets, discovery providers, database, and vault contract. It gives the frontend a consistent way to request work and check results.

It does not hold the NFT and must not have unilateral power to change its beneficiary or withdraw it.

### Work

- Define and document endpoints for account sessions, wallet linking, NFT discovery, deposit preparation, operation status, beneficiary changes, and withdrawals.
- Validate every request with shared types and server-side rules.
- Require a valid Carry session for account-level operations.
- Require a verified wallet proof for actions that depend on wallet control.
- Prepare transactions with the correct network, contract, token, and recipient.
- Return enough information for the wallet to display what the user is signing.
- Track each operation through created, awaiting signature, submitted, confirmed, failed, or expired states.
- Use idempotency keys so repeated requests do not create duplicate operations.
- Monitor transaction hashes and read the resulting contract state.
- Reconcile database records with chain state after timeouts or service restarts.
- Return clear errors without exposing secrets or internal implementation data.

### Why it matters

Without orchestration, the frontend, wallet, contract, and database can show different versions of what happened. The API coordinates them and ensures that the application reports the result the chain actually produced.

### Completion evidence

- Frontend can complete deposit, reassignment, and withdrawal through the API and wallet.
- The API never treats a submitted hash as final success.
- Duplicate requests do not duplicate custody operations.
- Pending, failed, and confirmed states are accurate and recoverable.

## Phase 8 — Beneficiary proof and real utility preservation

**Status: required product capability; implementation planned.**

### What we are building

A way for a third-party application to verify who is currently entitled to use a vaulted NFT.

### Why it is necessary

When the vault owns an NFT, a normal ownership check sees the vault address. A membership site or game that checks only direct NFT ownership may reject the beneficiary. Carry OS cannot fix that by changing its own interface. The application granting the utility must be able to recognise the beneficiary.

### Work

- Define a public read interface or cryptographic proof for a custody record.
- Include network, collection, token ID, current beneficiary, custody status, and freshness/expiry information in the proof or response.
- Ensure the proof can be independently verified and cannot be forged by the frontend.
- Ensure beneficiary reassignment invalidates old proofs.
- Ensure withdrawal or custody termination invalidates the entitlement.
- Provide an SDK or simple integration guide for third-party applications.
- Build one reference membership or token-gated application.
- Demonstrate that the current beneficiary receives access.
- Reassign the beneficiary and demonstrate that the previous wallet loses access while the new one gains it.
- Document unsupported utility models and integration requirements.

### Why it matters

This is what turns NFT custody into utility preservation. Without it, Carry OS can protect an NFT in a vault, but cannot promise that every external service will continue recognising the person who benefits from it.

### Completion evidence

- A reference application verifies the current beneficiary.
- The proof refers to the exact NFT and current on-chain custody record.
- Old beneficiary proofs stop working after reassignment.
- The integration is reproducible and its limitations are documented.

## Phase 9 — Database, transaction history, and reliability

**Status: database schema and complete operational behavior remain to be integrated and verified.**

### What we are building

A database and operational layer that helps Carry OS remember users, linked wallets, pending operations, transaction references, and activity history.

### What the database does

The database stores information that makes the application convenient and auditable. It can remember a user's linked wallets, cache NFT metadata, track which transaction belongs to an operation, and record when the user requested a deposit or beneficiary change.

It does not decide who owns the NFT. If the database says "secured" but the vault no longer holds the NFT, the chain state takes priority and Carry OS must show a mismatch.

### Work

- Finalise PostgreSQL and Prisma schema and migrations.
- Store Carry account identity references and verified wallet links.
- Store session metadata or revocation state according to the chosen session design.
- Store NFT metadata cache with source and freshness information.
- Store operation IDs, status, idempotency keys, transaction hashes, and timestamps.
- Store beneficiary-change and withdrawal history.
- Store audit events describing who requested an action and what chain evidence resulted.
- Add indexes and pagination for account history and NFT records.
- Define encryption, database roles, data minimisation, retention, deletion, and backup policies.
- Add reconciliation jobs to compare important application records with on-chain state.
- Never store seed phrases or private keys.

### Why it matters

Users need to see what they secured and what happened over time. Operators need to investigate failures. Persistence provides that history, while blockchain reads remain authoritative for custody.

### Completion evidence

- Data survives restarts and migrations.
- A user's activity history can be reconstructed.
- Reconciliation detects stale or inconsistent records.
- Database failure cannot silently change or fabricate custody authority.

## Phase 10 — Security, testing, and NEAR testnet release

**Status: planned.**

### What we are building

A tested NEAR testnet product where the complete lifecycle works and where users can verify the important actions independently.

### Work

- Threat-model account takeover, wallet compromise, malicious NFTs, replay, beneficiary theft, contract bugs, and withdrawal abuse.
- Test authentication and wallet proof against forged, expired, and replayed messages.
- Test vault permissions with authorised, former, and unrelated accounts.
- Add contract invariant tests for custody ownership and beneficiary rules.
- Test duplicate deposits, duplicate requests, dropped transactions, and provider outages.
- Test API and UI behavior for pending, failed, cancelled, and confirmed operations.
- Add dependency, secret, static-analysis, and dynamic security checks.
- Review contract upgrade and emergency controls.
- Obtain an independent smart-contract security review before handling meaningful value.
- Fix findings and record any accepted limitations.
- Deploy to NEAR testnet and publish contract addresses and explorer links.
- Publish a clean setup guide and reproducible end-to-end demonstration.

### Completion evidence

- A new tester can follow the documented process from account creation to deposit, beneficiary reassignment, and withdrawal.
- Each custody transition has a verifiable testnet transaction.
- The old beneficiary cannot exercise reassigned rights.
- Failed operations do not appear as successful.
- Security findings and known limitations are disclosed.

## Phase 11 — Production readiness and mainnet decision

**Status: not started; requires explicit approval.**

### What we are building

The operational safeguards required before users trust Carry OS with assets that have real value.

### Work

- Complete independent contract audits and remediate findings.
- Approve key management, signer separation, and administrative permissions.
- Establish emergency pause, recovery, incident authority, and user communication.
- Add monitoring and alerts for unusual custody operations.
- Test backups, disaster recovery, and service restoration.
- Establish support and incident-response procedures.
- Review privacy, legal, and user-disclosure requirements.
- Conduct a limited release and operational readiness review.
- Make a separate mainnet approval for each network.

### Completion evidence

- Security and operational reviews are signed off.
- Recovery and incident procedures have been tested.
- Monitoring can detect and alert on custody failures.
- Mainnet deployment is explicitly approved; testnet success alone is not enough.

## Phase 12 — Add other networks

**Status: planned. NEAR implementation does not mean other chains are supported.**

Each network needs its own complete implementation. The same product experience can be reused, but wallet signatures, NFT standards, vault programs, transaction finality, and monitoring are chain-specific.

### Ethereum

- Choose the first EVM network and testnet.
- Support agreed NFT standards such as ERC-721 and, if required, ERC-1155.
- Integrate EVM wallet connection and signature verification.
- Build and test the Solidity vault.
- Implement deposit, custody record, beneficiary reassignment, and withdrawal.
- Add EVM transaction monitoring, confirmations, and reorganisation handling.
- Publish testnet deployment and end-to-end evidence.

### Solana

- Select the supported Solana cluster and NFT standards.
- Integrate Solana wallet connection and message-signature verification.
- Build the Rust/Anchor program and define its account/PDA custody model.
- Implement deposit, beneficiary record, reassignment, and withdrawal.
- Add Solana-specific discovery and transaction confirmation handling.
- Test and publish program deployment and lifecycle evidence.

### Robinhood Chain

- Confirm the network's architecture, EVM compatibility, token standards, RPC/explorer, and testnet availability before implementation.
- Select the appropriate wallet and contract tooling based on verified technical details.
- Build and test its own custody integration.
- Do not assume Ethereum support automatically means Robinhood Chain support.

### Completion evidence for every network

- Wallet connection and ownership proof work on that network.
- NFT discovery and eligibility checks work for the supported standards.
- The chain-specific vault/program enforces the same approved custody rules.
- Deposit, reassignment, and withdrawal pass integration and adversarial tests.
- Transaction monitoring and explorer evidence are available.
- The network has its own security review and documented status.

---

## Cross-cutting requirements

Every phase must follow these requirements:

- **Security:** permissions are checked by the backend and enforced on-chain where assets are involved.
- **Testing:** normal, invalid, repeated, failure, and adversarial cases are covered.
- **Transparency:** users can see the network, token, beneficiary, operation status, and transaction evidence.
- **Reliability:** timeouts, retries, provider failures, and service restarts do not create false success or duplicate operations.
- **Privacy:** collect only necessary data, protect sessions, and never store wallet secrets.
- **Accessibility:** the product works with keyboard navigation, readable contrast, and clear status messages.
- **Documentation:** setup and product behavior match the implementation.
- **Honest status:** mock demonstrations, branch prototypes, testnet contracts, and production features are labelled distinctly.

## Definition of done

A Carry OS capability is complete only when:

1. The user can perform the action through the interface.
2. The backend validates the request and the user's authority.
3. The wallet requests the correct signature or transaction approval.
4. The contract enforces the required custody permission.
5. The result is independently read and verified from chain state.
6. The database and UI reflect the verified result.
7. Tests cover success, rejection, replay, duplicate requests, and failure.
8. Documentation explains how to run and verify the capability.

## Current limitations that must remain visible

Until evidence is published, do not claim that Carry OS has:

- production-ready authentication or account recovery;
- complete wallet verification across all networks;
- universal NFT discovery;
- a deployed and audited production vault;
- automatic compatibility with every NFT utility application;
- live Ethereum, Solana, or Robinhood Chain custody;
- production-grade monitoring, recovery, or mainnet support.
