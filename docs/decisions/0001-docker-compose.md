# ADR 0001: Docker Compose deployment

Status: accepted — 2026-10-22.

Infinity CodeGuard targets Docker Compose for local, self-hosted, production, and restricted-network installation. Kubernetes and Helm assets are excluded. Data services live on an internal network; Traefik is the production ingress. Scanner workloads must not receive the Docker socket or privileged mode. Stronger hostile-code isolation remains required before scanning untrusted repositories.
