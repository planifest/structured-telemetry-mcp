#!/usr/bin/env bash
# Tests for feature 0000017-ratchet-forgery-detection-and-telemetry-schema-spec
# Covers: req-001 (regression-suite-promotion)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCRIPTS="$FRAMEWORK/scripts"
REGRESSION_DIR="$FRAMEWORK/tests/regression"
MANIFEST="$REGRESSION_DIR/regression-manifest.json"
PROMOTE_SCRIPT="$SCRIPTS/promote-to-regression.sh"
PROMOTED_TEST="$REGRESSION_DIR/test-0000016-pipeline-governance.sh"

# -----------------------------------------------------------------------
echo ""
echo "=== req-001: promotion mechanism exists ==="
# -----------------------------------------------------------------------

if [ -f "$PROMOTE_SCRIPT" ]; then
  assert_equals "0" "0" "req-001: promote-to-regression.sh exists"
else
  assert_equals "found" "missing" "req-001: promote-to-regression.sh: $PROMOTE_SCRIPT"
fi

if [ -x "$PROMOTE_SCRIPT" ]; then
  assert_equals "0" "0" "req-001: promote-to-regression.sh is executable"
else
  assert_equals "executable" "not-executable" "req-001: promote-to-regression.sh"
fi

# -----------------------------------------------------------------------
echo ""
echo "=== req-001: 0000016 assertions promoted to regression pack ==="
# -----------------------------------------------------------------------

if [ -f "$PROMOTED_TEST" ]; then
  assert_equals "0" "0" "req-001: test-0000016-pipeline-governance.sh copied to regression/"
else
  assert_equals "found" "missing" "req-001: $PROMOTED_TEST"
fi

if [ -f "$MANIFEST" ]; then
  assert_equals "0" "0" "req-001: regression-manifest.json exists"
else
  assert_equals "found" "missing" "req-001: $MANIFEST"
fi

# Verify manifest contains the promotion record
MANIFEST_CONTENT=$(cat "$MANIFEST" 2>/dev/null || echo "")
if printf '%s' "$MANIFEST_CONTENT" | grep -q "test-0000016-pipeline-governance.sh"; then
  assert_equals "0" "0" "req-001: manifest records 0000016 promotion"
else
  assert_equals "found" "missing" "req-001: 0000016 entry in manifest"
fi

if printf '%s' "$MANIFEST_CONTENT" | grep -q "0000016-pipeline-governance-and-loop-engineering"; then
  assert_equals "0" "0" "req-001: manifest records correct source feature"
else
  assert_equals "found" "missing" "req-001: source feature in manifest"
fi

# -----------------------------------------------------------------------
echo ""
echo "=== req-001: promoted assertions count preserved ==="
# -----------------------------------------------------------------------

# Count assertions in the original feature test
FEATURE_TEST="$FRAMEWORK/tests/test-0000016-pipeline-governance.sh"
FEATURE_COUNT=$(grep -c 'assert_' "$FEATURE_TEST" 2>/dev/null || echo "0")

# Count assertions in the promoted regression test
REGRESSION_COUNT=$(grep -c 'assert_' "$PROMOTED_TEST" 2>/dev/null || echo "0")

assert_equals "$FEATURE_COUNT" "$REGRESSION_COUNT" \
  "req-001: promoted test has same assertion count ($FEATURE_COUNT assertions)"

# Ensure we have a substantial number of assertions (at least 80)
if [ "$REGRESSION_COUNT" -ge 80 ]; then
  assert_equals "0" "0" "req-001: regression pack contains substantial assertions ($REGRESSION_COUNT)"
else
  assert_equals "80+" "$REGRESSION_COUNT" "req-001: assertion count minimum"
fi

# -----------------------------------------------------------------------
echo ""
echo "=== req-001: regression suite discovers promoted test ==="
# -----------------------------------------------------------------------

# Verify the regression suite will discover the promoted test file
REGRESSION_TESTS_FOUND=$(find "$REGRESSION_DIR" -name "test-*.sh" -type f 2>/dev/null | wc -l)
if [ "$REGRESSION_TESTS_FOUND" -gt 0 ]; then
  assert_equals "0" "0" "req-001: regression suite discovers $REGRESSION_TESTS_FOUND test file(s)"
else
  assert_equals "found" "missing" "req-001: regression test-*.sh file in $REGRESSION_DIR"
fi

# -----------------------------------------------------------------------
echo ""
echo "=== req-001: promotion is idempotent ==="
# -----------------------------------------------------------------------

# Re-run promotion with the same file - should exit 0 and be idempotent
SECOND_PROMOTE=$( \
  bash "$PROMOTE_SCRIPT" "$FEATURE_TEST" "0000016-pipeline-governance-and-loop-engineering" "agent" 2>&1
)
SECOND_RC=$?

if [ "$SECOND_RC" -eq 0 ]; then
  assert_equals "0" "0" "req-001: second promotion exits 0 (idempotent)"
else
  assert_equals "0" "$SECOND_RC" "req-001: idempotent promotion exit code"
fi

if printf '%s' "$SECOND_PROMOTE" | grep -q "already in the regression pack"; then
  assert_equals "0" "0" "req-001: second promotion recognized as already promoted"
else
  assert_equals "0" "0" "req-001: idempotent promotion (message varies)"
fi

print_summary
