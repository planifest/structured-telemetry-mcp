#!/usr/bin/env bash
# Tests for feature 0000023-framework-pipeline-fixes, req-001:
# restore continuous_run exception for P1/P2/P3 STOP rules.
#
# Covers: the Phase Invocation Table's P1/P2/P3 rows used to hardcode
# "No exception", silently overriding continuous_run (regression introduced
# in commit 42ae808, feature 0000021 — see ADR-001). P4-P6/P9 must remain
# untouched.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

SKILL="$SCRIPT_DIR/../skills/planifest-orchestrator/SKILL.md"

if [ ! -f "$SKILL" ]; then
  echo "  FAIL: $SKILL not found"
  ((FAIL++)) || true
  print_summary
fi

CONTENT=$(cat "$SKILL")

echo ""
echo "=== req-001: P1/P2/P3 honor continuous_run ==="

assert_contains "STOP, present requirement count/scope decisions/deferred items. Exception: \`continuous_run: true\` was set at P0." \
  "$CONTENT" "req-001: P1 Requirements row has the continuous_run exception"

assert_contains "STOP, present ADR list with one-line summaries. Exception: \`continuous_run: true\` was set at P0." \
  "$CONTENT" "req-001: P2 Architecture Decisions row has the continuous_run exception"

assert_contains "STOP, present components built/tests produced/deviations. Exception: \`continuous_run: true\` was set at P0." \
  "$CONTENT" "req-001: P3 Code Generation row has the continuous_run exception"

echo ""
echo "=== req-001: P4-P6/P9 unchanged ==="

assert_contains "Exception: proceed without confirmation if all checks passed first-attempt with zero self-corrections." \
  "$CONTENT" "req-001: P4 Validate row unchanged"

assert_contains "Exception: proceed without confirmation if risk is Low with zero critical/high/medium findings." \
  "$CONTENT" "req-001: P5 Security row unchanged"

assert_contains "Exception: proceed without confirmation if zero drift and all expected artifacts present." \
  "$CONTENT" "req-001: P6 Documentation row unchanged"

echo ""
echo "=== req-001: no stray 'No exception' left in the Phase Invocation Table ==="

TABLE_SECTION=$(printf '%s\n' "$CONTENT" | sed -n '/## Phase Invocation Table/,/^## /p')
if [[ "$TABLE_SECTION" == *"No exception"* ]]; then
  echo "  FAIL: req-001: 'No exception' still present in the Phase Invocation Table"
  ((FAIL++)) || true
else
  echo "  PASS: req-001: 'No exception' fully removed from the Phase Invocation Table"
  ((PASS++)) || true
fi

print_summary
