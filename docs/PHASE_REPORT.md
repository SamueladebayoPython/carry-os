# Carry OS — Phase 0 Repository Report

**Status:** reconnaissance complete; branch documentation prepared.  
**Reviewed:** main and the unmerged feat/backend-architecture branch, 8 November 2026.

## Summary

Carry OS is at the repository-foundation stage. The repo is a pnpm/Turborepo monorepo with a minimal Next.js app, a NestJS API, shared contracts, and foundation documentation. PostgreSQL/Prisma is an approved technology direction and belongs to the frontend developer, but there is no database package, Prisma dependency, schema, migration, or database test infrastructure yet.

The docs explicitly prohibit inventing unresolved architecture, custody, identity, and data decisions. Blockchain vault/program state remains the authority for custody; the database is for coordination, indexing, and evidence references. No schema implementation should begin until the open database and API decisions are reviewed with the backend developer.

## Repository findings

- apps/web: Next.js foundation page; frontend API/data integration remains future work.
- apps/api: NestJS foundation and health endpoint on main; the active feat/backend-architecture branch adds backend infrastructure and a chain registry, but the product flows remain planned.
- packages/shared: shared foundation contracts.
- packages/database: does not exist.
- Prisma/PostgreSQL dependencies, schema, migrations, seed scripts, and database container: not present in the reviewed main snapshot.
- Documentation: docs/ROADMAP.md, docs/DECISIONS.md, docs/ARCHITECTURE.md, and docs/SECURITY.md consistently describe database work as deferred and record substantial unresolved decisions.
- Branch state: GitHub showed main, feat/backend-architecture, and chore/repository-foundation; feat/backend-architecture is unmerged and has two commits with 35 files changed relative to main. Coordinate schema/API boundaries with that work before integrating.

## Ownership and boundaries

The architecture assigns the frontend developer ownership of the PostgreSQL/Prisma schema, migrations, Next.js, wallet connection interfaces, and frontend API integration. Backend ownership includes NestJS services, authentication/session verification, wallet ownership proof, discovery, custody coordination, and chain integrations. API contracts, shared types, architecture, security decisions, and integration tests are shared.

Database records must not be treated as proof of custody or as a way to override on-chain rights. Secrets, private keys, seed phrases, and unencrypted session secrets must not be stored.

## Recommended next steps

1. Review the unresolved database and API questions in DATABASE_DECISIONS.md with the backend developer.
2. Agree the package boundary, migration workflow, and how frontend-owned schema changes are consumed by the API branch.
3. Record approved answers in docs/DECISIONS.md and affected architecture/API documents.
4. Only then prepare a schema proposal for review; implement Prisma, migrations, seeds, and persistence after approval.

## Limits of this review

The GitHub API connector returned 404 for the private repository, so the source review used the signed-in GitHub browser and a downloaded main snapshot. No CI or tests were run. This report records repository state as observed on 8 November 2026 and should be refreshed if the backend branch changes materially.
