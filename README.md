# Infinity CodeGuard

Infinity CodeGuard is an open-source foundation for code-quality and application-security governance. It includes identity and organization boundaries, projects and repositories, asynchronous Semgrep Community Edition scans, persisted findings, and a self-hosted Docker topology.

## Quick start

Requirements: Node.js 22+, pnpm 11+, and Docker with Compose.

```bash
cp .env.example .env
# Replace every placeholder secret in .env
pnpm install
pnpm db:generate
docker compose --env-file .env -f infrastructure/docker/compose.yml -f infrastructure/docker/compose.dev.yml up -d postgres redis minio
docker compose --env-file .env -f infrastructure/docker/compose.yml -f infrastructure/docker/compose.dev.yml build api worker web
docker compose --env-file .env -f infrastructure/docker/compose.yml -f infrastructure/docker/compose.dev.yml run --rm --entrypoint packages/database/node_modules/.bin/prisma api migrate deploy --schema packages/database/prisma/schema.prisma
docker compose --env-file .env -f infrastructure/docker/compose.yml -f infrastructure/docker/compose.dev.yml up -d
```

Web: <http://localhost:3000/fr/login> (English: <http://localhost:3000/en/login>). API health: <http://localhost:4000/api/v1/health>. OpenAPI: <http://localhost:4000/api/docs>.

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm compose:config
```

See [architecture](docs/architecture/overview.md), [security model](docs/security/threat-model.md), and [deployment](docs/deployment/docker-compose.md).

## Status

Implemented: pnpm/Turborepo, bilingual Next.js authentication and governance dashboard, NestJS API, validated and revocable sessions, same-origin protection, audit events, tenant-scoped projects and repositories, BullMQ orchestration, isolated temporary Git checkouts, Semgrep CE execution, parsed findings, and Compose services. Private repository credentials, policies, MFA, SSO, reports, additional scanners, and AI features are not implemented.

Only public HTTPS repositories hosted on GitHub, GitLab, Bitbucket, or Azure DevOps are accepted by the scan worker. Credentials are rejected, source checkouts are deleted after each job, and source snippets are not persisted.

Licensed under Apache-2.0. Third-party components retain their own licenses.
