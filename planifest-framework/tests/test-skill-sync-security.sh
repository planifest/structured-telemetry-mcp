#!/usr/bin/env bash
# Security tests for skill-sync.sh (REC-001 / F-001, F-002, F-003)
# Covers: JS injection guard, path traversal guard, URL scheme validation.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

SKILL_SYNC="$SCRIPT_DIR/../scripts/skill-sync.sh"
TMPDIR_BASE="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_BASE"' EXIT

# Minimal project structure that skill-sync needs
make_env() {
  local dir="$1"
  mkdir -p "$dir/planifest-framework/scripts"
  mkdir -p "$dir/planifest-framework/setup"
  mkdir -p "$dir/planifest-framework/external-skills"
  mkdir -p "$dir/plan/current/external-skills"
  # Stub a claude-code setup config
  cat > "$dir/planifest-framework/setup/claude-code.sh" <<'EOF'
TOOL_SKILLS_DIR=".claude/skills"
EOF
  mkdir -p "$dir/.claude/skills"
  printf '{"skills":[]}\n' > "$dir/planifest-framework/external-skills.json"
}

run_sync() {
  local proj="$1"; shift
  # Override PROJECT_ROOT by running from the framework scripts dir
  (
    export HOME="$proj"  # isolate git config if needed
    cd "$proj/planifest-framework/scripts"
    bash "$SKILL_SYNC" "$@" 2>&1
  )
  echo "$?"
}

echo ""
echo "=== skill-sync.sh security — F-001, F-002, F-003 ==="

# ── F-002: validate_skill_name — path traversal ────────────────────────────
echo ""
echo "--- F-002: validate_skill_name (path traversal guard) ---"

PROJ="$TMPDIR_BASE/proj1"
make_env "$PROJ"

output=$(run_sync "$PROJ" remove "../etc/passwd" claude-code 2>&1 | sed '$d')
code=$(run_sync "$PROJ" remove "../etc/passwd" claude-code | tail -n1)
assert_equals "1" "$code" "remove with ../ name exits 1"
assert_contains "Invalid skill name" "$output" "remove with ../ prints invalid name error"

output=$(run_sync "$PROJ" remove "../../root" claude-code 2>&1 | sed '$d')
code=$(run_sync "$PROJ" remove "../../root" claude-code | tail -n1)
assert_equals "1" "$code" "remove with deep traversal exits 1"

output=$(run_sync "$PROJ" install "bad/name" claude-code 2>&1 | sed '$d')
code=$(run_sync "$PROJ" install "bad/name" claude-code | tail -n1)
assert_equals "1" "$code" "install with slash in name exits 1"

output=$(run_sync "$PROJ" install "valid-skill_123" claude-code 2>&1 | sed '$d')
# valid name — fails for "not found", not for name validation
if [[ "$output" != *"Invalid skill name"* ]]; then
  echo "  PASS: valid name 'valid-skill_123' passes name validation"
  ((PASS++)) || true
else
  echo "  FAIL: valid name 'valid-skill_123' incorrectly rejected"
  ((FAIL++)) || true
fi

# ── F-003: --from URL scheme validation ───────────────────────────────────
echo ""
echo "--- F-003: --from URL scheme validation ---"

PROJ2="$TMPDIR_BASE/proj2"
make_env "$PROJ2"

output=$(run_sync "$PROJ2" add my-skill claude-code --from "file:///etc/passwd" --authorized 2>&1 | sed '$d')
code=$(run_sync "$PROJ2" add my-skill claude-code --from "file:///etc/passwd" --authorized | tail -n1)
assert_equals "1" "$code" "file:// URL rejected"
assert_contains "must use https://" "$output" "file:// error message mentions https"

output=$(run_sync "$PROJ2" add my-skill claude-code --from "ftp://example.com/skill" --authorized 2>&1 | sed '$d')
code=$(run_sync "$PROJ2" add my-skill claude-code --from "ftp://example.com/skill" --authorized | tail -n1)
assert_equals "1" "$code" "ftp:// URL rejected"

output=$(run_sync "$PROJ2" add my-skill claude-code --from "http://example.com/skill" --authorized 2>&1 | sed '$d')
code=$(run_sync "$PROJ2" add my-skill claude-code --from "http://example.com/skill" --authorized | tail -n1)
assert_equals "1" "$code" "http:// (non-TLS) URL rejected"
assert_contains "must use https://" "$output" "http:// error message mentions https"

# https:// passes scheme check (will fail at network fetch, not at validation)
output=$(run_sync "$PROJ2" add my-skill claude-code --from "https://example.com/skill" --authorized 2>&1 | sed '$d')
[[ "$output" != *"must use https://"* ]]
echo "  PASS: https:// URL passes scheme validation"
((PASS++)) || true

# ── F-001: skill_in_manifest JS injection ─────────────────────────────────
echo ""
echo "--- F-001: JS injection via skill name ---"

PROJ3="$TMPDIR_BASE/proj3"
make_env "$PROJ3"

# Craft a name that would break out of a JS string literal if interpolated
INJECTION="'); process.exit(0); //'"
output=$(run_sync "$PROJ3" remove "$INJECTION" claude-code 2>&1 | sed '$d')
code=$(run_sync "$PROJ3" remove "$INJECTION" claude-code | tail -n1)
assert_equals "1" "$code" "JS injection attempt blocked by name validation"
assert_contains "Invalid skill name" "$output" "injection attempt reports invalid name"

print_summary
