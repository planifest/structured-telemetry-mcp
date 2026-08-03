#!/usr/bin/env bash
# Tests for feature 0000025, req-001: ship-agent PR footer default-off,
# opt-in via planifest-overrides/instructions/ (ADR-001).
#
# planifest-ship-agent/SKILL.md is a prose/template skill file, not
# executable code — these are content-assertion tests against the actual
# SKILL.md text (P9 Step 10), following the same sed/grep pattern used by
# test-0000018-req-007-discovery-md-hard-limit.sh.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
SHIP_SKILL="$FRAMEWORK/skills/planifest-ship-agent/SKILL.md"

FOOTER='🤖 Generated with [Planifest](https://github.com/planifest/framework) + Claude'

grep_has() { grep -qF "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

# Isolate Step 10 (from its heading to the next "### " heading).
STEP10=$(sed -n '/^### Step 10 — Push\/PR decision/,/^### Step 11/p' "$SHIP_SKILL")

# ── AC: preamble scans planifest-overrides/instructions/ for the ADR-001
#        keyword, mirroring the existing local-git-only scan ──────────────

echo ""
echo "=== req-001: Step 10 preamble scans for restore-pr-attribution opt-in ==="

PREAMBLE=$(printf '%s\n' "$STEP10" | sed -n '1,/^Otherwise, ask the human/p')
assert_contains "planifest-overrides/instructions/" "$PREAMBLE" \
  "req-001: preamble references planifest-overrides/instructions/ for the new scan"
assert_contains "restore-pr-attribution" "$PREAMBLE" \
  "req-001: preamble scans for the exact ADR-001 keyword 'restore-pr-attribution'"
assert_contains "local-git-only" "$PREAMBLE" \
  "req-001: pre-existing local-git-only scan is still present (unchanged)"

# ── AC: Option [2] template's fenced markdown block no longer ends with an
#        unconditional bare footer line ─────────────────────────────────────

echo ""
echo "=== req-001: Option [2] template footer is not unconditional ==="

OPT2_BLOCK=$(printf '%s\n' "$STEP10" | sed -n '/^```markdown$/,/^```$/p')
LAST_CONTENT_LINE=$(printf '%s\n' "$OPT2_BLOCK" | sed '/^```/d' | sed -e :a -e '/^\s*$/{$d;N;ba' -e '}' | tail -n 1)

assert_equals "no" "$([ "$LAST_CONTENT_LINE" = "$FOOTER" ] && echo yes || echo no)" \
  "req-001: fenced template's last line is NOT the bare unconditional footer"
assert_contains "restore-pr-attribution" "$LAST_CONTENT_LINE" \
  "req-001: the line that mentions the footer is gated on the restore-pr-attribution keyword"
assert_contains "$FOOTER" "$OPT2_BLOCK" \
  "req-001: the footer text itself is still documented (as the conditional opt-in payload)"

# ── AC: with no matching override, either delivery path is footer-free by
#        default — Option [1] shares the same template body as Option [2] ──

echo ""
echo "=== req-001: Option [1] shares the (now conditional) template ==="

OPT1_BLOCK=$(printf '%s\n' "$STEP10" | sed -n '/Option \[1\] — Agent pushes/,/Option \[2\] — Human pushes/p')
assert_contains "PR description — see template below" "$OPT1_BLOCK" \
  "req-001: Option [1]'s gh pr create --body still defers to the shared template"
assert_equals "no" "$(grep_has "$FOOTER" <(echo "$OPT1_BLOCK"))" \
  "req-001: Option [1]'s own code block does not hardcode the footer separately"

# ── AC: other template sections are unchanged in content/order ─────────────

echo ""
echo "=== req-001: other Step 10 template sections unchanged ==="

ORDER=$(printf '%s\n' "$OPT2_BLOCK" | grep -n '^## ' | sed 's/:.*##/ ##/' | tr -d '\n')
assert_contains "## Summary" "$ORDER" "req-001: Summary section present"
assert_contains "## Key Decisions" "$ORDER" "req-001: Key Decisions section present"
assert_contains "## Security" "$ORDER" "req-001: Security section present"
assert_contains "## Skipped Phases" "$ORDER" "req-001: Skipped Phases section present"
assert_contains "## Test Plan" "$ORDER" "req-001: Test Plan section present"

SUMMARY_LINE=$(printf '%s\n' "$OPT2_BLOCK" | grep -n '^## ' | grep -n '.' | head -n1)
FIRST_HEADER=$(printf '%s\n' "$OPT2_BLOCK" | grep '^## ' | head -n1)
LAST_HEADER=$(printf '%s\n' "$OPT2_BLOCK" | grep '^## ' | tail -n1)
assert_equals "## Summary" "$FIRST_HEADER" "req-001: Summary is still the first section"
assert_equals "## Test Plan" "$LAST_HEADER" "req-001: Test Plan is still the last named section (footer note trails it)"

print_summary
