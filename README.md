# Session Lifecycle Reconciler

This is an internal Translucid challenge template, not a generated candidate repo.

The template generates a production-shaped SaaS auth/session backend challenge. It focuses on drift between identity-provider tokens, runtime session cache, app database sessions, organization membership, route access decisions, and support/security audit trails.

The generated candidate repo intentionally contains flawed starter code. Candidates must repair session lifecycle state, DB/runtime divergence, duplicate login idempotency, org membership checks, expired-session sweeping, and audit reporting.

## Local Simulator

Validation uses local services only:

- Keycloak-compatible local OIDC simulator for login/introspection tokens.
- Postgres for app users, sessions, org memberships, and audit logs.
- Redis for runtime session cache.

No external credentials, cloud identity provider, customer data, or startup source code are required.

## Time Budget

- Expected candidate coding time: 70-95 minutes for senior backend/full-stack candidates.
- Staff variant: up to 120 minutes with stricter race and high-risk audit cases.
- Setup time after cached images: under 10 minutes on a normal laptop.
- Docker image pull cost: Postgres, Redis, and Node Alpine for the Keycloak-compatible simulator.

## Validation

```bash
make validate-solution
make validate-candidate-main-expected-failure
make render
make scan-safety
make validate-rendered-smoke
make validate-docker-integration
make validate
```

Expected starter failure markers:

- `runtime_overrides_revocation`
- `duplicate_active_session`
- `stale_org_access_allowed`
- `missing_audit_reason`

## For Challenge Creation Agents

Do not infer how to use this template from README prose.

Read `translucid-template.json`.

Normal use:

```bash
make render
make scan-safety
make validate-solution
make validate-candidate-main-expected-failure
make validate-docker-integration
```

Use:

- `generated/main` as candidate-facing main branch
- `generated/solution` as private solution/evaluator branch

Do not manually copy `candidate/` to root.
Do not manually restructure `solution/`.
Do not edit hidden tests or evaluator imports unless a validation command fails and the exact blocker is recorded.

