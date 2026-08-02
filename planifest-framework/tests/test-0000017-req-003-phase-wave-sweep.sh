#!/usr/bin/env bash
# Tests for feature 0000017 req-003: Phase/Wave terminology sweep.
# Verifies the sweep's stable outcomes: corrected decomposition-sense wording,
# the instance-by-instance report, and documented scope exclusions.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$FRAMEWORK/.." && pwd)"
TEMPLATES="$FRAMEWORK/templates"
REPORT="$PROJECT_ROOT/plan/current/req-003-phase-wave-sweep-report.md"

grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

# The report is a plan/current/ artifact — archived at P7. Skip the report
# assertions after archiving; the corrected files below remain testable forever.
REPORT_PRESENT="no"
[ -f "$REPORT" ] && REPORT_PRESENT="yes"

# ── AC: known decomposition-sense instances corrected to Wave ────────────────

echo ""
echo "=== req-003: corrected files use Wave, not Phase, in decomposition sense ==="

assert_equals "yes" "$(grep_has '### Waves' "$TEMPLATES/feature-brief-guide.md")" \
  "req-003: feature-brief-guide.md section header is Waves"
assert_equals "yes" "$(grep_has 'Wave 1 ships before Wave 2 begins' "$TEMPLATES/feature-brief-guide.md")" \
  "req-003: feature-brief-guide.md body uses Wave ordering"
assert_equals "yes" "$(grep_has 'deferred to Wave 2' "$TEMPLATES/scope-guide.md")" \
  "req-003: scope-guide.md deferred example uses Wave"

# no decomposition-sense stragglers anywhere in Planifest-authored framework files
STRAYS=$(grep -rl -i "if phased\|phase-{n}\|phase-2\.md\|phased feature" "$FRAMEWORK" --include="*.md" 2>/dev/null | grep -v external-skills || true)
assert_equals "" "$STRAYS" \
  "req-003: no decomposition-sense 'phased' wording remains in framework files"

# ── AC: pipeline-phase sense untouched ───────────────────────────────────────

echo ""
echo "=== req-003: pipeline-phase sense (P0-P9) preserved ==="

assert_equals "yes" "$(grep_has '## Phase 1 - Requirements' "$FRAMEWORK/skills/planifest-orchestrator/SKILL.md")" \
  "req-003: orchestrator P1 pipeline-phase heading untouched"

# ── AC: report lists every reviewed instance with disposition ────────────────

echo ""
echo "=== req-003: sweep report ==="

if [ "$REPORT_PRESENT" = "yes" ]; then
  assert_equals "yes" "$(grep_has "corrected" "$REPORT")" \
    "req-003: report records corrected instances"
  assert_equals "yes" "$(grep_has "correct-as-is" "$REPORT")" \
    "req-003: report records correct-as-is instances"
  assert_equals "yes" "$(grep_has "external-skills" "$REPORT")" \
    "req-003: report documents the external-skills exclusion"
  assert_equals "yes" "$(grep_has "plan/_archive/" "$REPORT")" \
    "req-003: report documents the archive exclusion"
else
  echo "  SKIP: req-003 report assertions — plan/current/ report already archived (post-P7 run)"
fi

print_summary
