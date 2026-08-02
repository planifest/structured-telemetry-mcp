#!/usr/bin/env bash
# Tests for feature 0000019, req-002: component.json -> component.yml matcher fix.
# Covers hooks/pre-push and hooks/pre-commit directly (not just the workflow) per
# the requirement's explicit instruction — the shipped hooks are what setup.sh
# installs into every consuming repository, so they matter more than this
# repo's own CI.
#
# Two scenarios, run against both hooks:
#   PASS case: a change touching only src/ plus a component.yml update, with
#     no plan/ or docs/ change — this is the case that was falsely rejected
#     before the fix (matcher looked for component.json, never present).
#   FAIL case: a change touching only src/, with no manifest, plan, or docs
#     change at all — this must still be rejected; the fix must not have
#     turned an over-strict matcher into a hole.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRE_PUSH="$FRAMEWORK/hooks/pre-push"
PRE_COMMIT="$FRAMEWORK/hooks/pre-commit"

RUN_ID="$$-$(date +%s%N 2>/dev/null || date +%s)"

# -----------------------------------------------------------------------
# Scaffolding: a bare "origin" repo plus a working clone with a real
# origin/main ref, so pre-push's `git fetch origin main` and
# `git diff origin/main...HEAD` have something real to compare against.
# -----------------------------------------------------------------------

setup_repo() {
  local base="$1"
  local origin_dir="$base/origin.git"
  local work_dir="$base/work"

  git init --quiet --bare "$origin_dir"

  git init --quiet "$work_dir"
  (
    cd "$work_dir" || exit 1
    git config user.email "test@example.com"
    git config user.name "Test"
    git branch -M main
    mkdir -p src/example
    echo "seed" > README.md
    git add README.md
    git commit --quiet -m "seed"
    git remote add origin "$origin_dir"
    git push --quiet origin main
  )
  printf '%s' "$work_dir"
}

# -----------------------------------------------------------------------
# PASS case: src/ + component.yml, no plan/ or docs/ — must be allowed.
# -----------------------------------------------------------------------

echo ""
echo "=== req-002: PASS case — src/ change with component.yml, no plan/docs ==="

BASE_PASS=$(mktemp -d -t planifest_req002_pass_XXXXXX)
WORK_PASS=$(setup_repo "$BASE_PASS")

(
  cd "$WORK_PASS" || exit 1
  mkdir -p src/example
  echo "code" > src/example/main.txt
  cat > src/example/component.yml << 'EOF'
name: example
version: 0.1.0
EOF
  git add src/example/main.txt src/example/component.yml
  git commit --quiet -m "add example component"
)

PASS_PUSH_OUTPUT=$(cd "$WORK_PASS" && bash "$PRE_PUSH" 2>&1)
PASS_PUSH_EXIT=$?
assert_exit_zero "$PASS_PUSH_EXIT" "pre-push: src/ + component.yml (no plan/docs) passes"

PASS_COMMIT_OUTPUT=$(cd "$WORK_PASS" && git diff --cached --name-only > /dev/null; bash "$PRE_COMMIT" 2>&1)
# pre-commit's advisory check reads `git diff --cached`, which is empty right
# after a commit — re-stage the same files to exercise the check honestly.
(
  cd "$WORK_PASS" || exit 1
  git reset --soft HEAD~1
  git add src/example/main.txt src/example/component.yml
)
PASS_COMMIT_OUTPUT=$(cd "$WORK_PASS" && bash "$PRE_COMMIT" 2>&1)
PASS_COMMIT_EXIT=$?
assert_exit_zero "$PASS_COMMIT_EXIT" "pre-commit: always exits 0 (advisory)"
assert_equals "no" "$(echo "$PASS_COMMIT_OUTPUT" | grep -q "PLANIFEST ADVISORY" && echo yes || echo no)" \
  "pre-commit: src/ + component.yml staged — no advisory warning printed"

rm -rf "$BASE_PASS"

# -----------------------------------------------------------------------
# FAIL case: src/ only, no manifest/plan/docs at all — must still be blocked.
# -----------------------------------------------------------------------

echo ""
echo "=== req-002: FAIL case — src/ change with no manifest/plan/docs ==="

BASE_FAIL=$(mktemp -d -t planifest_req002_fail_XXXXXX)
WORK_FAIL=$(setup_repo "$BASE_FAIL")

(
  cd "$WORK_FAIL" || exit 1
  mkdir -p src/example
  echo "code" > src/example/main.txt
  git add src/example/main.txt
  git commit --quiet -m "add example code, no manifest"
)

FAIL_PUSH_OUTPUT=$(cd "$WORK_FAIL" && bash "$PRE_PUSH" 2>&1)
FAIL_PUSH_EXIT=$?
assert_equals "1" "$FAIL_PUSH_EXIT" "pre-push: src/ only, no manifest/plan/docs — rejected (exit 1)"
assert_equals "yes" "$(echo "$FAIL_PUSH_OUTPUT" | grep -q "PLANIFEST ENFORCEMENT FAILED" && echo yes || echo no)" \
  "pre-push: rejection message printed for the fail case"

(
  cd "$WORK_FAIL" || exit 1
  git reset --soft HEAD~1
  git add src/example/main.txt
)
FAIL_COMMIT_OUTPUT=$(cd "$WORK_FAIL" && bash "$PRE_COMMIT" 2>&1)
FAIL_COMMIT_EXIT=$?
assert_exit_zero "$FAIL_COMMIT_EXIT" "pre-commit: always exits 0 (advisory) even for the fail case"
assert_equals "yes" "$(echo "$FAIL_COMMIT_OUTPUT" | grep -q "PLANIFEST ADVISORY" && echo yes || echo no)" \
  "pre-commit: src/ only staged, no manifest/plan/docs — advisory warning printed"

rm -rf "$BASE_FAIL"

# -----------------------------------------------------------------------
# No remaining component.json reference in the live matcher/hook files
# (both the escaped-regex form and the plain-text form, per the
# requirement's note that a single search style misses one or the other).
# -----------------------------------------------------------------------

echo ""
echo "=== req-002: no live component.json reference remains ==="

for f in "$PRE_PUSH" "$PRE_COMMIT" "$FRAMEWORK/hooks/planifest.yml"; do
  name="$(basename "$f")"
  assert_equals "no" "$(grep -qF "component.json" "$f" && echo yes || echo no)" \
    "$name: no plain-text component.json reference"
  assert_equals "no" "$(grep -qE 'component\\\.json' "$f" && echo yes || echo no)" \
    "$name: no escaped-regex component\\.json reference"
  assert_equals "yes" "$(grep -qF "component.yml" "$f" && echo yes || echo no)" \
    "$name: references component.yml"
done

print_summary
