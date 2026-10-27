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

See [architecture](docs/architecture/overview.md), [security model](docs/security/threat-model.md), [deployment](docs/deployment/docker-compose.md), and the [step-by-step scanner guide](docs/ci-scanner.md).

## Status

Implemented: pnpm/Turborepo, bilingual Next.js authentication and governance dashboard, NestJS API, validated and revocable sessions, same-origin protection, audit events, tenant-scoped projects and repositories, GitHub App installations for private repositories, BullMQ orchestration, isolated temporary Git checkouts, Semgrep CE execution with general, secrets, OWASP Top 10 and Infrastructure as Code profiles, parsed findings, SARIF/JSON reports, and Compose services. Policies, MFA, SSO, additional scanner engines, and AI features are not implemented.

The CI scanner analyzes an existing local checkout, including private repositories, without asking CodeGuard to clone it. It uploads bounded source excerpts around findings for the code preview, and the API persists those excerpts with the tenant-scoped findings. The legacy worker accepts HTTPS repositories on GitHub, GitLab, Bitbucket, and Azure DevOps; private GitHub repositories require a configured GitHub App installation. Credentials embedded in repository URLs are rejected, and temporary checkouts are deleted after each job.

The release workflow publishes the API, web, worker, and scanner images to Docker Hub under the `code-guard` name. See the [Docker deployment guide](docs/deployment/docker-compose.md) for required GitHub secrets and production Compose commands.

Licensed under Apache-2.0. Third-party components retain their own licenses.
