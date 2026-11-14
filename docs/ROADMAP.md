# carry os roadmap

> **Development status:** Carry OS is still in active development. This roadmap includes planned capabilities and future integrations. It is not a statement that those features are already implemented, deployed, or available to users.
>
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

## Phase 0 : Repository foundation and one source of truth

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

## Phase 1 : Create a Carry account and sign in with NEAR Auth

**Status: authentication/session experiments exist in public branches; the NEAR Auth integration and complete account lifecycle are not yet verified in the integrated product.**

### What we are building

Carry OS will use **NEAR Auth as its primary sign-up and sign-in method**. A new user should be able to create a Carry account and access the product using a familiar identity method, without first installing a browser wallet, writing down a seed phrase, or manually creating a NEAR account.

NEAR Auth connects familiar authentication methods to a real NEAR account. Its current sign-in options include Google, Apple, email/password, and passkeys. The identity flow is powered by Auth0, while NEAR's MPC infrastructure derives and uses the account's signing key without one party holding the complete private key.

This is why NEAR Auth fits Carry OS: it reduces the first-use barrier while giving the product a NEAR-native account and signing path for its first supported network. It is not simply a Google login placed in front of a separate wallet setup. The authentication identity is used by NEAR Auth to resolve the user's NEAR account.

Official integration reference: [NEAR Auth](https://auth.near.org/).

### What the user experience should look like

The first screen should clearly offer **Create account** and **Log in**.

**First-time user: create account**

1. The user opens Carry OS and selects **Create account**.
2. Carry OS opens the NEAR Auth sign-up experience.
3. The user chooses a supported method, such as Google, Apple, email/password, or passkey.
4. The identity provider authenticates the user and returns a signed JWT containing a stable subject identifier.
5. NEAR Auth uses the verified identity with its configured guard and MPC infrastructure to derive the user's NEAR account identity and signing capability.
6. The NEAR Auth flow provisions or resolves the corresponding NEAR account. The user should not have to create a separate wallet manually as part of normal onboarding.
7. Carry OS receives the authentication result, verifies it according to the official SDK and backend integration requirements, and creates the user's Carry profile.
8. The user enters an empty Carry dashboard. They can then connect an existing NFT wallet as a separate step.

**Returning user: log in**

1. The user selects **Log in**.
2. Carry OS starts the same NEAR Auth provider flow.
3. The user authenticates with the same identity method and identity they used previously.
4. NEAR Auth resolves that identity to the same NEAR account through its deterministic identity-to-account derivation.
5. Carry OS verifies the authentication result and finds the existing Carry profile associated with that verified identity.
6. The backend creates or resumes the user's Carry session and returns the user to their dashboard, including their linked wallets and custody records.

The sign-up and login screens may use the same provider component, but Carry OS must distinguish a first-time identity from an existing account. It must not create duplicate Carry profiles every time a returning user authenticates.

### How NEAR Auth works behind the sign-in screen

The intended integration follows this sequence:

1. **Authenticate:** the user signs in through the configured Auth0-backed method. Auth0 issues a JWT with a subject claim identifying that authenticated user.
2. **Verify identity:** the NEAR Auth contract routes the JWT to the configured guard, which validates the issuer and token according to its rules.
3. **Derive the NEAR account signing path:** after successful verification, NEAR Auth derives a deterministic identity path from the guard and subject. The same verified identity resolves to the same NEAR account.
4. **Use MPC signing:** NEAR's MPC network collaboratively derives and uses the signing key. No single MPC participant reconstructs or holds the complete private key.
5. **Authorise NEAR actions:** when the user approves a supported NEAR action, the SDK obtains the required fresh authentication material and creates the appropriate signed action. For gas-sponsored delegate actions, the configured relayer submits the NEP-366 meta-transaction and pays network gas according to the integration configuration.
6. **Verify and record in Carry OS:** the Carry backend validates the authentication result it receives, maps the verified identity to the correct Carry profile, and manages its own application session.

The exact SDK calls, JWT audience, guard configuration, relayer settings, network selection, and backend verification must follow the current NEAR Auth developer documentation. Do not invent a custom token-verification scheme or assume that a normal login JWT can be reused indefinitely to sign transactions.

### What Carry OS stores for the account

Carry OS should maintain its own application profile linked to the verified NEAR Auth identity. The profile is used for Carry-specific data such as:

- stable Carry account identifier;
- verified NEAR Auth identity reference and NEAR account ID;
- account creation and last-login timestamps;
- linked external wallet records;
- NFT custody records and operation history;
- account preferences and security settings.

Carry OS should store the minimum identity reference needed to map a verified NEAR Auth login to the same Carry profile. It must not store the user's password, seed phrase, private key, or raw bearer tokens.

The NEAR account identity and Carry profile are related but distinct. NEAR Auth provides the authentication and NEAR account layer; Carry OS maintains the product profile, linked-wallet relationships, and application records.

### Why we use NEAR Auth instead of making users start with a wallet

- **Lower onboarding friction:** users can start with a familiar login method instead of learning seed phrases and wallet extensions before seeing the product.
- **A NEAR account is part of the flow:** the user gets a NEAR-native identity and signing path, which is useful because NEAR is Carry OS's first custody network.
- **Passkey support:** users can choose passkey authentication where supported, reducing dependence on passwords.
- **Consistent NEAR identity:** the same supported identity resolves to the same NEAR account across NEAR Auth-integrated applications using the same identity configuration.
- **A path to sponsored transactions:** NEAR Auth supports NEP-366 delegate actions through a configured relayer, allowing Carry OS to design a gas-sponsored NEAR experience where the relayer configuration and product economics support it.
- **Separation of responsibilities:** NEAR Auth handles the NEAR sign-in/account path, while Carry OS handles its own user profile, linked wallets, custody records, and product permissions.

### Important distinction: NEAR Auth login is not external wallet ownership

NEAR Auth signs the user into Carry OS and provides a NEAR account signing path. It does not automatically prove that the user controls an existing Ethereum, Solana, or other external wallet.

A user may sign in with NEAR Auth and then connect a separate wallet that holds NFTs. That external wallet must complete its own chain-specific ownership proof. If the user wants to deposit an NFT from that wallet, the wallet must also approve the deposit transaction.

Likewise, a successful Carry login does not by itself authorise beneficiary reassignment or NFT withdrawal. Those operations must satisfy the vault's on-chain permission rules and require the appropriate transaction approval.

### Work

**Frontend and onboarding**

- Integrate the official NEAR Auth React SDK/provider into the Next.js application, following the supported setup for the selected environment.
- Configure the Auth0 domain, client ID, audience, and NEAR network using environment variables; never expose private credentials.
- Build distinct **Create account** and **Log in** entry points that launch the NEAR Auth flow.
- Present the supported sign-in methods supplied by NEAR Auth rather than building a parallel password system.
- Handle successful login, cancellation, provider errors, expired authentication, and network failures.
- After first authentication, create the Carry profile and take the user to an empty dashboard.
- On later authentication, load the existing Carry profile and its data instead of creating another account.
- Keep connecting an external NFT wallet as a separate, clearly labelled action after account entry.
- Provide sign-out and a clear way to return to the login screen.

**Backend identity and session**

- Verify the NEAR Auth authentication result using the documented issuer, signing keys, audience, subject, expiry, and other required claims.
- Reject forged, expired, malformed, wrong-audience, or otherwise invalid authentication results.
- Map the verified identity to one stable Carry profile using a unique identity key; prevent duplicate accounts and account-linking collisions.
- Create a Carry OS session after successful verification, with explicit expiry, renewal, logout, and revocation behavior.
- Protect account-specific API routes by checking the Carry session on the server.
- Do not trust a NEAR account ID, email address, or user ID supplied by the browser unless it matches verified claims.
- Keep raw JWTs, cookies, and session credentials out of application logs and persistent user-profile fields.
- Define what happens if the user changes their Auth0 login method, loses access to the identity provider, or requests account recovery.

**NEAR Auth and transaction configuration**

- Start integration on NEAR testnet using the testnet SDK configuration and credentials.
- Confirm the required Auth0 application settings, JWT audience, guard, NEAR Auth contracts, RPC endpoint, and relayer configuration.
- Use the NEAR Auth SDK's supported signing and delegate-action flow for NEAR transactions.
- Decide which Carry OS actions should use sponsored NEP-366 transactions and which require another payment model.
- Confirm mainnet application approval and production credentials before planning a mainnet release; testnet access does not imply mainnet approval.
- Document provider dependencies, relayer availability, rate limits, costs, and failure behavior.

### Why it matters

The account is the user's entry point into Carry OS. Without a stable sign-up and login flow, users cannot reliably return to their dashboard or manage their linked wallets and custody records.

NEAR Auth also makes the onboarding decision part of the product architecture: users get a familiar way to enter, while Carry OS starts with a NEAR-native account and transaction path. Keeping this separate from external wallet verification and vault permissions prevents a login session from becoming an accidental custody authority.

### Completion evidence

- A first-time user can select **Create account**, complete NEAR Auth, and receive one Carry profile linked to the verified NEAR identity.
- A returning user can select **Log in** and reach the same Carry profile and NEAR account.
- Repeating login does not create duplicate Carry profiles.
- Invalid, expired, forged, and wrong-audience authentication results are rejected by the backend.
- A user can sign out, and the Carry session is invalidated according to the session policy.
- The user reaches the dashboard before being asked to connect an external NFT wallet.
- NEAR testnet signing works through the documented NEAR Auth flow, and any relayer/delegate-action behavior is verified with transaction evidence.
- The integration documents testnet configuration and the separate approval/credential requirements for mainnet.

## Phase 2 : Connect wallets and prove ownership

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

## Phase 3 : Discover NFTs and decide what can be secured

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

## Phase 4 : Build the NEAR vault: the custody engine

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

## Phase 5 : Change beneficiary without moving the NFT

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

## Phase 6 : Withdraw the NFT safely

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

## Phase 7 : Backend API: connect every part of the system

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

## Phase 8 : Beneficiary proof and real utility preservation

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

## Phase 9 : Database, transaction history, and reliability

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

## Phase 10 : Security, testing, and NEAR testnet release

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

## Phase 11 : Production readiness and mainnet decision

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

## Phase 12: Build and verify additional network integrations

**Status: planned. Carry OS is still in development. NEAR is the first implementation target. Ethereum, Solana, and Robinhood Chain are not currently complete Carry OS integrations.**

### Why network support needs separate engineering

Carry OS has one product model, but it cannot use one blockchain implementation everywhere. Each network has different account formats, wallet signing methods, NFT standards, transaction execution, contract storage, fees, confirmation behavior, and indexing infrastructure.

The goal is to reuse the user experience and common application rules without pretending the underlying chains work the same way. A chain adapter translates common Carry OS actions into the correct network-specific operations.

### Phase 12A: Establish the shared multichain foundation

**What it does**

The network registry defines the networks Carry OS knows about, the environments available on each network, supported NFT standards, wallet connectors, RPC and indexer configuration, vault addresses, and transaction explorers.

**Work**

- Define a stable internal network identifier for every supported chain and environment.
- Store configuration separately for local development, testnet, devnet, and mainnet.
- Define a common asset reference containing network ID, collection or contract address, and token ID.
- Define shared operation types for discovery, deposit preparation, custody lookup, beneficiary reassignment, and withdrawal.
- Define a chain adapter interface for wallet connection, ownership proof, NFT reads, transaction preparation, transaction status, and custody reads.
- Keep network-specific signature verification and contract calls inside their own adapters.
- Add provider health checks, timeouts, bounded retries, rate limits, and failover rules.
- Track each operation with its network ID so a transaction cannot accidentally be sent to another chain.
- Show the active network before a user signs a transaction.
- Reject unsupported networks and NFT standards rather than guessing how to handle them.

**Why it matters**

Without a network registry and explicit asset identity, the application could display an NFT from one chain while preparing a transaction for another. The shared foundation prevents that mistake and lets Carry OS add networks without mixing their security rules.

**Completion evidence**

- The same Carry account can store wallet links for multiple networks.
- Each wallet link is associated with the correct network and address format.
- Every NFT and custody operation is namespaced by its network.
- The frontend and API reject mismatched network, wallet, asset, and vault combinations.
- Tests cover unknown networks, wrong chain IDs, unsupported standards, and provider failures.

### Phase 12B: Complete NEAR as the first reference integration

**Purpose**

NEAR is the first network because it is the initial implementation target and the network selected for Carry OS account onboarding and its first vault lifecycle.

**What the NEAR adapter must do**

- Connect a supported NEAR wallet for users who hold NFTs in an existing NEAR account.
- Keep NEAR Auth account login separate from external wallet connection and ownership proof.
- Discover supported NEP-171 NFTs and read their collection, token ID, owner, and metadata.
- Check NEP-145 storage requirements and the receiving vault's ability to accept the NFT.
- Prepare the correct NEAR NFT transfer or transfer-call flow for the vault.
- Call the NEAR vault contract and record the original depositor and current beneficiary.
- Read custody records directly from the contract after transaction confirmation.
- Reassign the beneficiary under the contract's approved authority.
- Allow withdrawal only under the current beneficiary rules.
- Handle transaction outcomes, gas, storage deposits, execution errors, and finality.
- Publish the testnet contract address, source revision, explorer links, and reproducible test steps.

**Standards and references**

- [NEP-171: Non-Fungible Token standard](https://github.com/near/NEPs/blob/master/neps/nep-0171.md)
- [NEP-145: Storage Management](https://github.com/near/NEPs/blob/master/neps/nep-0145.md)
- [NEAR Protocol standards](https://near.github.io/NEPs/)

**Completion evidence**

A tester can sign in, connect an existing NEAR wallet, prove wallet control, discover an eligible NFT, deposit it, verify custody, reassign the beneficiary, prove the old beneficiary has lost the reassigned rights, and withdraw using the currently authorised beneficiary. Each step has test and transaction evidence.

### Phase 12C: Add Ethereum support

**Purpose**

Ethereum support lets users protect eligible NFTs held in EVM wallets without moving them to another network or relying on a wrapped representation.

**What the Ethereum adapter must do**

- Select an Ethereum testnet before mainnet.
- Connect EVM wallets through a supported provider interface.
- Identify the active EVM chain using its chain ID and reject unexpected networks.
- Verify wallet control using a standard message-signing challenge bound to domain, address, chain, nonce, issue time, and expiry.
- Start with ERC-721 custody. Add ERC-1155 only after the vault supports balances, token IDs, quantities, and batch transfers correctly.
- Discover NFTs through an indexer or data provider, then verify current ownership and token details against Ethereum state before deposit.
- Build a Solidity vault that records the token contract, token ID, original depositor, beneficiary, and custody status.
- Handle ERC-721 approvals and safe transfers. For ERC-1155, handle operator approval and amount-aware transfers.
- Implement beneficiary reassignment and withdrawal using the approved authority model.
- Monitor EVM receipts, confirmation depth, failed transactions, and chain reorganisations.
- Publish the testnet contract, verification data, source revision, and end-to-end evidence.

**Standards and references**

- [ERC-721](https://eips.ethereum.org/EIPS/eip-721)
- [ERC-1155](https://eips.ethereum.org/EIPS/eip-1155)
- [EIP-1193: Ethereum Provider JavaScript API](https://eips.ethereum.org/EIPS/eip-1193)
- [EIP-4361: Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361)

**Why it matters**

Ethereum assets cannot be deposited into the NEAR vault. They need an EVM contract that can receive the relevant token standard and enforce custody permissions on Ethereum itself.

**Completion evidence**

A user can complete the full lifecycle with an eligible Ethereum testnet NFT. The contract rejects unauthorised beneficiary changes and withdrawals, and the application verifies each result from Ethereum state.

### Phase 12D: Add Solana support

**Purpose**

Solana support extends Carry OS to NFTs held in Solana wallets. It requires a native Solana program because Solana uses accounts and instructions rather than EVM contracts.

**What the Solana adapter must do**

- Select the target cluster, beginning with devnet.
- Connect wallets using a supported Solana wallet integration.
- Verify wallet control through a Solana-specific signed challenge and verify the signature against the expected public key.
- Define the initial supported NFT scope. Evaluate Metaplex Core assets and existing Token Metadata NFTs as separate asset models.
- Treat compressed NFTs as out of scope for the first release unless a safe custody and proof design is approved.
- Discover assets using a suitable Solana data provider, then verify ownership and asset details from authoritative account state before deposit.
- Build a Solana program, likely using Rust and Anchor, with explicit program-derived custody accounts and authority rules.
- Define how the program receives each supported NFT model and records the original depositor and current beneficiary.
- Implement beneficiary reassignment and withdrawal through program instructions that enforce the approved authority model.
- Handle account creation, rent or storage costs, transaction size, compute limits, confirmation status, and failed instructions.
- Publish the program ID, source revision, devnet explorer links, and reproducible lifecycle tests.

**Standards and references**

- [Metaplex Core](https://www.metaplex.com/docs/smart-contracts/core)
- [Metaplex Token Metadata](https://www.metaplex.com/docs/smart-contracts/token-metadata)
- [Solana token metadata documentation](https://solana.com/docs/tokens/metaplex)

**Why it matters**

A Solana NFT is not an ERC-721 token and cannot be handled by an EVM vault. Solana custody must respect its account ownership, token program, metadata, and program-derived address model.

**Completion evidence**

A tester can connect a Solana wallet, discover an NFT from an explicitly supported standard, deposit it into the Solana program, verify the custody account, reassign the beneficiary, and withdraw it under the program's permission rules.

### Phase 12E: Add Robinhood Chain support

**Purpose**

Robinhood Chain gives Carry OS an additional EVM-compatible network target. It is designed as an Ethereum-compatible Layer 2, so Solidity contracts and standard EVM tooling can be used. This reduces the need to invent an entirely different contract language, but it does not remove the need for a separate deployment and verification.

**What the Robinhood Chain adapter must do**

- Start on Robinhood Chain testnet before any mainnet deployment.
- Configure the testnet chain ID, RPC endpoint, explorer, and ETH gas token from official developer documentation.
- Recheck the official chain IDs and endpoints during deployment rather than relying on copied configuration.
- Connect EVM-compatible wallets and confirm that the active chain is Robinhood Chain.
- Reuse the reviewed EVM wallet-proof approach and Solidity vault code only after checking chain-specific assumptions and dependencies.
- Deploy a separate vault instance with its own address, configuration, access controls, and operational monitoring.
- Support the same approved NFT standards selected for the Ethereum adapter.
- Verify NFT ownership and custody state against Robinhood Chain, not Ethereum.
- Monitor transactions, receipts, confirmations, and provider health on Robinhood Chain.
- Publish testnet contract addresses, source revision, explorer links, and end-to-end evidence.

**Official references**

- [Robinhood Chain developer documentation](https://docs.robinhood.com/chain/)
- [Connecting to Robinhood Chain](https://docs.robinhood.com/chain/connecting/)
- [Deploying smart contracts](https://docs.robinhood.com/chain/deploy-smart-contracts/)

**Why it matters**

EVM compatibility makes tooling and contract reuse possible, but Ethereum and Robinhood Chain remain separate networks. A contract deployed on Ethereum does not automatically exist on Robinhood Chain. Wallet configuration, chain IDs, RPC access, gas, deployment, indexing, monitoring, and security verification must be handled independently.

**Completion evidence**

A tester can use a Robinhood Chain testnet NFT to complete deposit, custody verification, beneficiary reassignment, and withdrawal. The UI and API must show Robinhood Chain as the active network and use its own contract and transaction evidence.

### Rules for adding any future network

A new network must not be enabled just because a wallet can connect or an NFT can be displayed.

Before a network is marked supported, Carry OS must have:

1. A documented network and environment configuration.
2. A wallet connector and chain-specific ownership verifier.
3. NFT discovery for explicitly supported standards.
4. An authoritative ownership and eligibility check before deposit.
5. A deployed custody contract or program on that network.
6. Deposit, custody record, beneficiary reassignment, and withdrawal.
7. Backend monitoring and recovery for pending, failed, and reorganised transactions.
8. Security tests for forged signatures, replay, unauthorised actions, and incorrect network selection.
9. A reproducible testnet demonstration with explorer evidence.
10. A separate security and release decision before mainnet support.

Do not bridge an NFT to another chain as a shortcut for native custody. Cross-chain bridging introduces a different trust model and is not part of the initial multichain custody promise.


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
