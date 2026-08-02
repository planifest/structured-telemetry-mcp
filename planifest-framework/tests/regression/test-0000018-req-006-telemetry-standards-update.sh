#!/usr/bin/env bash
# Tests for feature 0000018 req-006: telemetry-standards.md updated as the
# single canonical reference for the unified signal and interactive-failure
# protocol (ADR-001, ADR-002).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/../.." && pwd)"
STANDARDS="$FRAMEWORK/standards/telemetry-standards.md"

grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

echo ""
echo "=== req-006: unified signal documented ==="

assert_equals "yes" "$(grep_has 'Unified Telemetry Signal' "$STANDARDS")" \
  "req-006: unified signal section exists"
assert_equals "yes" "$(grep_has 'context-mode-mcp' "$STANDARDS")" \
  "req-006: documents the removed --context-mode-mcp coupling"
assert_equals "yes" "$(grep_has 'always set together' "$STANDARDS")" \
  "req-006: documents the two mechanisms are now always consistent"

echo ""
echo "=== req-006: failure-marker mechanism documented ==="

assert_equals "yes" "$(grep_has 'durable failure marker' "$STANDARDS")" \
  "req-006: documents the hook failure marker"
assert_equals "yes" "$(grep_has 'ADR-005' "$STANDARDS")" \
  "req-006: references ADR-005 (exit-zero) as the preserved constraint"

echo ""
echo "=== req-006: interactive block-or-proceed protocol documented ==="

assert_equals "yes" "$(grep_has 'block-or-proceed' "$STANDARDS")" \
  "req-006: documents the block-or-proceed question"
assert_equals "yes" "$(grep_has 'never asked about twice in one run' "$STANDARDS")" \
  "req-006: documents once-per-root-cause-per-run scoping"

echo ""
echo "=== req-006: old soft-skip framing removed ==="

assert_equals "no" "$(grep_has 'skip silently — do not emit' "$STANDARDS")" \
  "req-006: old blanket 'skip silently' framing removed"

echo ""
echo "=== req-006: build-log telemetry record documented ==="

assert_equals "yes" "$(grep_has 'confirmed-disabled' "$STANDARDS")" \
  "req-006: documents the 3-state build-log telemetry field"

print_summary
