#!/usr/bin/env bash
# Tests for feature 0000018 req-007: discovery.md elevated to Hard Limit status
# in planifest-orchestrator/SKILL.md (self-audit finding, ADR-003).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
ORCHESTRATOR="$FRAMEWORK/skills/planifest-orchestrator/SKILL.md"

grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

# ── AC-1: new Hard Limit entry, matching build-log.md's pattern ─────────────

echo ""
echo "=== req-007: discovery.md Hard Limit entry ==="

HL=$(sed -n '/^## Hard Limits/,/^---/p' "$ORCHESTRATOR")
assert_contains "11." "$HL" \
  "req-007: Hard Limits list has an 11th entry"
assert_contains "discovery.md" "$HL" \
  "req-007: 11th Hard Limit names discovery.md"
assert_contains "pipeline error" "$HL" \
  "req-007: 11th Hard Limit uses 'pipeline error' teeth, matching Hard Limit 8's pattern"
assert_contains "stop and write it before proceeding" "$HL" \
  "req-007: 11th Hard Limit uses the exact 'stop and write it before proceeding' phrase from Hard Limit 8"

# ── AC-2: step 3d cross-references the new Hard Limit ────────────────────────

echo ""
echo "=== req-007: step 3d cross-reference ==="

STEP_3D=$(grep "3d\." "$ORCHESTRATOR")
assert_contains "Hard Limit 11" "$STEP_3D" \
  "req-007: step 3d cross-references Hard Limit 11 by number"

# ── AC-3: Gate Checklist has a discovery.md item ─────────────────────────────

echo ""
echo "=== req-007: Gate Checklist item ==="

GATE=$(sed -n '/### Phase 0 → Phase 1 Gate Checklist/,/^$/p' "$ORCHESTRATOR")
GATE=$(sed -n '/### Phase 0 → Phase 1 Gate Checklist/,/^## /p' "$ORCHESTRATOR")
assert_contains "discovery.md" "$GATE" \
  "req-007: Gate Checklist has a discovery.md item"
assert_contains "Hard Limit 11" "$GATE" \
  "req-007: Gate Checklist item cross-references Hard Limit 11"

print_summary
