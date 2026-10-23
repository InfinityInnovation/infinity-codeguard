# Architecture overview

The monorepo separates deployable applications from reusable packages. `web` renders the UI, `api` owns synchronous use cases, and `worker` consumes typed BullMQ jobs. PostgreSQL is authoritative, Redis carries transient queue state, and MinIO is reserved for artifacts. Traefik is the only public ingress in production.

Every tenant-owned query must derive organization context from an authenticated membership, never solely from a request body. Queue payloads include organization identity, but workers must re-authorize it against persisted scan state before execution. Object keys and caches must be tenant-prefixed.

Scanner adapters and engines will live behind versioned contracts; none are enabled yet. The worker fails closed rather than returning a successful scan without mandatory analysis.
