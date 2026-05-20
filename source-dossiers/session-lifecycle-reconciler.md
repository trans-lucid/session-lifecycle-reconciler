# Source Dossier: Session Lifecycle Reconciler

This template uses public sources only as architecture references. The candidate code, fixtures, tests, hidden evaluator, and rubrics are original Translucid-owned material.

## Sources Studied

- Auth.js / NextAuth: modern session/auth architecture, callbacks, and route guard vocabulary.
- Keycloak: local identity-provider simulator shape, OIDC token introspection, and authorization terminology.
- Supabase local auth: local auth + Postgres stack as an optional future variant.
- Ory Kratos: API-first identity concepts, recovery/verification flows, and admin/user separation.
- Docker Compose/Testcontainers-style local testing: disposable Postgres/Redis/identity-service validation.

## Allowed Reuse

- Architecture concepts such as token introspection, runtime session cache, app session rows, org memberships, route guards, and audit logs.
- Generic identity-provider terminology and standard OIDC-style request shapes.
- Local emulator patterns and service readiness behavior.

## Forbidden

- Copying source code from Auth.js, Keycloak, Supabase, Ory, or customer repositories.
- Copying customer identity schemas, production config, secrets, or real user/session data.
- Requiring live IdP credentials, cloud auth services, or production tenant access.
- Turning a connected startup repo into the generated challenge repo unless source-slice mode is explicitly approved.
