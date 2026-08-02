#!/usr/bin/env bash
# Tests for regression-pack infrastructure (req-014)
# Covers: promote-to-regression.sh, regression-manifest.json, run-tests.sh regression block

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../helpers/assert.sh"

PROMOTE="$SCRIPT_DIR/../../scripts/promote-to-regression.sh"
TMPDIR_BASE="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_BASE"' EXIT

# ── Test environment setup ────────────────────────────────────────────────────
# Override PLANIFEST_REGRESSION_DIR so tests are isolated from the real pack.
# All node.js calls use (cd <dir> && node -e ...) to avoid POSIX/Windows path issues.

make_env() {
  local dir="$1"
  mkdir -p "$dir/regression"
  printf '{"tests":[]}\n' > "$dir/regression/regression-manifest.json"
}

run_promote() {
  local regression_dir="$1"; shift
  PLANIFEST_REGRESSION_DIR="$regression_dir" bash "$PROMOTE" "$@" 2>&1
  echo "EXIT:$?"
}

read_manifest_count() {
  local regression_dir="$1"
  ( cd "$regression_dir" && node -e "
const m = JSON.parse(require('fs').readFileSync('regression-manifest.json','utf8'));
console.log(m.tests.length);
" 2>/dev/null ) || echo "0"
}

read_manifest_field() {
  local regression_dir="$1"
  local field="$2"
  ( cd "$regression_dir" && FIELD="$field" node -e "
const m = JSON.parse(require('fs').readFileSync('regression-manifest.json','utf8'));
console.log(m.tests[0] ? m.tests[0][process.env.FIELD] : '');
" 2>/dev/null ) || echo ""
}

echo ""
echo "=== req-014: regression-pack infrastructure ==="

# ── Section 1: promote-to-regression.sh happy path ───────────────────────────
echo ""
echo "--- promote-to-regression.sh: happy path ---"

ENV1="$TMPDIR_BASE/env1"
make_env "$ENV1"

TEST_SRC="$TMPDIR_BASE/my-test.sh"
printf '#!/usr/bin/env bash\necho "test"\n' > "$TEST_SRC"

full_out=$(run_promote "$ENV1/regression" "$TEST_SRC" "0000004-test" "human")
code=$(printf '%s' "$full_out" | tail -n1 | sed 's/EXIT://')
output=$(printf '%s' "$full_out" | sed '$d')

assert_equals "0" "$code" "promote exits 0 on happy path"
assert_contains "Promotion complete" "$output" "promote reports completion"

if [ -f "$ENV1/regression/my-test.sh" ]; then
  echo "  PASS: test file copied to regression dir"
  ((PASS++)) || true
else
  echo "  FAIL: test file not copied to regression dir"
  ((FAIL++)) || true
fi

manifest_count=$(read_manifest_count "$ENV1/regression")
assert_equals "1" "$manifest_count" "manifest has 1 entry after promotion"

manifest_name=$(read_manifest_field "$ENV1/regression" "name")
assert_equals "my-test.sh" "$manifest_name" "manifest entry has correct name"

manifest_promoted_by=$(read_manifest_field "$ENV1/regression" "promotedBy")
assert_equals "human" "$manifest_promoted_by" "manifest entry has promotedBy=human"

# ── Section 2: idempotency ────────────────────────────────────────────────────
echo ""
echo "--- promote-to-regression.sh: idempotency ---"

full_out2=$(run_promote "$ENV1/regression" "$TEST_SRC" "0000004-test" "human")
code2=$(printf '%s' "$full_out2" | tail -n1 | sed 's/EXIT://')
output2=$(printf '%s' "$full_out2" | sed '$d')

assert_equals "0" "$code2" "second promotion run exits 0 (idempotent)"
assert_contains "already in the regression pack" "$output2" "second run reports already promoted"

manifest_count2=$(read_manifest_count "$ENV1/regression")
assert_equals "1" "$manifest_count2" "manifest still has 1 entry (no duplicate) after second run"

# ── Section 3: missing source file ───────────────────────────────────────────
echo ""
echo "--- promote-to-regression.sh: missing source file ---"

ENV3="$TMPDIR_BASE/env3"
make_env "$ENV3"

full_out3=$(run_promote "$ENV3/regression" "/nonexistent/file.sh" "0000004-test" "human")
code3=$(printf '%s' "$full_out3" | tail -n1 | sed 's/EXIT://')
output3=$(printf '%s' "$full_out3" | sed '$d')

assert_equals "1" "$code3" "promote exits 1 when source file missing"
assert_contains "not found" "$output3" "promote reports file not found"

# ── Section 4: manifest is valid JSON ────────────────────────────────────────
echo ""
echo "--- regression-manifest.json: valid JSON ---"

( cd "$ENV1/regression" && node -e "JSON.parse(require('fs').readFileSync('regression-manifest.json','utf8'));" 2>/dev/null )
json_valid=$?
assert_equals "0" "$json_valid" "manifest is valid JSON after promotion"

# ── Section 5: run-tests.sh contains regression suite block ──────────────────
echo ""
echo "--- run-tests.sh: regression suite block present in script ---"

RUN_TESTS="$SCRIPT_DIR/../run-tests.sh"

if grep -qF "=== Regression Suite ===" "$RUN_TESTS"; then
  echo "  PASS: run-tests.sh contains regression suite header"
  ((PASS++)) || true
else
  echo "  FAIL: run-tests.sh missing regression suite header"
  ((FAIL++)) || true
fi

if grep -qF "Regression suite:" "$RUN_TESTS"; then
  echo "  PASS: run-tests.sh contains regression suite summary label"
  ((PASS++)) || true
else
  echo "  FAIL: run-tests.sh missing regression suite summary label"
  ((FAIL++)) || true
fi

# ── Section 6: regression dir and manifest exist ──────────────────────────────
echo ""
echo "--- regression-pack infrastructure: files exist ---"

REAL_REGRESSION_DIR="$SCRIPT_DIR/../regression"
REAL_MANIFEST="$REAL_REGRESSION_DIR/regression-manifest.json"

if [ -d "$REAL_REGRESSION_DIR" ]; then
  echo "  PASS: tests/regression/ directory exists"
  ((PASS++)) || true
else
  echo "  FAIL: tests/regression/ directory missing"
  ((FAIL++)) || true
fi

if [ -f "$REAL_MANIFEST" ]; then
  echo "  PASS: regression-manifest.json exists"
  ((PASS++)) || true
else
  echo "  FAIL: regression-manifest.json missing"
  ((FAIL++)) || true
fi

if [ -f "$REAL_MANIFEST" ]; then
  ( cd "$REAL_REGRESSION_DIR" && node -e "JSON.parse(require('fs').readFileSync('regression-manifest.json','utf8'));" 2>/dev/null )
  real_json_valid=$?
  assert_equals "0" "$real_json_valid" "real regression-manifest.json is valid JSON"
fi

print_summary
