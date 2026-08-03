#!/usr/bin/env bash
# Tests for feature 0000025, req-003: subagent parallelism expansion
# (validate-agent + agent-dispatch-standards.md portion).
#
# Confirms:
#   1. agent-dispatch-standards.md's MUST-parallelise table gains rows for
#      (a) independent new-test-file authoring closing a coverage gap and
#      (b) independent living-doc edits with no shared content.
#   2. planifest-validate-agent/SKILL.md's Parallelism Directive table gains
#      a MUST-parallelise row for 2+ independent new test files closing a
#      coverage gap.
#   3. None of the pre-existing MUST/Cannot-parallelise rows were removed.
#
# Does not cover planifest-docs-agent/SKILL.md (P6 living-docs row) — that
# portion of req-003 is implemented by a separate concurrent change.
#
# Checks the canonical tracked skill source (planifest-framework/skills/),
# not the gitignored .claude/skills/ runtime sync copy.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"

STANDARDS="$FRAMEWORK/standards/agent-dispatch-standards.md"
VALIDATE_SKILL="$FRAMEWORK/skills/planifest-validate-agent/SKILL.md"

grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

echo ""
echo "=== req-003: agent-dispatch-standards.md gains new-test-file pattern ==="

assert_equals "yes" "$(grep_has 'Independent new test files closing a coverage gap' "$STANDARDS")" \
  "req-003: MUST-parallelise table names independent new-test-file authoring"
assert_equals "yes" "$(grep_has 'non-cross-referencing sections' "$STANDARDS")" \
  "req-003: new-test-file row cites the independent, non-cross-referencing pattern"

echo ""
echo "=== req-003: agent-dispatch-standards.md gains living-doc-edit pattern ==="

assert_equals "yes" "$(grep_has 'Independent living-doc edits' "$STANDARDS")" \
  "req-003: MUST-parallelise table names independent living-doc edits"
assert_equals "yes" "$(grep_has 'no shared content' "$STANDARDS")" \
  "req-003: living-doc row cites the no-shared-content pattern"

echo ""
echo "=== req-003: agent-dispatch-standards.md retains existing MUST/Cannot rows ==="

assert_equals "yes" "$(grep_has 'Multiple independent codebase searches' "$STANDARDS")" \
  "req-003: pre-existing MUST-parallelise row (codebase searches) still present"
assert_equals "yes" "$(grep_has 'Independent requirement files (no cross-references)' "$STANDARDS")" \
  "req-003: pre-existing MUST-parallelise row (requirement files) still present"
assert_equals "yes" "$(grep_has 'Phase N work before Phase N-1 artifacts exist' "$STANDARDS")" \
  "req-003: pre-existing Cannot-parallelise row (phase sequencing) still present"
assert_equals "yes" "$(grep_has 'ADR writing before requirements are complete' "$STANDARDS")" \
  "req-003: pre-existing Cannot-parallelise row (ADR sequencing) still present"

echo ""
echo "=== req-003: validate-agent SKILL.md Parallelism Directive gains coverage-gap row ==="

assert_equals "yes" "$(grep_has '2+ independent new test files closing a coverage gap' "$VALIDATE_SKILL")" \
  "req-003: validate-agent Parallelism Directive table names new-test-file coverage-gap closure"

echo ""
echo "=== req-003: validate-agent SKILL.md retains existing Parallelism Directive rows ==="

assert_equals "yes" "$(grep_has 'Lint + typecheck (no shared state)' "$VALIDATE_SKILL")" \
  "req-003: pre-existing MUST-parallelise row (lint+typecheck) still present"
assert_equals "yes" "$(grep_has 'Library audit + semantic correctness check' "$VALIDATE_SKILL")" \
  "req-003: pre-existing MUST-parallelise row (library audit) still present"
assert_equals "yes" "$(grep_has 'Independent component test suites' "$VALIDATE_SKILL")" \
  "req-003: pre-existing MUST-parallelise row (component test suites) still present"
assert_equals "yes" "$(grep_has 'Test before typecheck passes' "$VALIDATE_SKILL")" \
  "req-003: pre-existing Cannot-parallelise row (test-before-typecheck) still present"
assert_equals "yes" "$(grep_has 'Build before tests pass' "$VALIDATE_SKILL")" \
  "req-003: pre-existing Cannot-parallelise row (build-before-tests) still present"
assert_equals "yes" "$(grep_has 'Self-correct cycle N+1 before N' "$VALIDATE_SKILL")" \
  "req-003: pre-existing Cannot-parallelise row (self-correct ordering) still present"

echo ""
echo "=== req-003: hard sequencing unchanged ==="

assert_equals "yes" "$(grep_has 'Batch 1 (parallel): lint + typecheck' "$VALIDATE_SKILL")" \
  "req-003: existing P4 dispatch order (lint+typecheck before test before build) unchanged"

print_summary
