#!/usr/bin/env bash
# Tests for feature 0000017 req-007: change-agent archive step, ship-agent
# cross-reference check, and the 10th orchestrator Hard Limit (backlog 0000011).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
CHANGE_AGENT="$FRAMEWORK/skills/planifest-change-agent/SKILL.md"
SHIP_AGENT="$FRAMEWORK/skills/planifest-ship-agent/SKILL.md"
ORCHESTRATOR="$FRAMEWORK/skills/planifest-orchestrator/SKILL.md"

grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

# ── AC-1: change-agent has a Phase 6 - Archive step ──────────────────────────

echo ""
echo "=== req-007: change-agent Phase 6 - Archive ==="

assert_equals "yes" "$(grep_has "### Phase 6 - Archive" "$CHANGE_AGENT")" \
  "req-007: change-agent has Phase 6 - Archive section"

CA_ARCHIVE=$(sed -n '/### Phase 6 - Archive/,/## New Component Handoff/p' "$CHANGE_AGENT")
assert_contains "Copy-then-delete" "$CA_ARCHIVE" \
  "req-007: change-agent uses copy-then-delete pattern"
assert_contains "plan/_archive/{feature-id}-{YYYY-MM-DD}/" "$CA_ARCHIVE" \
  "req-007: change-agent archives to plan/_archive/"
assert_contains "Confirm the copy is complete before proceeding" "$CA_ARCHIVE" \
  "req-007: change-agent confirms copy before delete"
assert_contains "plan/.orchestrator-active" "$CA_ARCHIVE" \
  "req-007: change-agent removes the sentinel last"

# ── AC-2: change-agent archive step includes the cross-reference check ───────

echo ""
echo "=== req-007: change-agent cross-reference check ==="

assert_contains "Cross-reference check" "$CA_ARCHIVE" \
  "req-007: change-agent has cross-reference check"
assert_contains "same commit" "$CA_ARCHIVE" \
  "req-007: change-agent updates links in the same commit as the move"

# ── AC-3: ship-agent P7 Step 6 has the same cross-reference check ────────────

echo ""
echo "=== req-007: ship-agent cross-reference check ==="

SA_STEP6=$(sed -n '/### Step 6 — Archive/,/### Step 6b/p' "$SHIP_AGENT")
assert_contains "Cross-reference check" "$SA_STEP6" \
  "req-007: ship-agent Step 6 has cross-reference check"
assert_contains "decisions-index.md" "$SA_STEP6" \
  "req-007: ship-agent check names decisions-index.md ADR links"

# ── AC-4: 10th orchestrator Hard Limit mandating archiving on both routes ────

echo ""
echo "=== req-007: 10th Hard Limit ==="

HL=$(sed -n '/^## Hard Limits/,/^---/p' "$ORCHESTRATOR")
assert_contains "10." "$HL" \
  "req-007: Hard Limits list has a 10th entry"
assert_contains "Every pipeline route archives its working folder" "$HL" \
  "req-007: 10th Hard Limit mandates archiving for every route"
assert_contains "Change Pipeline (change-agent Phase 6 - Archive)" "$HL" \
  "req-007: 10th Hard Limit names the Change Pipeline route"

print_summary
