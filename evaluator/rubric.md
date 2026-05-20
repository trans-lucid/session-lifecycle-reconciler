# Evaluator Rubric

Total: 100 points

- Session lifecycle state machine correctness: 20
- DB/runtime divergence repair: 20
- Duplicate login idempotency and replay safety: 15
- Organization membership enforcement at request time: 20
- Expired-session sweeping with audit evidence: 15
- Code quality and simulator discipline: 10

Major deductions:

- Trusting Redis when Postgres says revoked or missing.
- Allowing stale organization membership to authorize a route.
- Creating duplicate active sessions for the same login event.
- Sweeping high-risk sessions without audit reason.
- Bypassing Postgres, Redis, or the token simulator in integration behavior.

