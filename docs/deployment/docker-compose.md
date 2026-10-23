# Docker Compose deployment

Copy `.env.example`, replace all placeholder secrets, and keep that file outside version control. Development overlays bind services only to loopback. Production should terminate TLS at Traefik, provide secrets through a protected environment mechanism, omit the development overlay, and restrict host firewall access to ports 80/443.

The development overlay publishes PostgreSQL on `127.0.0.1:5433` and Redis on `127.0.0.1:6380` to avoid common conflicts with locally installed services. Container-to-container URLs continue to use `postgres:5432` and `redis:6379`.

Apply Prisma migrations before serving a new API version. Back up PostgreSQL and MinIO independently, encrypt backups, and regularly test restoration into an isolated environment. Redis data is operational state and does not replace PostgreSQL records.

For offline deployment, mirror pinned images and the pnpm store into an approved registry/archive, verify digests and SBOMs, then run Compose without internet access.

MinIO Community Edition is built locally from the pinned `RELEASE.2025-10-15T17-29-55Z` source tag because its upstream project no longer provides maintained community binary images. Build and mirror `infinity-codeguard/minio:RELEASE.2025-10-15T17-29-55Z` before entering a restricted network. Review its GNU AGPLv3 license obligations before redistribution.
