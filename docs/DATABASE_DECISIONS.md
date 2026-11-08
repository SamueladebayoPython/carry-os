# Carry OS — Database Decisions for Team Review

**Status:** proposal and question log only. Nothing here is an approved architecture decision.  
**Date:** 8 November 2026

This document captures database choices that must be agreed before schema implementation. Existing approved constraints are separated from open questions. Once a decision is made, record it in docs/DECISIONS.md and update the affected docs before implementation.

## Approved constraints from the repository

- PostgreSQL with Prisma is the approved technology direction (D-011).
- The frontend developer owns the initial schema and migrations; the backend developer consumes them.
- The database is a coordination, indexing, and evidence-reference layer. Chain vault/program state is authoritative for custody.
- Do not store private keys, seed phrases, wallet secrets, or unencrypted session secrets.
- The system is testnet-first. No chain integration or product persistence is implemented yet.
- No decision below should be inferred from these constraints unless explicitly approved by the team.

## Decisions required before a schema proposal

### Package and tooling

1. Should the Prisma schema/client live in a new packages/database workspace package, as suggested by docs/ARCHITECTURE.md, or in another boundary?
2. Which Prisma version and generated-client strategy fit the pinned Node 24, pnpm 12.18.0, TypeScript 6.0.3, and current NestJS toolchain?
3. How should the API import the generated client without creating a frontend-to-backend ownership dependency?
4. What are the migration commands, naming rules, review ownership, and CI checks?
5. Are seed scripts needed for local development? If yes, what strictly non-production data may they create?

### Environment and operations

6. Which PostgreSQL versions and local setup are supported (for example, Docker Compose, developer-managed service, or CI service container)?
7. Which environments will have databases, and who provisions them?
8. What are the connection-pooling, TLS, credential, and least-privilege role requirements?
9. What are backup, restore, migration rollback/forward-fix, and disaster-recovery expectations?

### Data ownership and lifecycle

10. Which user/identity identifier is canonical, and how does a NEAR identity link to external chain addresses? The identity and linking models are not yet approved.
11. Which persisted session fields, if any, are required? The session storage, lifetime, revocation, and secret handling model are TBD.
12. What NFT metadata/index data is cached versus fetched on demand, and what are freshness, spam-filtering, and retention rules?
13. Which records represent deposit, beneficiary-change, and withdrawal intents, and what state transitions are required? These records must reference chain evidence and never establish custody by themselves.
14. What audit events are required, what data may they contain, and how long are they retained?
15. What privacy classification, deletion, export, and retention rules apply to identity, wallet-link, and operational data?

### API and concurrency

16. What are the shared API contract conventions for pagination, error responses, idempotency, and versioning?
17. How should concurrent requests, retries, chain reorgs, and partially observed transactions affect persisted operation states?
18. Which identifiers, uniqueness constraints, and idempotency scopes should be shared between API and database layers?

## Suggested review sequence

1. Frontend and backend developers agree package boundary, generated-client consumption, and migration ownership.
2. Resolve identity/session ownership and the operation lifecycle/API contract questions needed to avoid schema churn.
3. Agree data classification, retention, access, backup, and environment requirements.
4. Record approved decisions in docs/DECISIONS.md and update docs/ARCHITECTURE.md, docs/API.md, and docs/SECURITY.md where appropriate.
5. Draft the schema proposal and request teammate review before adding dependencies, schema files, or migrations.

## Not decided here

No table names, relations, field types, chain ordering, session strategy, hosting vendor, retention duration, or custody state machine is approved by this document.
