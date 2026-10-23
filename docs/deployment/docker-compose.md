# Docker Compose deployment

Copy `.env.example`, replace all placeholder secrets, and keep that file outside version control. Development overlays bind services only to loopback. Production should terminate TLS at Traefik, provide secrets through a protected environment mechanism, omit the development overlay, and restrict host firewall access to ports 80/443.

Apply Prisma migrations before serving a new API version. Back up PostgreSQL and MinIO independently, encrypt backups, and regularly test restoration into an isolated environment. Redis data is operational state and does not replace PostgreSQL records.

For offline deployment, mirror pinned images and the pnpm store into an approved registry/archive, verify digests and SBOMs, then run Compose without internet access.
