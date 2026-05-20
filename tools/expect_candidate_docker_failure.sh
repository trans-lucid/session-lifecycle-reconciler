#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/candidate"

if [ ! -d node_modules ]; then
  npm ci
fi

cleanup() {
  docker compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose config >/tmp/session-lifecycle-compose-config.txt
docker compose up -d
npm run migrate
npm run seed

set +e
OUTPUT="$(npm run test:integration 2>&1)"
STATUS=$?
set -e

printf '%s\n' "$OUTPUT"

if [ "$STATUS" -eq 0 ]; then
  echo "expected candidate starter to fail Docker-backed integration, but it passed" >&2
  exit 1
fi

if ! grep -Eq "runtime_overrides_revocation|duplicate_active_session|missing_audit_reason" <<<"$OUTPUT"; then
  echo "candidate Docker integration failed, but not for an expected marker" >&2
  exit 1
fi

echo "candidate Docker integration failed for expected marker"
npm run migrate
npm run seed
EVAL_TARGET="$ROOT/solution" npm run test:integration
echo "solution Docker integration passed"
