# Initial threat model

Protected assets include source code, findings, credentials, artifacts, tenant metadata, and audit history. Main trust boundaries are browser/API, API/database, API/Redis, worker/repository, and services/object storage.

Current controls include Argon2id password hashes, opaque hashed session tokens, HttpOnly strict cookies, security headers, validated environment and queue input, explicit relational constraints, internal data networks, non-root application images, and fail-closed scan jobs.

Open risks: CSRF token defense beyond SameSite, rate limiting, MFA, token rotation, full permission guards, audit coverage, encryption key management, scanner isolation, egress filtering, artifact malware handling, backup validation, and end-to-end telemetry. Do not expose this foundation to hostile repositories or the public internet until those controls are implemented and reviewed.
