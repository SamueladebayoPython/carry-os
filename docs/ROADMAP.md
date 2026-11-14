# carry os roadmap

> **Purpose:** this roadmap describes the work required to turn carry os from a
> prototype into a secure, usable custody product. It includes planned work
> beyond the current implementation. A roadmap item is not a claim that the
> feature already exists.

The delivery order is **NEAR first**, then additional networks. The project is
testnet-first. Mainnet support is a separate release decision that requires
security review and operational readiness.

## How to read this roadmap

### Status definitions

- **Implemented:** present in the integration branch, tested, documented, and
  verified for the stated environment.
- **Prototype / branch work:** code or a demonstration exists in a separate
  branch, but it is not yet integrated and verified as part of one working
  product.
- **In progress:** actively being integrated or tested.
- **Planned:** required work that has not been completed.
- **Decision needed:** an architectural or product choice that must be agreed
  before implementation.

A feature is not complete merely because a screen, API method, contract, or
test exists in isolation. The full user journey and its failure cases must work.

## Product outcome

A user should be able to:

1. Create and access a Carry account.
2. Connect an external wallet that holds an eligible NFT.
3. Prove control of that wallet.
4. Discover and inspect eligible NFTs on a supported network.
5. Authorise a deposit into the corresponding Carry vault.
6. Verify from blockchain state that the vault holds the NFT.
7. Disconnect the original wallet without losing the custody record.
8. Connect a replacement wallet and prove control of it.
9. Reassign the NFT's beneficiary under the vault's authorisation rules.
10. Confirm that the previous beneficiary can no longer exercise the reassigned
    rights.
11. Withdraw the NFT only to the currently authorised beneficiary.
12. View the transaction history and evidence for each custody action.

The long-term utility goal adds another requirement: an integrated application
must be able to verify the authorised beneficiary even though the NFT itself is
held by the Carry vault. This requires an explicit proof or integration
standard. It cannot be assumed to work automatically with every NFT utility.

---

## Phase 0 — Repository and development foundation

**Status: foundation exists on `main`; review and integration hygiene remain.**

- Maintain the pnpm/Turborepo monorepo.
- Maintain the Next.js web application and NestJS API.
- Maintain shared types, validation contracts, and API documentation.
- Keep CI checks for installation, linting, type-checking, builds, and tests.
- Establish a clear integration branch and feature-branch workflow.
- Keep the README, roadmap, architecture, security, and network documents
  consistent with the actual code.
- Add a repository licence after the owner chooses the intended reuse terms.
- Add contribution instructions, environment examples, and reproducible setup
  instructions.

**Exit criteria**

- A clean clone can install and run using documented commands.
- CI passes on the integration branch.
- The repository clearly distinguishes integrated code from experimental
  branches.

## Phase 1 — Product experience and frontend integration

**Status: prototype / branch work exists; final integration and verification
remain.**

- Build the Carry account entry experience: sign in, sign up, and account
  dashboard.
- Show an empty dashboard before a wallet is connected.
- Support connect, disconnect, and switch-wallet actions as separate user
  actions.
- Display connected wallet address and selected network clearly.
- Show the user's eligible NFTs with collection, token ID, image, network, and
  ownership details.
- Provide an NFT detail view before the user authorises custody.
- Build clear deposit, secure, beneficiary, and withdrawal states.
- Show pending, confirmed, failed, and rejected transaction states.
- Display transaction hashes and links to the relevant block explorer.
- Make empty, loading, unsupported-network, and error states understandable.
- Make the interface responsive and accessible.
- Remove misleading demo behavior from any production-facing flow.

**Exit criteria**

- A user can complete the intended journey in the interface without ambiguous
  actions or false success states.
- UI state is derived from verified API and blockchain results for real
  operations, not only local storage or mock data.
- The demo/prototype mode is clearly separated from real custody mode.

## Phase 2 — Carry identity, authentication, and sessions

**Status: backend authentication/session experiments exist in separate
branches; integrated NEAR authentication is not yet verified end to end.**

- Finalise the Carry account identity model.
- Implement the selected NEAR authentication flow.
- Verify authentication on the backend; do not trust frontend claims.
- Define secure session issuance, expiry, refresh/rotation, and revocation.
- Protect account and custody-related API routes.
- Define account recovery and re-authentication behavior.
- Add CSRF, cookie, CORS, rate-limit, and session-fixation protections as
  appropriate to the selected session design.
- Require step-up authentication for sensitive account actions where needed.

**Decision needed**

- Confirm the exact NEAR authentication provider and signed-message format.
- Confirm whether sessions are server-side or token-based and where revocation
  state is stored.
- Define what happens if a user loses access to their Carry authentication
  method.

**Exit criteria**

- Valid users can authenticate and maintain a protected session.
- Invalid, expired, revoked, and replayed authentication attempts are rejected.
- Automated tests cover authentication and session failure cases.

## Phase 3 — External wallet connection and ownership verification

**Status: wallet verification and linking experiments exist in separate
branches; complete frontend-to-backend integration remains.**

- Integrate the supported NEAR wallet connection flow.
- Define how external wallets are connected to a Carry account.
- Generate server-side, single-use ownership challenges.
- Bind signed challenges to the application domain, wallet address, network,
  purpose, and expiry.
- Verify signatures on the backend using chain-appropriate methods.
- Prevent replay, address substitution, and cross-network proof reuse.
- Support disconnecting and replacing a wallet.
- Keep Carry account authentication separate from proof of control of an NFT
  wallet.

**Exit criteria**

- The backend can verify that the user controls the wallet they are linking.
- Expired, reused, malformed, or wrong-network proofs are rejected.
- Wallet replacement does not silently transfer custody or bypass beneficiary
  rules.

## Phase 4 — NFT discovery and asset eligibility

**Status: limited discovery experiments exist; production-ready discovery is
planned.**

- Select NEAR RPC and indexer sources.
- Discover NFTs owned by the connected wallet.
- Define supported NFT standards and collection eligibility rules.
- Normalise collection names, token IDs, metadata, media, and ownership data.
- Handle pagination and large collections.
- Filter spam, malicious metadata, and unsupported assets.
- Handle missing images, malformed metadata, rate limits, provider outages, and
  stale indexer data.
- Reconcile indexer results with authoritative chain reads before custody
  actions.
- Cache metadata without treating cached ownership as authoritative.

**Exit criteria**

- The NFT list is tied to the connected wallet and selected network.
- The user can inspect why an asset is eligible or unsupported.
- Deposit preparation checks current ownership and contract compatibility.

## Phase 5 — NEAR vault contract and custody lifecycle

**Status: NEAR contract code and tests exist in a public snapshot; integration,
deployment, and a complete verified testnet lifecycle remain outstanding.**

- Review and finalise the NEAR vault contract architecture.
- Confirm supported NFT standard and collection approval policy.
- Define the vault record for each deposited NFT.
- Record the original depositor and current beneficiary.
- Implement safe deposit and custody recording.
- Prevent unauthorised transfer or withdrawal while an NFT is secured.
- Implement beneficiary reassignment under the approved authority model.
- Ensure the previous beneficiary loses rights after reassignment.
- Allow withdrawal only by the currently authorised beneficiary and only to
  the approved destination.
- Define duplicate-deposit prevention and operation idempotency.
- Define pause, recovery, upgrade, and emergency behavior before deployment.
- Add unit, integration, adversarial, and invariant tests.
- Deploy to NEAR testnet and publish verified contract addresses and explorer
  links.

**Exit criteria**

- A testnet NFT can be deposited into the vault.
- On-chain state proves the vault holds the NFT and records the correct parties.
- Beneficiary reassignment changes authority without moving the NFT.
- The old beneficiary is rejected after reassignment.
- The current beneficiary can withdraw; unauthorised wallets cannot.
- Tests cover failed, repeated, and malicious operation attempts.

## Phase 6 — Backend custody orchestration and transaction monitoring

**Status: coordination experiments exist; complete integrated lifecycle is
planned.**

- Define stable API contracts for deposit preparation, transaction submission,
  status checks, beneficiary changes, and withdrawals.
- Build chain adapters behind explicit network-specific interfaces.
- Validate account session, wallet proof, asset eligibility, and requested
  action before preparing an operation.
- Track operations through explicit states such as created, awaiting signature,
  submitted, confirmed, failed, and expired.
- Use idempotency keys to prevent duplicate operations.
- Verify transaction receipts and resulting vault state independently.
- Handle pending transactions, timeouts, dropped transactions, and retries.
- Reconcile backend records against chain state.
- Keep an auditable history of custody actions without storing private keys or
  seed phrases.
- Never report success based only on a frontend callback or a submitted
  transaction hash.

**Exit criteria**

- API state and UI state agree with independently verified chain state.
- Retries do not create duplicate deposits or withdrawals.
- Failed and incomplete operations are visible and recoverable.

## Phase 7 — Beneficiary entitlement and utility integrations

**Status: product requirement; implementation planned.**

- Define a standard way for an application to ask who is currently authorised
  to use a vaulted NFT.
- Design a verifiable beneficiary proof, read interface, or integration SDK.
- Bind proofs to the NFT contract, token ID, network, beneficiary, and expiry
  where appropriate.
- Prevent stale proofs from remaining valid after beneficiary reassignment.
- Define how third-party applications verify proofs independently.
- Build a reference integration for one membership or token-gated use case.
- Document which utility models work without changes and which require
  integration by the NFT issuer or application.

**Important limitation**

A vault-owned NFT may no longer pass a third-party application's ordinary
direct-owner check. Carry OS must not promise universal utility preservation
until the application can verify the authorised beneficiary.

**Exit criteria**

- A reference application can verify the current beneficiary.
- A reassignment invalidates the old beneficiary's entitlement.
- The integration's supported and unsupported cases are documented.

## Phase 8 — Database, reliability, and operational foundations

**Status: schema and production operations remain to be completed and reviewed.**

- Finalise PostgreSQL and Prisma schema and migration ownership.
- Store account metadata, wallet links, sessions or revocation data, discovery
  cache, operation state, transaction references, and audit events as required.
- Keep on-chain custody state authoritative.
- Define encryption, access control, data minimisation, retention, and deletion.
- Add structured logs, correlation IDs, metrics, and alerting.
- Define RPC/indexer provider timeouts, fallbacks, and rate-limit behavior.
- Add backup and restore procedures.
- Add environment-specific configuration and secret management.
- Document deployment, rollback, and incident response procedures.

**Exit criteria**

- Database migrations work from a clean environment.
- Application state can be reconciled with chain state after service downtime.
- Secrets are not stored in source control or exposed in logs.
- Operators can detect and investigate failed custody operations.

## Phase 9 — Security review and testnet release

**Status: planned.**

- Complete threat modelling for account takeover, wallet compromise, malicious
  collections, replay, beneficiary theft, and withdrawal abuse.
- Add contract invariant and adversarial tests.
- Review session, wallet proof, API, database, and frontend security.
- Run dependency, secret, static-analysis, and dynamic security checks.
- Obtain an independent smart-contract security review before handling
  meaningful value.
- Resolve findings and document accepted residual risks.
- Publish testnet contract addresses, supported standards, known limitations,
  and a reproducible end-to-end demo.
- Make it explicit that testnet assets have no guaranteed value.

**Exit criteria**

- The full NEAR testnet lifecycle passes from a clean setup.
- Security findings are resolved or explicitly documented and accepted.
- Users can independently verify the custody transactions on-chain.

## Phase 10 — Mainnet readiness

**Status: not started; requires a separate approval.**

- Complete independent audits and remediation.
- Approve production key management, signer separation, and access controls.
- Finalise emergency pause, recovery, and incident authority.
- Validate monitoring, backups, disaster recovery, and support processes.
- Review legal, privacy, and user-disclosure requirements.
- Perform a limited release and operational readiness review.
- Approve each supported network separately.

**No mainnet custody should be offered before this phase is approved.**

## Phase 11 — Additional networks

**Status: planned; NEAR completion does not automatically enable another chain.**

For each network, repeat the full integration lifecycle:

- select supported NFT standards and testnet;
- choose RPC, indexer, and explorer providers;
- implement wallet connection and ownership proof;
- build and review the chain-specific vault or program;
- implement discovery, deposit, beneficiary, and withdrawal flows;
- add transaction monitoring and reconciliation;
- pass automated and adversarial tests;
- deploy to testnet and publish verifiable evidence;
- complete a network-specific security review.

Planned networks:

- **Ethereum:** EVM-compatible NFT custody, subject to selected standards and
  vault design.
- **Solana:** Solana-native wallet, NFT, program, and transaction integration.
- **Robinhood Chain:** integration only after network architecture, standards,
  RPC, and testnet details are confirmed.

---

## Cross-cutting quality requirements

These apply to every phase:

- **Testing:** unit, integration, end-to-end, failure-path, and security tests.
- **Accessibility:** keyboard navigation, readable contrast, semantic
  components, and clear feedback.
- **Observability:** traceable operations without leaking sensitive data.
- **Documentation:** setup, API, architecture, supported networks, limitations,
  and recovery instructions stay aligned with implementation.
- **Honest status:** distinguish mock/demo behavior, prototype code, testnet
  deployments, and production support.
- **Review:** security-sensitive changes require review before integration.
- **Evidence:** every completed custody capability has reproducible tests and
  verifiable transaction evidence.

## Definition of done for a Carry OS feature

A feature is complete only when all applicable conditions are met:

1. The user-facing flow is implemented and handles loading, success, failure,
   and cancellation.
2. Backend validation and authorisation are enforced server-side.
3. On-chain permissions enforce custody rules where assets are involved.
4. Automated tests cover normal, invalid, repeated, and adversarial cases.
5. The feature is integrated with the other required components.
6. Documentation and environment configuration are updated.
7. The implementation has been reviewed and its status can be independently
   verified.

## Current non-claims

Until the relevant evidence is added, do not claim that Carry OS has:

- a production-ready authentication or account-recovery system;
- complete wallet ownership verification across all networks;
- universal NFT discovery;
- a deployed and audited production vault;
- universal compatibility with third-party NFT utilities;
- live Ethereum, Solana, or Robinhood Chain custody;
- production-grade monitoring, recovery, or mainnet support.
