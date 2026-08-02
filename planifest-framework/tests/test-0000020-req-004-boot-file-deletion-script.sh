#!/usr/bin/env bash
# Tests for feature 0000020-setup-refresh-skill, req-004:
# safe-boot-file-deletion.
#
# Covers the P5 security hardening: the deletion allowlist is enforced in
# code (refresh-delete-boot-files.sh), not only in planifest-refresh-setup's
# prose instructions. See security-report.md for the finding this closes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
DELETE_SCRIPT="$FRAMEWORK/scripts/refresh-delete-boot-files.sh"
DELETE_SCRIPT_PS1="$FRAMEWORK/scripts/refresh-delete-boot-files.ps1"

file_exists() { [ -f "$1" ] && echo "yes" || echo "no"; }

make_workspace() {
  local dir
  dir=$(mktemp -d -t planifest_0000020_req004_test_XXXXXX)
  echo "$dir"
}

echo ""
echo "=== req-004: deletes both boot files when present ==="

WS=$(make_workspace); cd "$WS"
touch CLAUDE.md AGENTS.md settings.local.json unrelated-file.txt
bash "$DELETE_SCRIPT" >/dev/null 2>&1
assert_exit_zero $? "req-004: script exits 0"

assert_equals "no" "$(file_exists "CLAUDE.md")" "req-004: CLAUDE.md deleted"
assert_equals "no" "$(file_exists "AGENTS.md")" "req-004: AGENTS.md deleted"
assert_equals "yes" "$(file_exists "settings.local.json")" \
  "req-004: settings.local.json untouched"
assert_equals "yes" "$(file_exists "unrelated-file.txt")" \
  "req-004: unrelated files untouched"

cd "$SCRIPT_DIR"
rm -rf "$WS"

echo ""
echo "=== req-004: no-op (exit 0) when neither boot file is present ==="

WS=$(make_workspace); cd "$WS"
touch settings.local.json
bash "$DELETE_SCRIPT" >/dev/null 2>&1
assert_exit_zero $? "req-004: exits 0 even when nothing to delete"
assert_equals "yes" "$(file_exists "settings.local.json")" \
  "req-004: settings.local.json still untouched on a no-op run"

cd "$SCRIPT_DIR"
rm -rf "$WS"

echo ""
echo "=== req-004: only one boot file present is handled correctly ==="

WS=$(make_workspace); cd "$WS"
touch CLAUDE.md settings.local.json
bash "$DELETE_SCRIPT" >/dev/null 2>&1
assert_exit_zero $? "req-004: exits 0 with only CLAUDE.md present"
assert_equals "no" "$(file_exists "CLAUDE.md")" "req-004: CLAUDE.md deleted"
assert_equals "yes" "$(file_exists "settings.local.json")" \
  "req-004: settings.local.json untouched"

cd "$SCRIPT_DIR"
rm -rf "$WS"

echo ""
echo "=== req-004: the allowlist is hardcoded, not parameterised (static check) ==="

grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

assert_equals "yes" "$(file_exists "$DELETE_SCRIPT")" \
  "req-004: refresh-delete-boot-files.sh exists"
assert_equals "yes" "$(file_exists "$DELETE_SCRIPT_PS1")" \
  "req-004: refresh-delete-boot-files.ps1 exists"
assert_equals "no" "$(grep_has '\$1\|\$2\|"\$@"\|\$ARGV\|args\[' "$DELETE_SCRIPT")" \
  "req-004: refresh-delete-boot-files.sh does not read the file list from arguments"

print_summary
