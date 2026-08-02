#!/usr/bin/env bash
# Tests for feature 0000018 req-005: build-log.template.md's per-phase block
# gains a Telemetry field, and every phase is required to fill it (no phase
# can complete with the field blank).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE="$FRAMEWORK/templates/build-log.template.md"
ORCHESTRATOR="$FRAMEWORK/skills/planifest-orchestrator/SKILL.md"

grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

# ── AC-1: template's phase block(s) include a Telemetry field ───────────────

echo ""
echo "=== req-005: build-log.template.md Telemetry field ==="

TELEMETRY_LINES=$(grep -c '| Telemetry |' "$TEMPLATE" 2>/dev/null || echo 0)
assert_equals "yes" "$([ "$TELEMETRY_LINES" -ge 2 ] && echo yes || echo no)" \
  "req-005: Telemetry field present in both the P0 block and the copy-template block"
assert_equals "yes" "$(grep_has 'emitted / failed-with-recorded-choice / confirmed-disabled' "$TEMPLATE")" \
  "req-005: Telemetry field documents all 3 states"

# ── AC-3: every phase must fill the field — no phase completes without it ───

echo ""
echo "=== req-005: orchestrator requires Telemetry to be filled every phase ==="

assert_equals "yes" "$(grep_has 'Every phase records a .Telemetry. line' "$ORCHESTRATOR")" \
  "req-005: orchestrator states every phase must record the Telemetry field"
assert_equals "yes" "$(grep_has 'not complete until this field is filled' "$ORCHESTRATOR")" \
  "req-005: orchestrator ties a blank Telemetry field to phase-block completeness"
assert_equals "yes" "$(grep_has 'confirmed-disabled' "$ORCHESTRATOR")" \
  "req-005: orchestrator names the confirmed-disabled state"

# ── AC-2: Summary section lets a human/build-assessment-agent audit gaps ────

echo ""
echo "=== req-005: Summary metric for auditing telemetry gaps ==="

assert_equals "yes" "$(grep_has 'Phases with a recorded telemetry gap' "$TEMPLATE")" \
  "req-005: template Summary section has a telemetry-gap audit metric"

print_summary
