#!/usr/bin/env bash
# Tests for feature 0000017 req-004: cross-platform context-mode hook ports
# (.sh → .mjs, jq and Unix-shell dependency removed — ADR-002).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_ROOT="$(cd "$FRAMEWORK/.." && pwd)"
HOOKS_DIR="$FRAMEWORK/hooks/context-mode"
SETUP_SH="$FRAMEWORK/setup.sh"
SETUP_PS1="$FRAMEWORK/setup.ps1"
COMPONENT_YML="$PROJECT_ROOT/src/context-mode-hooks/component.yml"

file_exists() { [ -f "$1" ] && echo "yes" || echo "no"; }
grep_has()    { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

# ── AC-1/AC-2: .mjs ports exist, .sh originals removed ───────────────────────

echo ""
echo "=== req-004: .mjs ports exist, .sh originals removed ==="

for name in block-bash block-grep block-webfetch; do
  assert_equals "yes" "$(file_exists "$HOOKS_DIR/$name.mjs")" \
    "req-004: $name.mjs exists"
  assert_equals "no" "$(file_exists "$HOOKS_DIR/$name.sh")" \
    "req-004: $name.sh removed"
done

# no jq invocation anywhere in the hook implementations (doc comments noting
# the *absence* of the jq dependency are fine — exclude comment lines)
assert_equals "no" "$(grep -rh '\bjq\b' "$HOOKS_DIR" 2>/dev/null | grep -v '^\s*[*/]' | grep -q . && echo yes || echo no)" \
  "req-004: no jq invocation in hook implementations"

# ── AC-3: setup.sh wires the .mjs hooks ──────────────────────────────────────

echo ""
echo "=== req-004: setup.sh wiring ==="

assert_equals "yes" "$(grep_has "block-grep.mjs" "$SETUP_SH")" \
  "req-004: setup.sh references block-grep.mjs"
assert_equals "no" "$(grep_has "block-grep\.sh" "$SETUP_SH")" \
  "req-004: setup.sh no longer references block-grep.sh"
assert_equals "yes" "$(grep_has "Node.js runtime not found" "$SETUP_SH")" \
  "req-004: setup.sh has setup-time missing-runtime message"
assert_equals "yes" "$(grep_has "did not run: Node.js runtime not found" "$SETUP_SH")" \
  "req-004: setup.sh wires runtime-side missing-runtime message"

# ── AC-3: setup.ps1 wires the .mjs hooks ─────────────────────────────────────

echo ""
echo "=== req-004: setup.ps1 wiring ==="

assert_equals "yes" "$(grep_has "block-grep.mjs" "$SETUP_PS1")" \
  "req-004: setup.ps1 references block-grep.mjs"
assert_equals "no" "$(grep_has "block-grep\.sh" "$SETUP_PS1")" \
  "req-004: setup.ps1 no longer references block-grep.sh"
assert_equals "yes" "$(grep_has "Node.js runtime not found" "$SETUP_PS1")" \
  "req-004: setup.ps1 has setup-time missing-runtime message"

# ── AC-4: component.yml quirks Q-002 / Q-005 removed ─────────────────────────

echo ""
echo "=== req-004: component.yml quirks resolved ==="

assert_equals "no" "$(grep_has "Q-002" "$COMPONENT_YML")" \
  "req-004: quirk Q-002 (jq dependency) removed"
assert_equals "no" "$(grep_has "Q-005" "$COMPONENT_YML")" \
  "req-004: quirk Q-005 (Windows shell requirement) removed"
assert_equals "yes" "$(grep_has 'runtime: "node"' "$COMPONENT_YML")" \
  "req-004: component.yml stack runtime is node"

# ── AC-5: behavioral parity — decisions match the old .sh logic ──────────────

echo ""
echo "=== req-004: hook decisions (behavioral parity) ==="

run_hook() { printf '%s' "$2" | node "$HOOKS_DIR/$1" 2>/dev/null; }

# Grep: unconditional deny
OUT=$(run_hook block-grep.mjs '{"tool_name":"Grep","tool_input":{"pattern":"TODO","path":"src/"}}')
assert_contains '"permissionDecision":"deny"' "$OUT" "req-004: Grep denied"
assert_contains "ctx_execute" "$OUT" "req-004: Grep redirect names ctx_execute"

# Bash: allowlisted leading token allowed (empty output)
OUT=$(run_hook block-bash.mjs '{"tool_name":"Bash","tool_input":{"command":"git status"}}')
assert_equals "" "$OUT" "req-004: git status allowed (empty output)"

# Bash: grep pattern denied
OUT=$(run_hook block-bash.mjs '{"tool_name":"Bash","tool_input":{"command":"grep TODO src/"}}')
assert_contains '"permissionDecision":"deny"' "$OUT" "req-004: bash grep denied"

# Bash: curl denied with fetch redirect
OUT=$(run_hook block-bash.mjs '{"tool_name":"Bash","tool_input":{"command":"curl https://example.com"}}')
assert_contains "ctx_fetch_and_index" "$OUT" "req-004: curl redirect names ctx_fetch_and_index"

# WebFetch: unconditional deny with URL echoed
OUT=$(run_hook block-webfetch.mjs '{"tool_name":"WebFetch","tool_input":{"url":"https://example.com/x"}}')
assert_contains '"permissionDecision":"deny"' "$OUT" "req-004: WebFetch denied"
assert_contains "https://example.com/x" "$OUT" "req-004: WebFetch reason echoes URL"

# malformed stdin: exit 0, fail open
RC=$(printf 'not json' | node "$HOOKS_DIR/block-bash.mjs" >/dev/null 2>&1; echo $?)
assert_equals "0" "$RC" "req-004: malformed stdin exits 0 (fail-open)"

print_summary
