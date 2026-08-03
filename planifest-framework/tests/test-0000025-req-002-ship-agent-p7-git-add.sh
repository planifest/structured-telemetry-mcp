#!/usr/bin/env bash
# Tests for feature 0000025, req-002: ship-agent P7 Step 7 git add explicitly
# names plan/current/, so the archive commit no longer silently depends on
# git's rename-detection heuristic to stage plan/current/'s deletion.
#
# planifest-ship-agent/SKILL.md is a prose/template skill file, not
# executable code — these are content-assertion tests against the actual
# SKILL.md text (P7 Step 7), following the same sed/grep pattern used by
# test-0000018-req-007-discovery-md-hard-limit.sh.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
SHIP_SKILL="$FRAMEWORK/skills/planifest-ship-agent/SKILL.md"

# Isolate Step 7 (from its heading to the next "## " heading).
STEP7=$(sed -n '/^### Step 7 — Commit archive/,/^## P8/p' "$SHIP_SKILL")

# The documented git add command line itself.
GIT_ADD_LINE=$(printf '%s\n' "$STEP7" | grep '^git add ')

echo ""
echo "=== req-002: Step 7 git add explicitly names plan/current/ ==="

assert_equals "yes" "$([ -n "$GIT_ADD_LINE" ] && echo yes || echo no)" \
  "req-002: Step 7 documents a git add command"
assert_contains "plan/current/" "$GIT_ADD_LINE" \
  "req-002: git add command explicitly lists plan/current/ as a path argument"

echo ""
echo "=== req-002: the six pre-existing paths are still staged (unchanged) ==="

assert_contains "plan/_archive/" "$GIT_ADD_LINE" "req-002: plan/_archive/ still staged"
assert_contains "plan/changelog/" "$GIT_ADD_LINE" "req-002: plan/changelog/ still staged"
assert_contains "docs/about.md" "$GIT_ADD_LINE" "req-002: docs/about.md still staged"
assert_contains "plan/.orchestrator-active" "$GIT_ADD_LINE" "req-002: plan/.orchestrator-active still staged"
assert_contains "plan/.orchestrator-ack" "$GIT_ADD_LINE" "req-002: plan/.orchestrator-ack still staged"
assert_contains "plan/.run-mode" "$GIT_ADD_LINE" "req-002: plan/.run-mode still staged"

echo ""
echo "=== req-002: path count — exactly seven explicit path arguments ==="

# git add <7 paths> — split on whitespace after the literal "git add " prefix.
PATH_COUNT=$(printf '%s' "$GIT_ADD_LINE" | sed 's/^git add //' | wc -w | tr -d ' ')
assert_equals "7" "$PATH_COUNT" \
  "req-002: git add names exactly 7 explicit paths (6 pre-existing + plan/current/)"

echo ""
echo "=== req-002: Step 6 archive mechanics untouched ==="

STEP6=$(sed -n '/^### Step 6 — Archive plan\/current\//,/^### Step 6b/p' "$SHIP_SKILL")
assert_contains "Copy-then-delete" "$STEP6" \
  "req-002: Step 6 still documents copy-then-delete archive mechanics"

print_summary
