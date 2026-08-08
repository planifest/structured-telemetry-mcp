#!/usr/bin/env bash
# Tests for feature 0000025, req-003: subagent parallelism expansion
# (planifest-docs-agent/SKILL.md portion only).
#
# Confirms:
#   1. planifest-docs-agent/SKILL.md's Parallelism Directive table gains a
#      MUST-parallelise row for 2+ independent living-doc updates (no shared
#      content dependency) — per the P6 worked example in
#      plan/backlog/0000036-expand-subagent-parallelism-for-speed/entry.md
#      (component-registry.md / decisions-index.md / architecture-overview.md
#      edited serially in a prior run when they should have been parallel).
#   2. None of the pre-existing MUST/Cannot-parallelise rows were removed.
#
# Does not cover planifest-validate-agent/SKILL.md or
# planifest-framework/standards/agent-dispatch-standards.md — that portion of
# req-003 is implemented by a separate concurrent change and covered by
# test-0000025-req-003-subagent-parallelism-expansion.sh.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"

DOCS_SKILL="$FRAMEWORK/skills/planifest-docs-agent/SKILL.md"

grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

echo ""
echo "=== req-003: docs-agent SKILL.md gains living-doc-edit parallelism row ==="

assert_equals "yes" "$(grep_has '2+ independent living-doc updates (no shared content dependency)' "$DOCS_SKILL")" \
  "req-003: docs-agent Parallelism Directive table names independent living-doc updates as MUST-parallelise"

assert_equals "yes" "$(grep_has 'component-registry.md' "$DOCS_SKILL")" \
  "req-003: docs-agent living-doc row cites a concrete mandatory living doc (component-registry.md)"

assert_equals "yes" "$(grep_has 'decisions-index.md' "$DOCS_SKILL")" \
  "req-003: docs-agent living-doc row cites a concrete mandatory living doc (decisions-index.md)"

echo ""
echo "=== req-003: docs-agent SKILL.md retains existing Parallelism Directive rows ==="

assert_equals "yes" "$(grep_has 'Per-component docs for independent components' "$DOCS_SKILL")" \
  "req-003: pre-existing MUST-parallelise row (per-component docs) still present"
assert_equals "yes" "$(grep_has 'Drift checks across independent areas' "$DOCS_SKILL")" \
  "req-003: pre-existing MUST-parallelise row (drift checks) still present"
assert_equals "yes" "$(grep_has 'Recommendations + iteration log (independent documents)' "$DOCS_SKILL")" \
  "req-003: pre-existing MUST-parallelise row (recommendations + iteration log) still present"
assert_equals "yes" "$(grep_has 'Dependency graph before all component dependency files exist' "$DOCS_SKILL")" \
  "req-003: pre-existing Cannot-parallelise row (dependency graph ordering) still present"
assert_equals "yes" "$(grep_has 'Component registry before all component purpose.md files exist' "$DOCS_SKILL")" \
  "req-003: pre-existing Cannot-parallelise row (component registry ordering) still present"
assert_equals "yes" "$(grep_has 'Consistency check before individual artifacts are written' "$DOCS_SKILL")" \
  "req-003: pre-existing Cannot-parallelise row (consistency check ordering) still present"

print_summary
