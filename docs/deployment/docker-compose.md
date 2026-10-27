# Docker Compose deployment

Copy `.env.example`, replace all placeholder secrets, and keep that file outside version control. Development overlays bind services only to loopback. Production should terminate TLS at Traefik, provide secrets through a protected environment mechanism, omit the development overlay, and restrict host firewall access to ports 80/443.

The development overlay publishes PostgreSQL on `127.0.0.1:5433` and Redis on `127.0.0.1:6380` to avoid common conflicts with locally installed services. Container-to-container URLs continue to use `postgres:5432` and `redis:6379`.

Apply Prisma migrations before serving a new API version. Back up PostgreSQL and MinIO independently, encrypt backups, and regularly test restoration into an isolated environment. Redis data is operational state and does not replace PostgreSQL records.

For offline deployment, mirror pinned images and the pnpm store into an approved registry/archive, verify digests and SBOMs, then run Compose without internet access.

MinIO Community Edition is built locally from the pinned `RELEASE.2025-10-15T17-29-55Z` source tag because its upstream project no longer provides maintained community binary images. Build and mirror `infinity-codeguard/minio:RELEASE.2025-10-15T17-29-55Z` before entering a restricted network. Review its GNU AGPLv3 license obligations before redistribution.

## Docker Hub release images

The `Publish code-guard images` GitHub Actions workflow builds and pushes four Linux AMD64 images to the `benjamin775` namespace after the repository validation workflow passes:

- `<namespace>/code-guard-api:<version>`
- `<namespace>/code-guard-web:<version>`
- `<namespace>/code-guard-worker:<version>`
- `<namespace>/code-guard-scanner:<version>`

Each image also receives a `sha-<commit>` tag. The workflow runs for a `vX.Y.Z` Git tag or manually from the `master` or `main` branch with a version input. It does not publish from pull requests. Configure the GitHub repository variable `DOCKERHUB_NAMESPACE=benjamin775` and the secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (a Docker Hub access token with push permission). The namespace must own the four image repositories. The MinIO image is deliberately excluded because its redistribution requires a separate licensing decision.

To deploy published images, set `CODE_GUARD_IMAGE_NAMESPACE` and `CODE_GUARD_IMAGE_TAG` in the protected `.env` file, then use the production overlay. For example:

```sh
docker compose --env-file .env -f infrastructure/docker/compose.yml -f infrastructure/docker/compose.prod.yml pull api worker web
docker compose --env-file .env -f infrastructure/docker/compose.yml -f infrastructure/docker/compose.prod.yml build minio
docker compose --env-file .env -f infrastructure/docker/compose.yml -f infrastructure/docker/compose.prod.yml run --rm --no-deps api ./packages/database/node_modules/.bin/prisma migrate deploy --schema packages/database/prisma/schema.prisma
docker compose --env-file .env -f infrastructure/docker/compose.yml -f infrastructure/docker/compose.prod.yml up -d --no-build
```

The scanner image is optional and runs through the `scanner` profile. Production Compose uses the project name `code-guard`. Keep the development overlay separate to preserve existing local containers and ports.
