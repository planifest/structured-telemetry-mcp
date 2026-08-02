#!/usr/bin/env bash
# Tests for feature 0000018 req-003: orchestrator checks the telemetry
# failure marker at phase-start checkpoints and surfaces an interactive
# block-or-proceed question once per distinct root cause per run (ADR-002).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
ORCHESTRATOR="$FRAMEWORK/skills/planifest-orchestrator/SKILL.md"

grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

TELEMETRY_SECTION=$(sed -n '/^## Telemetry/,$p' "$ORCHESTRATOR")

echo ""
echo "=== req-003: marker-check step defined ==="

assert_contains "plan/.telemetry-failures" "$TELEMETRY_SECTION" \
  "req-003: references the marker location"
assert_contains "start of every phase" "$TELEMETRY_SECTION" \
  "req-003: check happens at the start of every phase"
assert_contains "root_cause_key" "$TELEMETRY_SECTION" \
  "req-003: references root_cause_key for identifying distinct failures"

echo ""
echo "=== req-003: interactive block-or-proceed question ==="

assert_contains "Block until resolved, or proceed without telemetry" "$TELEMETRY_SECTION" \
  "req-003: block-or-proceed question text present"

echo ""
echo "=== req-003: once-per-root-cause-per-run + build-log recording ==="

assert_contains "never re-ask for the same" "$TELEMETRY_SECTION" \
  "req-003: never re-asks for the same root cause"
assert_contains "build-log.md" "$TELEMETRY_SECTION" \
  "req-003: records the human's answer in build-log.md"
assert_contains "Delete the marker file once acknowledged" "$TELEMETRY_SECTION" \
  "req-003: marker cleared after acknowledgment"

echo ""
echo "=== req-003: agent-driven failure path (no marker needed) ==="

assert_contains "stop immediately, state the exact error" "$TELEMETRY_SECTION" \
  "req-003: agent-driven emission failure stops immediately inline"

echo ""
echo "=== req-003: unified signal reference (ADR-001 consistency) ==="

assert_contains "Unified signal" "$TELEMETRY_SECTION" \
  "req-003: references the unified telemetry signal"

print_summary
