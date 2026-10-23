# Infinity CodeGuard

Infinity CodeGuard is an open-source foundation for code-quality and application-security governance. This repository currently provides the platform shell, identity and organization domain foundation, asynchronous scan job contract, and self-hosted Docker topology. Scanner adapters and analysis engines are intentionally **not** represented as working yet.

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

Web: <http://localhost:3000>. API health: <http://localhost:4000/api/v1/health>. OpenAPI: <http://localhost:4000/api/docs>.

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

Implemented: pnpm/Turborepo, Next.js shell, NestJS API health/auth foundation, validated and revocable sessions, same-origin protection, authentication audit events, tenant-derived organization listing, role-protected project creation and listing, Prisma schema and migration, BullMQ job validation/fail-closed worker, and Compose services. Not implemented: repository integrations, scanner adapters, findings, policies, MFA, SSO, fine-grained project permissions, analysis engines, reports, and AI features.

Licensed under Apache-2.0. Third-party components retain their own licenses.
