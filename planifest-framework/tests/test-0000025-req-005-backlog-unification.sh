#!/usr/bin/env bash
# Tests for feature 0000025, req-005: backlog unification for deferred items.
#
# Confirms:
#   1. planifest-framework/templates/backlog-entry.template.md gains a
#      "Deferral source" field distinguishing discovered mid-flight /
#      deliberate scope decision / tech debt.
#   2. planifest-docs-agent/SKILL.md's recommendations.md generation step is
#      extended to also file each Deferred Items and Tech Debt row as its own
#      plan/backlog/{id}-{slug}/entry.md, tagged with Source feature/phase,
#      pointing back at the originating feature's docs instead of duplicating
#      rationale, using the existing highest-id+1 allocation convention, and
#      applying only going forward (no backfill of already-archived features).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"

TEMPLATE="$FRAMEWORK/templates/backlog-entry.template.md"
DOCS_SKILL="$FRAMEWORK/skills/planifest-docs-agent/SKILL.md"

grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

echo ""
echo "=== req-005: backlog-entry.template.md gains a Deferral source field ==="

assert_equals "yes" "$(grep_has '\*\*Deferral source:\*\*' "$TEMPLATE")" \
  "req-005: template has a Deferral source field"
assert_equals "yes" "$(grep_has 'discovered mid-flight' "$TEMPLATE")" \
  "req-005: template's Deferral source field names discovered mid-flight"
assert_equals "yes" "$(grep_has 'deliberate scope decision' "$TEMPLATE")" \
  "req-005: template's Deferral source field names deliberate scope decision"
assert_equals "yes" "$(grep_has 'tech debt' "$TEMPLATE")" \
  "req-005: template's Deferral source field names tech debt"

echo ""
echo "=== req-005: template retains pre-existing fields ==="

assert_equals "yes" "$(grep_has '\*\*Source feature:\*\*' "$TEMPLATE")" \
  "req-005: template still has Source feature field"
assert_equals "yes" "$(grep_has '\*\*Source phase:\*\*' "$TEMPLATE")" \
  "req-005: template still has Source phase field"
assert_equals "yes" "$(grep_has 'highest ever allocated' "$TEMPLATE")" \
  "req-005: template still documents the highest-id+1 allocation convention"

echo ""
echo "=== req-005: docs-agent SKILL.md files Deferred Items/Tech Debt rows to plan/backlog/ ==="

assert_equals "yes" "$(grep_has 'plan/backlog/{id}-{slug}/entry.md' "$DOCS_SKILL")" \
  "req-005: docs-agent rule names the plan/backlog/{id}-{slug}/entry.md target path"
assert_equals "yes" "$(grep_has 'Deferred Items and Tech Debt' "$DOCS_SKILL")" \
  "req-005: docs-agent rule names Deferred Items and Tech Debt as the source tables"
assert_equals "yes" "$(grep_has 'Deferral.*source.*deliberate scope decision' "$DOCS_SKILL")" \
  "req-005: docs-agent rule tags Deferred Items rows as deliberate scope decision"
assert_equals "yes" "$(grep_has 'tech debt.*for a row filed from the Tech Debt table' "$DOCS_SKILL")" \
  "req-005: docs-agent rule tags Tech Debt rows as tech debt"

echo ""
echo "=== req-005: docs-agent SKILL.md applies going forward only (no backfill) ==="

assert_equals "yes" "$(grep_has 'going forward only' "$DOCS_SKILL")" \
  "req-005: docs-agent rule states going-forward-only scope"
assert_equals "yes" "$(grep_has 'Do not backfill' "$DOCS_SKILL")" \
  "req-005: docs-agent rule explicitly forbids backfilling already-archived features"

echo ""
echo "=== req-005: docs-agent SKILL.md points at originating docs instead of duplicating rationale ==="

assert_equals "yes" "$(grep_has 'rather than duplicating that rationale' "$DOCS_SKILL")" \
  "req-005: docs-agent rule points backlog entries at originating rationale instead of duplicating it"

echo ""
echo "=== req-005: docs-agent SKILL.md follows the existing id allocation convention ==="

assert_equals "yes" "$(grep_has 'highest.*ever allocated (including picked-up and discarded entries), plus one' "$DOCS_SKILL")" \
  "req-005: docs-agent rule reuses the existing highest-id+1 backlog convention"

print_summary
