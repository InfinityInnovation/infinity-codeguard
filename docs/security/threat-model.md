# Initial threat model

Protected assets include source code, findings, credentials, artifacts, tenant metadata, and audit history. Main trust boundaries are browser/API, API/database, API/Redis, worker/repository, and services/object storage.

Current controls include Argon2id password hashes, opaque hashed session tokens, expiry and revocation checks, HttpOnly strict cookies, same-origin enforcement for browser state changes, Redis-backed authentication throttling with pseudonymized network identifiers, server-side membership lookup, authentication audit events, security headers, validated environment and queue input, explicit relational constraints, internal data networks, non-root application images, and fail-closed scan jobs.

Open risks: synchronizer-token CSRF defense for deployments that require cross-site cookies, account-aware and adaptive throttling, MFA, token rotation, fine-grained permission guards, complete audit coverage, encryption key management, scanner isolation, egress filtering, artifact malware handling, backup validation, and end-to-end telemetry. Do not expose this foundation to hostile repositories or the public internet until those controls are implemented and reviewed.
