#!/usr/bin/env bash
# Tests for feature 0000023-framework-pipeline-fixes, req-002:
# marker commit lifecycle (creation-side: backlog 0000030; deletion-side:
# backlog 0000028).
#
# Covers: session markers (plan/.orchestrator-active, plan/.orchestrator-ack,
# plan/.run-mode) must be committed at the point they are written (P0), and
# their deletion at P7 must be staged atomically with the archive commit,
# plus a P9 pre-flight backstop check.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

ORCHESTRATOR="$SCRIPT_DIR/../skills/planifest-orchestrator/SKILL.md"
SHIP_AGENT="$SCRIPT_DIR/../skills/planifest-ship-agent/SKILL.md"

for f in "$ORCHESTRATOR" "$SHIP_AGENT"; do
  if [ ! -f "$f" ]; then
    echo "  FAIL: $f not found"
    ((FAIL++)) || true
    print_summary
  fi
done

ORCH_CONTENT=$(cat "$ORCHESTRATOR")
SHIP_CONTENT=$(cat "$SHIP_AGENT")

echo ""
echo "=== req-002: creation-side commit instructions (orchestrator P0) ==="

assert_contains "Write the sentinel" "$ORCH_CONTENT" \
  "req-002: Step 1 (write the sentinel) still present"
assert_contains "Include this file in the P0 commit." "$ORCH_CONTENT" \
  "req-002: .orchestrator-active commit instruction present"

assert_contains "Write strict-mode ack" "$ORCH_CONTENT" \
  "req-002: Step 5 (write strict-mode ack) still present"
assert_contains "include \`plan/.orchestrator-ack\` in the P0 commit" "$ORCH_CONTENT" \
  "req-002: .orchestrator-ack commit instruction present"

echo ""
echo "=== req-002: deletion-side atomic commit (ship-agent P7) ==="

assert_contains "git add plan/_archive/ plan/changelog/ docs/about.md plan/.orchestrator-active plan/.orchestrator-ack plan/.run-mode" \
  "$SHIP_CONTENT" "req-002: P7 Step 7 git add stages all three markers atomically"

echo ""
echo "=== req-002: P9 pre-flight backstop check ==="

assert_contains "git ls-files plan/.orchestrator-active plan/.orchestrator-ack plan/.run-mode" \
  "$SHIP_CONTENT" "req-002: P9 pre-flight check runs git ls-files against all three markers"

assert_contains "Marker tracking pre-flight check" "$SHIP_CONTENT" \
  "req-002: P9 pre-flight check section exists"

print_summary
