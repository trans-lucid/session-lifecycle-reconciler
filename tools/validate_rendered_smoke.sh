#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$ROOT/generated/main" ] || [ ! -d "$ROOT/generated/solution" ]; then
  python3 "$ROOT/tools/render_template.py"
fi

python3 "$ROOT/tools/scan_safety.py" "$ROOT/generated/main"

cd "$ROOT/generated/main"
npm ci
set +e
MAIN_OUTPUT="$(npm run test:unit 2>&1)"
MAIN_STATUS=$?
set -e
printf '%s\n' "$MAIN_OUTPUT"
if [ "$MAIN_STATUS" -eq 0 ]; then
  echo "rendered main unexpectedly passed starter public unit tests" >&2
  exit 1
fi
for expected in runtime_overrides_revocation duplicate_active_session stale_org_access_allowed missing_audit_reason; do
  if ! grep -q "$expected" <<<"$MAIN_OUTPUT"; then
    echo "rendered main failed without expected marker: $expected" >&2
    exit 1
  fi
done

cd "$ROOT/generated/solution"
npm ci
EVAL_TARGET="$PWD/solution" npx vitest run --config vitest.config.ts tests/public/unit.test.ts solution/tests/*.test.ts evaluator/tests_hidden/*.test.ts

echo "rendered smoke validation passed"
