#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/.."
EVAL_TARGET="${EVAL_TARGET:-$PWD/solution}" ./candidate/node_modules/.bin/vitest run evaluator/tests_hidden --config candidate/vitest.config.ts

