# carry os security

> **Purpose:** this document defines the security model, trust boundaries, threats, and controls required to protect Carry OS accounts, connected wallets, NFT custody, and beneficiary rights.
>
> **Development status:** Carry OS is still in active development. The requirements below describe the intended security model, not a claim that the product is production-ready. Authentication, wallet verification, backend controls, and vault code exist in separate public branches or snapshots, but that does not mean they are integrated, deployed, or independently verified as one secure product. Treat a control as implemented only when its integrated code, tests, and environment evidence are available.

## 1. Security objective

Carry OS is designed to keep an NFT in a dedicated on-chain vault while allowing the authorised beneficiary to change without moving the NFT between personal wallets.

The security objective is to protect three separate things:

1. **The Carry account:** prevents an attacker from taking over the user's application identity.
2. **Wallet authority:** proves which blockchain wallet is approving a particular action.
3. **NFT custody and beneficiary rights:** ensures that only the parties authorised by the vault contract can change custody or withdraw an asset.

These protections are related, but they are not interchangeable. Signing in must not grant NFT withdrawal rights. Connecting a wallet must not prove its ownership. A database record must not override the vault.

## 2. Why Carry OS uses NEAR Auth for login

### What NEAR Auth does

Carry OS uses **NEAR Auth as its intended account sign-in and onboarding layer**. NEAR Auth lets a user authenticate using familiar methods such as Google, Apple, email, or a passkey, then resolves that identity to a NEAR account through NEAR's account and MPC infrastructure.

The purpose is to avoid making every new user begin by installing a browser wallet, creating a seed phrase, and learning wallet management just to access Carry OS. A user can enter the product through a familiar login experience while still receiving a NEAR-based account identity.

NEAR Auth also gives Carry OS a NEAR-native identity path. That is relevant because NEAR is the first network Carry OS is building for. It reduces the gap between account onboarding and the first NEAR experience, rather than introducing an unrelated login system and then separately asking every user to establish a NEAR identity.

Official product information: [NEAR Auth](https://auth.near.org/).

### What happens during login

The intended flow is:

1. The user selects a supported sign-in method in the NEAR Auth interface.
2. The identity provider authenticates the user and issues a signed authentication token.
3. The NEAR Auth flow associates the verified identity with the user's NEAR account using its supported account and MPC mechanism.
4. Carry OS receives the authentication result.
5. The backend validates the token and its claims using the provider's documented verification process.
6. The backend maps the verified identity to the correct Carry account and creates or resumes a Carry OS session.
7. Protected API requests use that session to identify the Carry account making a request.

The backend must verify the authentication result. The frontend must never be allowed to declare that a user is signed in merely by submitting an account ID or setting a local flag.

### Why this improves onboarding

- **Familiar entry:** users can sign in using credentials they already know instead of first learning seed-phrase and wallet-extension workflows.
- **Passkey option:** users can use a passkey where supported by NEAR Auth and their device.
- **NEAR-native identity:** the login flow is designed to resolve to a NEAR account, which fits Carry OS's first-chain implementation.
- **Consistent identity:** the same supported identity can resolve to the same NEAR account across NEAR Auth-integrated applications, subject to the provider's identity configuration.
- **Less onboarding friction:** users can access their Carry account before they understand every wallet operation.

### What NEAR Auth does not do

NEAR Auth is the login layer. It is not the Carry vault and it is not a universal wallet-ownership proof.

- A successful NEAR Auth login proves authentication through the configured identity flow. It does not automatically prove control of an Ethereum or Solana wallet.
- A login session does not authorise an NFT deposit, beneficiary reassignment, or withdrawal.
- NEAR Auth does not make Carry OS the owner of a user's external wallets.
- NEAR Auth availability and account access depend on its identity provider, supported infrastructure, and the user's ability to access their chosen login method.
- NEAR Auth's MPC and account infrastructure do not remove the need for Carry OS to secure its own sessions, APIs, contracts, and recovery flows.

For every connected wallet, Carry OS must still perform a separate chain-appropriate ownership proof. For every custody operation, the wallet or authorised signer must approve the specific transaction required by the relevant chain.

### NEAR Auth security requirements

- Use the official provider SDK and documented integration flow; do not imitate or reimplement its token issuance.
- Validate token signatures and claims on the backend using trusted issuer metadata and signing keys.
- Enforce the expected issuer, audience, expiry, and subject. Reject tokens issued for another application or API.
- Reject expired, malformed, incorrectly signed, or otherwise invalid authentication results.
- Do not trust identity fields supplied separately by the browser when they conflict with verified token claims.
- Map the verified identity to one stable Carry account. Do not allow a user-controlled request to attach an arbitrary identity to an existing account.
- Protect the application session independently of the NEAR Auth token.
- Define session expiry, renewal, logout, revocation, and behavior after identity-provider account changes.
- Never log raw authentication tokens, session cookies, or other bearer credentials.
- Keep provider credentials and secrets in environment-managed secret storage, never in source control or browser bundles.
- Document account recovery and the consequences of losing access to the underlying login method.

## 3. Authentication, session, and authorisation are different

Carry OS must keep these concepts separate:

| Control | Question it answers | What it permits |
| --- | --- | --- |
| NEAR Auth login | Who authenticated to Carry OS? | Access to the user's Carry account |
| Carry session | Is this request associated with a currently valid Carry login? | Access to protected application routes |
| Wallet ownership proof | Does the user control this specific wallet on this specific chain? | Linking or using that wallet for an explicitly approved purpose |
| Transaction signature | Did the wallet approve this exact blockchain action? | Submission of that approved transaction |
| Vault contract permission | Does the caller satisfy the custody rules recorded on-chain? | The specific custody operation allowed by the contract |

A valid login is not a substitute for a wallet signature. A wallet signature is not a substitute for the vault's permission checks. The API must verify each layer that applies to an operation.

## 4. Trust boundaries

- **Browser and frontend:** untrusted. Users can modify requests, local state, and displayed values.
- **NEAR Auth and identity provider:** external authentication dependencies. Carry OS must validate their signed results and handle outages or configuration changes.
- **Carry OS API:** responsible for validating sessions, wallet proofs, inputs, and operation state. It must not have unilateral custody authority.
- **Connected wallets:** trusted only for valid signatures over the exact message or transaction presented to the user.
- **RPC providers and indexers:** external data sources. Responses can be stale, incomplete, unavailable, or inconsistent.
- **Vault contract:** authoritative for custody ownership and on-chain beneficiary permissions.
- **Database:** application persistence, not proof of ownership or custody.
- **Build and deployment pipeline:** privileged supply-chain boundary. A compromised dependency, secret, or deployment credential can undermine the application.

Every boundary must have explicit validation. Do not assume that data is safe because it came from another Carry OS component.

## 5. Wallet ownership proof

### Threat

A wallet address is public. An attacker can submit another person's address to a form and claim it belongs to them. If Carry OS accepts the address without proof, the attacker may see or initiate actions against records they do not control.

### Required control

For each supported chain, the API generates a fresh challenge bound to:

- Carry OS application/domain;
- exact wallet address;
- chain/network identifier;
- intended purpose, such as linking a wallet or confirming a beneficiary;
- unique unpredictable nonce;
- issue time and expiry.

The wallet signs the exact challenge using the chain's supported signing method. The backend verifies the signature against the expected wallet and consumes the nonce.

### Required protections

- Use a separate verifier for each chain's signature format.
- Bind the proof to the account, wallet, network, and purpose.
- Reject expired challenges and previously consumed nonces.
- Prevent message substitution, cross-domain reuse, and cross-chain replay.
- Canonicalise addresses and messages before verification.
- Rate-limit challenge creation and verification.
- Do not treat a connected-wallet event from the browser as proof.
- Require a fresh proof when a wallet is linked or replaced.

### Network-specific wallet verification

The verification method must match the network. Carry OS must not accept one chain's signature as proof of control over an address on another chain.

| Network | Verification requirement | Security consideration |
| --- | --- | --- |
| NEAR | Verify the signature or authentication proof using the selected NEAR wallet protocol and expected NEAR account | Keep NEAR Auth login separate from proof that an external NEAR wallet controls an NFT |
| Ethereum | Verify a domain-bound, nonce-protected EVM message signature against the expected address and chain context | Prevent replay across Carry OS domains, accounts, and chains. Use a standard such as Sign-In with Ethereum where appropriate |
| Solana | Verify the exact challenge signature against the expected Solana public key using the selected wallet signing method | Do not interpret an EVM address or signature as a Solana identity |
| Robinhood Chain | Verify EVM wallet signatures with Robinhood Chain's chain context and configured network ID | Do not accept a proof created for Ethereum as proof that the same address approved an action on Robinhood Chain |

For every network, the backend must validate the challenge purpose, account binding, network identifier, nonce, issue time, expiry, and signature. The challenge must be single-use. Transaction approval remains a separate wallet action.

NEAR Auth login does not prove ownership of Ethereum, Solana, or Robinhood Chain wallets. Each requires its own proof.
## 6. Carry sessions and browser security

### Threats

An attacker may steal a session, reuse an expired token, exploit cross-site requests, or persuade the browser to submit an operation under another user's session.

### Required controls

- Use secure, HTTP-only, appropriately scoped cookies for browser sessions where the selected architecture supports them.
- Apply Secure, HttpOnly, and an appropriate SameSite policy.
- Use CSRF protection for cookie-authenticated state-changing requests.
- Rotate session identifiers after authentication and privilege changes.
- Set explicit idle and absolute session lifetimes.
- Revoke sessions on logout and provide a way to invalidate sessions after suspected compromise.
- Restrict CORS to known application origins.
- Set appropriate content security and other browser security headers.
- Do not store long-lived bearer tokens in browser local storage.
- Require step-up authentication or fresh wallet approval for sensitive actions where appropriate.
- Never let frontend route guards act as the only access control. The API must enforce authentication and authorisation.

## 7. Vault and custody security

### Threats

An attacker may try to withdraw an NFT, change its beneficiary, deposit an unsupported token, replay a transaction, exploit a contract bug, or abuse an administrative permission.

### Required contract rules

The first NEAR vault must enforce custody permissions itself. Future Ethereum, Solana, and Robinhood Chain vaults or programs must enforce equivalent product rules using their own chain-specific security model. A shared API rule is not a substitute for on-chain enforcement:

- Accept only supported NFT standards and approved collection policies.
- Verify the incoming token and prevent duplicate custody records.
- Record the NFT, original depositor, current beneficiary, and custody status.
- Reject arbitrary transfers or withdrawals while the NFT is in custody.
- Allow beneficiary reassignment only through the approved authority defined by the contract.
- Allow withdrawal only to the destination permitted by the current beneficiary and contract rules.
- Reject former beneficiaries after reassignment.
- Reject unauthorised callers even if the API or frontend requests the operation.
- Update custody state atomically with the relevant transfer.
- Emit or expose enough evidence for the application to verify each state transition.

The intended authority model is that the original depositor can request beneficiary reassignment, while the current beneficiary can request withdrawal. This must be enforced and tested in the deployed contract. A database field or API permission check alone is insufficient.

### Contract administration

Before testnet release, document:

- whether the contract is upgradeable;
- who controls upgrade permissions;
- whether upgrades require a delay or multiple approvals;
- whether an emergency pause exists and exactly what it can stop;
- how a stuck or unsupported NFT can be recovered, if recovery is allowed;
- how storage deposits and storage cleanup work;
- whether any administrator can redirect assets or change beneficiaries.

Admin and recovery functions must be minimal, explicit, tested, and disclosed. Do not add a hidden backdoor for convenience.

### Required tests

- valid deposit and custody record creation;
- rejected unsupported collection or token;
- duplicate deposit rejection;
- unauthorised beneficiary change rejection;
- former beneficiary withdrawal rejection;
- unrelated wallet withdrawal rejection;
- valid current-beneficiary withdrawal;
- failed transfer and rollback behavior;
- repeated transaction and replay behavior;
- contract invariants after every custody transition.

## 8. Beneficiary and utility-proof security

### Threat

A third-party application may accept an outdated beneficiary proof after reassignment, or an attacker may fabricate a claim that a wallet is entitled to an NFT's utility.

### Required controls

- Bind every entitlement response or proof to the chain, collection, token ID, current beneficiary, and active custody state.
- Derive the beneficiary from authoritative contract state, not a browser field or unverified database row.
- Include a block reference, freshness window, or another verifiable way to detect stale state.
- Invalidate cached or issued proofs after beneficiary reassignment or withdrawal.
- Make third-party verification independently checkable.
- Do not claim universal compatibility. An external application must integrate the Carry verification method or query the vault itself.

The first reference integration should test that the current beneficiary receives access and the previous beneficiary loses access after reassignment.

## 9. Backend and transaction security

The API coordinates operations but must not become a privileged asset custodian.

Required controls:

- Authenticate and authorise every protected route.
- Validate request bodies, query parameters, addresses, chain identifiers, and token IDs.
- Use shared request/response types while repeating security-critical validation on the server.
- Use idempotency keys for deposit, reassignment, and withdrawal requests.
- Construct transactions from verified server-side records, not arbitrary client-supplied contract calls.
- Show the user the network, contract, token, action, and destination they are approving.
- Treat transaction submission as pending, not success.
- Verify the transaction and resulting contract state before marking an operation complete.
- Handle timeouts, retries, duplicate requests, provider errors, and chain finality.
- Rate-limit authentication, challenge, discovery, and transaction-preparation endpoints.
- Redact tokens, cookies, signatures where sensitive, and personal data from logs.
- Do not introduce backend signing keys or privileged relayers without a documented threat model and key-management design.

A backend response must never claim that an NFT is secured solely because a transaction hash was returned.

## 10. Database and privacy security

The database stores Carry account references, linked-wallet metadata, operation records, transaction hashes, and audit history. It does not own NFTs and must not decide who can withdraw them.

Required controls:

- Apply least-privilege database roles.
- Encrypt traffic in transit and protect database storage and backups.
- Store only the personal data needed to operate the service.
- Define retention, deletion, backup, and restoration policies.
- Protect session and identity references.
- Record security-relevant events without logging credentials or secrets.
- Use migrations and review schema changes.
- Reconcile important records with on-chain state.
- Alert or surface a mismatch when database state disagrees with the vault.
- Never store seed phrases, private keys, or unencrypted authentication secrets.

## 11. NFT metadata and external content

NFT names, descriptions, image URLs, and collection metadata are untrusted external content.

Required controls:

- Treat metadata as data, never executable instructions.
- Escape user-visible text and sanitise content where rendering requires it.
- Restrict or proxy remote media according to a documented policy.
- Avoid unrestricted server-side URL fetching that could expose internal services.
- Handle malformed metadata, oversized responses, unsupported media, and missing content.
- Do not use metadata claims as proof of collection authenticity or custody eligibility.
- Clearly distinguish verified collections from unverified assets.

## 12. Infrastructure and software supply chain

Required controls:

- Keep secrets out of Git history, build logs, client bundles, and issue reports.
- Use environment-specific credentials with minimum permissions.
- Pin and review dependencies; monitor advisories and remove abandoned packages.
- Run secret scanning, dependency scanning, and static analysis in CI.
- Protect the integration branch and require review for security-sensitive changes.
- Restrict deployment credentials and rotate them after suspected exposure.
- Keep production, testnet, and local-demo credentials separate.
- Record deployed contract addresses and source revisions.
- Back up critical application data and test restoration.
- Monitor authentication failures, wallet-proof abuse, contract events, API errors, and transaction reconciliation failures.

## 13. Threat response and recovery

Carry OS must prepare for:

- compromised Carry login or identity-provider account;
- lost or compromised connected wallet;
- compromised browser or device;
- malicious or vulnerable NFT collection;
- NEAR Auth, RPC, indexer, or relayer outage;
- vault contract vulnerability;
- accidental or malicious administrative action;
- leaked API, database, or deployment credentials.

The incident plan must define how to detect the event, stop affected operations, revoke sessions or credentials, preserve evidence, communicate with affected users, recover service, and document the incident.

Account recovery must not silently bypass vault permissions. If a user loses access to the original depositor wallet, the team must not promise that support can simply replace it. Any recovery path that can change custody authority must be designed into the contract, reviewed, and disclosed before assets are deposited.

## 14. Security verification gates

A feature is not security-complete because it works in a happy-path demo.

| Area | Required evidence |
| --- | --- |
| NEAR Auth | Invalid issuer, audience, signature, expiry, and malformed token tests; session lifecycle tests |
| Sessions | CSRF, fixation, expiry, logout, revocation, and cookie-policy tests |
| Wallet proof | Forged, expired, replayed, wrong-chain, and wrong-address proof tests |
| NFT discovery | Malformed metadata, stale indexer, unsupported token, and provider failure tests |
| Vault | Permission tests, custody invariants, duplicate deposit, and withdrawal tests |
| Beneficiary | Old-beneficiary rejection and current-beneficiary verification |
| Backend | Input validation, idempotency, rate limits, and transaction reconciliation tests |
| Database | Access-control, backup/restore, retention, and chain reconciliation tests |
| Release | Testnet end-to-end evidence, deployment review, incident runbook, and independent contract review |

Before mainnet or meaningful-value custody, obtain an independent smart-contract security review, remediate findings, and document any accepted residual risks.

## 15. Current security status and known gaps

Carry OS remains in active development. Public repository branches contain authentication/session experiments, wallet-verification code, frontend prototypes, and NEAR vault contract work. These are development artifacts, not proof that the complete security model is integrated or deployed. NEAR is the first implementation target. Ethereum, Solana, and Robinhood Chain remain planned and have no verified Carry OS custody deployment.

Until the relevant implementation and evidence are available, the following must remain unclaimed:

- production-ready NEAR Auth integration;
- complete account recovery and session revocation;
- wallet ownership verification across all supported networks;
- network-specific vault deployments and independent custody verification for Ethereum, Solana, and Robinhood Chain;
- a deployed and independently reviewed production vault;
- verified beneficiary reassignment and withdrawal on testnet;
- a production utility-entitlement proof system;
- production key management, monitoring, and incident response;
- audited mainnet custody.

Update this section as each control is integrated and verified. Never change a status based only on a plan, a local demo, or code existing in a separate branch.

## 16. Security decisions still required

Record decisions in [DECISIONS.md](DECISIONS.md) before dependent implementation is treated as final:

- exact NEAR Auth SDK, issuer, audience, environment, and supported login methods;
- Carry session architecture, expiry, renewal, and revocation;
- account recovery and identity-provider account-change behavior;
- wallet challenge format and verification library for each chain;
- supported NFT standards and custody implementation scope for each network;
- chain-specific RPC, indexer, finality, and transaction-reconciliation providers;
- original depositor recovery if the wallet is lost;
- beneficiary destination rules;
- contract upgrade, pause, and emergency authority;
- RPC/indexer providers and confirmation/finality requirements;
- data retention, privacy, and incident-response ownership;
- key management and whether any relayer or backend signer is required.
