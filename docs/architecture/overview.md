# Architecture overview

Infinity CodeGuard is a pnpm monorepo. Deployable processes live in `apps/`; reusable code with no product orchestration lives in `packages/`; the CI executable lives in `scanners/`; deployment assets live in `infrastructure/`.

## Runtime boundaries

| Boundary             | Responsibility                                                 | Must not contain                                            |
| -------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web`           | Routes, feature UI, browser queries and mutations              | Database access, queue processing, scanner execution        |
| `apps/api`           | Authentication, authorization and synchronous use cases        | Scanner processes, React UI, unscoped tenant queries        |
| `apps/worker`        | Isolated asynchronous scan jobs and result persistence         | HTTP controllers, session authorization, UI code            |
| `scanners/codeguard` | Analyze the current CI checkout and upload a normalized report | Repository cloning, database access, long-lived credentials |
| `packages/contracts` | Zod schemas and shared transport types                         | Framework code or business orchestration                    |
| `packages/database`  | Prisma schema, migrations and client construction              | Product workflows                                           |
| `packages/auth`      | Password and session primitives                                | Controllers or tenant use cases                             |
| `packages/ui`        | Reusable presentation primitives                               | API calls or domain orchestration                           |

Dependencies point inward: applications may import packages, but packages never import applications. The web client communicates with the API only through validated contracts. The worker receives typed jobs and revalidates the organization, project and repository before accessing tenant data.

## Feature layout

```text
features/<feature>/
├── components/   # reusable feature presentation
├── model/        # types, constants and pure transformations
├── views/        # complete product views
├── hooks/        # server-state and UI orchestration
└── index.ts      # optional public feature API
```

Page files compose views; they do not implement every view inline. React Query keys and transport schemas must be centralized rather than recreated in individual components.

The dashboard follows this layout: `dashboard.tsx` composes the shell and views; `hooks/use-workspace-data.ts` owns tenant-scoped server queries and selections; `model/query-keys.ts` defines cache identities; `views/` contains the Projects, Project Workspace, Analyses, Vulnerabilities, Quality Gates, Reports and Integrations screens. Forms and navigation live in `components/`.

Global CSS imports the dashboard, project workspace, application shell and product view sheets in cascade order. Add a rule to the sheet that owns the view and modify the existing selector when possible. Avoid adding another copy of the same selector at the bottom of a different sheet.

API features remain organized as Nest modules. Controllers validate transport and delegate; services enforce authorization and workflows; infrastructure adapters encapsulate GitHub, Redis, storage and scanner-specific behavior.

## Analysis flow

```text
developer checkout → codeguard-scan → Semgrep comprehensive execution
                   → normalized findings → authenticated API ingestion
                   → PostgreSQL → dashboards and reports
```

`COMPREHENSIVE` executes general security, secrets, OWASP Top 10, Terraform and Dockerfile rules together. Only normalized findings are uploaded; private source code and detected secret values must never be persisted in scanner output.

The `scanner` Compose profile builds an isolated CI runner with Semgrep. `scripts/codeguard-scan` mounts the target checkout read-only and forwards the analysis token through the container environment. The regular API, web and worker services do not depend on this optional profile.

## Tenant boundaries

Every tenant-owned operation derives `organizationId` from an authenticated membership or a hashed analysis token. IDs supplied by a request are always checked together with the organization and project. The same rule applies to PostgreSQL queries, BullMQ payloads, cache keys and object-storage prefixes.

## Change rules

- Add behavior in the domain that owns it; do not append unrelated logic to a dashboard or generic service.
- Prefer pure parsing and mapping functions, with unit tests, around external tool output.
- Update contracts before producers and consumers.
- Include migrations for persisted model changes.
- Run type checking, linting and relevant tests before deployment.
- An engine is supported only after real execution, parsing, failure and isolation tests pass.
