#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/candidate"

if [ ! -d node_modules ]; then
  npm ci
fi

set +e
OUTPUT="$(npm run test:unit 2>&1)"
STATUS=$?
set -e

printf '%s\n' "$OUTPUT"

if [ "$STATUS" -eq 0 ]; then
  echo "expected candidate starter to fail public unit tests, but it passed" >&2
  exit 1
fi

for expected in runtime_overrides_revocation duplicate_active_session stale_org_access_allowed missing_audit_reason; do
  if ! grep -q "$expected" <<<"$OUTPUT"; then
    echo "candidate starter failed, but did not include expected marker: $expected" >&2
    exit 1
  fi
done

echo "candidate starter failed public unit tests for expected markers"
