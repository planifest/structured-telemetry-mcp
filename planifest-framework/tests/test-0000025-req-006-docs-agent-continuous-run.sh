#!/usr/bin/env bash
# Tests for feature 0000025, req-006: docs-agent continuous_run respect.
#
# Confirms:
#   1. planifest-docs-agent/SKILL.md's P6 Gate B checks continuous_run /
#      plan/.run-mode before stopping for confirmation.
#   2. In continuous-run mode, Gate B logs its assessment as a statement
#      (not a question) and proceeds automatically, and records the
#      auto-accepted decision in the P6 build log block.
#   3. In non-continuous-run mode, Gate B's existing stop-and-confirm
#      behavior (the "Confirm? (proceed / skip docs update / update
#      different docs)" prompt) is unchanged.
#   4. The audit named by req-006 (planifest-spec-agent, planifest-adr-agent,
#      planifest-codegen-agent, and other .claude/skills/planifest-* skills)
#      found no other instance of a skill-internal gate ignoring
#      continuous_run — those three skill files are therefore untouched by
#      this fix. This test asserts they still contain no such gate, so a
#      future regression that introduces one is caught.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"

DOCS_SKILL="$FRAMEWORK/skills/planifest-docs-agent/SKILL.md"
SPEC_SKILL="$FRAMEWORK/skills/planifest-spec-agent/SKILL.md"
ADR_SKILL="$FRAMEWORK/skills/planifest-adr-agent/SKILL.md"
CODEGEN_SKILL="$FRAMEWORK/skills/planifest-codegen-agent/SKILL.md"

grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }
grep_has_e() { grep -qE "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

echo ""
echo "=== req-006: docs-agent Gate B checks continuous_run before stopping ==="

assert_equals "yes" "$(grep_has 'Check .continuous_run. / .plan/.run-mode. before deciding' "$DOCS_SKILL")" \
  "req-006: Gate B checks continuous_run / plan/.run-mode before deciding how to present the assessment"

echo ""
echo "=== req-006: continuous-run mode logs a statement and auto-proceeds ==="

assert_equals "yes" "$(grep_has 'When .continuous_run. is active' "$DOCS_SKILL")" \
  "req-006: Gate B has a continuous_run-active branch"
assert_equals "yes" "$(grep_has 'log the assessment and recommendation as a statement, not a question, and proceed automatically' "$DOCS_SKILL")" \
  "req-006: continuous_run-active branch states instead of asks and proceeds without stopping"
assert_equals "yes" "$(grep_has 'docs update assessment (continuous run, auto-accepted)' "$DOCS_SKILL")" \
  "req-006: continuous_run-active branch uses an auto-accepted log format"
assert_equals "yes" "$(grep_has 'Record the auto-accepted decision in the P6 build log block' "$DOCS_SKILL")" \
  "req-006: auto-accepted decision is recorded in the P6 build log block"

echo ""
echo "=== req-006: non-continuous-run mode is unchanged (still stops and confirms) ==="

assert_equals "yes" "$(grep_has 'When .continuous_run. is not active' "$DOCS_SKILL")" \
  "req-006: Gate B has a continuous_run-inactive branch"
assert_equals "yes" "$(grep_has 'Confirm? (proceed / skip docs update / update different docs)' "$DOCS_SKILL")" \
  "req-006: non-continuous-run branch retains the original Confirm? prompt"
assert_equals "yes" "$(grep_has 'Wait for the human to confirm before proceeding. Record the confirmed decision in the P6 build log block.' "$DOCS_SKILL")" \
  "req-006: non-continuous-run branch retains the original wait-and-record behavior"

echo ""
echo "=== req-006: audit — no equivalent gate found in spec-agent, adr-agent, codegen-agent ==="

assert_equals "no" "$(grep_has_e 'Confirm\?|Proceed\?' "$SPEC_SKILL")" \
  "req-006 audit: spec-agent has no Confirm?/Proceed? skill-internal gate"
assert_equals "no" "$(grep_has_e 'Confirm\?|Proceed\?' "$ADR_SKILL")" \
  "req-006 audit: adr-agent has no Confirm?/Proceed? skill-internal gate"
assert_equals "no" "$(grep_has_e 'Confirm\?|Proceed\?' "$CODEGEN_SKILL")" \
  "req-006 audit: codegen-agent has no Confirm?/Proceed? skill-internal gate"

print_summary
