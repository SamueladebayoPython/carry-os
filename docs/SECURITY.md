# carry os security principles

> **Status:** security baseline for the foundation only. No authentication,
> wallet proof, custody contract, signing service, or production database exists
> yet. Items marked **TBD** require a decision before implementation.

## 1. Non-negotiable principles

1. **Blockchain state is authoritative for custody.** The database and backend
   are coordination and evidence layers, not the owner of a vaulted asset.
2. **Every privileged action requires verifiable authorisation.** Authentication
   alone must not authorise a beneficiary change or withdrawal.
3. **No secrets in source control.** Never commit private keys, seed phrases,
   session secrets, API keys, or production credentials.
4. **Testnet-first.** Mainnet deployment requires an explicit readiness review.
5. **Fail closed.** If ownership, custody evidence, or authorisation cannot be
   verified, the operation must not proceed.
6. **Least privilege.** Services receive only the permissions required for a
   specific operation.
7. **Auditability.** Security-relevant operations must produce durable evidence
   without storing secrets.

## 2. Trust boundaries

- Browser and wallet interfaces are untrusted input sources.
- The Next.js frontend must not be trusted to enforce authorization.
- The NestJS API is trusted only after verifying authentication and
  authorisation evidence.
- External wallets are trusted only for cryptographic proofs they produce.
- RPC providers and indexers are external dependencies; their responses must be
  validated and reconciled with authoritative chain reads.
- Vault/program state is the custody authority.
- Database access is privileged infrastructure access and must be restricted.

## 3. Authentication and sessions — TBD

The following require approval before implementation:

- NEAR authentication message format and verification flow.
- Session storage (server-side, database-backed, or signed token), lifetime,
  rotation, and revocation.
- Protection against replay, fixation, CSRF, and cross-site request forgery.
- Cookie/security-header policy and CORS allowlists.
- Account recovery and session invalidation after wallet replacement.
- MFA or step-up authentication for high-risk actions.

The current API has no authentication and exposes only a health endpoint.

## 4. Wallet ownership proof — TBD

Each external wallet must prove control through a chain-appropriate signature.
The design must define:

- domain/application binding;
- a server-issued, single-use nonce;
- expiry and replay protection;
- chain and account binding;
- canonical message construction;
- verification libraries and supported wallet providers;
- behavior when a wallet is lost, replaced, or compromised.

NEAR authentication does not by itself prove ownership of an Ethereum, Solana,
or Robinhood Chain wallet.

## 5. Custody and smart contract security — TBD

Vault/program design must specify:

- who can initiate a deposit, beneficiary change, or withdrawal;
- how the current beneficiary is represented and proven;
- upgradeability, admin powers, and timelock behavior;
- emergency pause and recovery procedures;
- replay and cross-chain replay protection;
- reentrancy, authorization, and invariant testing;
- audit scope and deployment approval.

No contract or program is implemented. No signer or MPC design has been chosen.
Key management, HSM/KMS usage, and separation of duties are **TBD**.

## 6. Backend security

Planned controls:

- authenticated and authorised routes by default;
- strict input validation using shared contracts;
- rate limiting and abuse controls;
- idempotency for custody operations;
- safe transaction construction and independent verification;
- no signing authority without an approved key-management model;
- structured audit logs with secret redaction;
- dependency and container scanning;
- secure headers and restricted CORS.

Error responses must not leak secrets, internal stack traces, or sensitive
wallet/session data.

## 7. Data protection — TBD

Database schema ownership belongs to the frontend developer, but security
requirements are shared. Before schema implementation, define:

- data classification and retention;
- encryption at rest and in transit;
- access control and least-privilege database roles;
- whether any personal data is stored;
- backup, restore, and deletion procedures;
- audit-log retention;
- prohibition on storing private keys or unencrypted session secrets.

The database must never be used as proof of custody.

## 8. External dependencies

RPC providers, indexers, wallet providers, and hosting services introduce
availability and supply-chain risk. The team must define:

- provider allowlists and fallback behavior;
- response validation and reorg handling;
- rate-limit and outage handling;
- dependency pinning and update review;
- vendor data-sharing and privacy review;
- incident escalation for provider compromise.

## 9. Testing and assurance

Before a network is marked implemented:

- unit tests for validation and authorization logic;
- integration tests against the network testnet;
- adversarial tests for replay, forgery, and unauthorized changes;
- contract invariant and invariant-break tests;
- contract audit and remediation;
- operational runbook validation.

A basic CI workflow exists for install, lint, type-check, build, and tests. It
does not yet include dependency scanning, secret scanning, contract tests, or
security testing. Adding those controls requires approval and must not imply
that security testing is complete.

## 10. Known security gaps at this stage

- No authentication or authorization.
- No wallet ownership verification.
- No custody contracts or programs.
- No transaction monitoring.
- No database schema, access controls, or audit log.
- No key-management model.
- No CI dependency scanning, secret scanning, or automated security testing.
- No incident-response plan.
- No external audit.

These gaps are expected for a foundation task and must remain visible until
closed.
