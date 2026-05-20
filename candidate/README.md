# Session Lifecycle Reconciler

You are inheriting a SaaS auth/session backend where runtime session cache, database session truth, organization membership, and route access decisions can drift.

Repair duplicate login idempotency, DB/runtime divergence, revoked-session enforcement, membership checks, expired-session sweeping, and support/security audit reporting.

## Local Services

```txt
Keycloak-compatible simulator  local OIDC token issue/introspection
Postgres                       app sessions, memberships, audit log
Redis                          runtime session cache
```

No real identity provider, cloud credentials, or customer data are needed.

## Time Budget

- Setup: about 5-10 minutes after Docker images are available.
- Coding: about 70-95 minutes for the standard challenge.
- Staff variant: up to 120 minutes with stricter race, high-risk audit, and drift cases.

## Commands

```bash
make dev
make seed
make test
make test-integration
make run
make clean
```

Private tests use harder session drift, revoked DB truth, stale org membership, duplicate callback, high-risk expiry, and request-context cases. Do not hardcode fixture IDs or bypass the local simulator.
