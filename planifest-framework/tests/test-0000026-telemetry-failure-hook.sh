#!/usr/bin/env bash
# Tests for feature 0000026 (folded backlog 0000044): telemetry failure marker
# UserPromptSubmit hook.
#
# Covers planifest-framework/hooks/enforcement/check-telemetry-failures.mjs:
#   1. No markers present under plan/.telemetry-failures/ -> no additionalContext
#      output (nothing on stdout), hook exits 0.
#   2. One marker present -> additionalContext mentions its hook, error_type,
#      error_message, and occurrences fields.
#   3. Multiple markers present -> all of them are mentioned in additionalContext.
#   4. Malformed marker JSON -> hook does not crash; it exits 0 (fail-open,
#      consistent with every other hook in this repo) and still surfaces
#      whatever valid markers exist alongside the malformed one.
#
# This hook is deliberately read-only (per its header comment and the task
# that produced it): it must never delete or modify marker files itself.
# That responsibility stays with the orchestrator (SKILL.md's Telemetry
# section, "Failure detection and interactive recovery").

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
_hook_abs="$FRAMEWORK/hooks/enforcement/check-telemetry-failures.mjs"

# cygpath converts /c/d/... to C:\d\... for Node.js on Windows/Git Bash
if command -v cygpath >/dev/null 2>&1; then
  HOOK="$(cygpath -w "$_hook_abs")"
else
  HOOK="$_hook_abs"
fi

to_native_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    printf '%s' "$1"
  fi
}

get_additional_context() {
  local output="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$output" | jq -r '.additionalContext // ""' 2>/dev/null
  else
    printf '%s' "$output" | node -e \
      "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log(j?.additionalContext??'');}catch{console.log('');}});"
  fi
}

run_hook() {
  # run_hook <cwd>
  local cwd="$1"
  local input="{\"cwd\":\"$cwd\"}"
  printf '%s' "$input" | node "$HOOK" 2>&1
}

# =============================================================================
# Scenario 1: no plan/.telemetry-failures/ directory at all
# =============================================================================

echo ""
echo "=== 0000026: no markers directory -> no additionalContext, exit 0 ==="

SCRATCH_A=$(mktemp -d -t planifest_0000026_a_XXXXXX)
SCRATCH_A="$(to_native_path "$SCRATCH_A")"

output_a=$(run_hook "$SCRATCH_A")
exit_a=$?
assert_exit_zero "$exit_a" "no markers dir: hook exits 0"
assert_equals "" "$output_a" "no markers dir: no stdout output at all"

rm -rf "$SCRATCH_A"

# =============================================================================
# Scenario 1b: empty plan/.telemetry-failures/ directory (exists, no *.json)
# =============================================================================

echo ""
echo "=== 0000026: empty markers directory -> no additionalContext, exit 0 ==="

SCRATCH_B=$(mktemp -d -t planifest_0000026_b_XXXXXX)
SCRATCH_B="$(to_native_path "$SCRATCH_B")"
mkdir -p "$SCRATCH_B/plan/.telemetry-failures"

output_b=$(run_hook "$SCRATCH_B")
exit_b=$?
assert_exit_zero "$exit_b" "empty markers dir: hook exits 0"
assert_equals "" "$output_b" "empty markers dir: no stdout output"

rm -rf "$SCRATCH_B"

# =============================================================================
# Scenario 2: one marker present
# =============================================================================

echo ""
echo "=== 0000026: one marker -> additionalContext mentions hook/error_type/occurrences ==="

SCRATCH_C=$(mktemp -d -t planifest_0000026_c_XXXXXX)
SCRATCH_C="$(to_native_path "$SCRATCH_C")"
mkdir -p "$SCRATCH_C/plan/.telemetry-failures"
cat > "$SCRATCH_C/plan/.telemetry-failures/context-pressure--typeerror--boom.json" << 'EOF'
{
  "hook": "context-pressure",
  "root_cause_key": "context-pressure::TypeError::boom",
  "error_type": "TypeError",
  "error_message": "boom-message",
  "phase": "monitoring",
  "session_id": "sess-c",
  "first_seen": "2026-08-01T00:00:00.000Z",
  "last_seen": "2026-08-01T00:00:00.000Z",
  "occurrences": 3
}
EOF

output_c=$(run_hook "$SCRATCH_C")
exit_c=$?
assert_exit_zero "$exit_c" "one marker: hook exits 0"

ctx_c="$(get_additional_context "$output_c")"
assert_equals "yes" "$([ -n "$ctx_c" ] && echo yes || echo no)" \
  "one marker: additionalContext is non-empty"
assert_contains "context-pressure" "$ctx_c" \
  "one marker: additionalContext mentions the marker's hook field"
assert_contains "TypeError" "$ctx_c" \
  "one marker: additionalContext mentions the marker's error_type field"
assert_contains "boom-message" "$ctx_c" \
  "one marker: additionalContext mentions the marker's error_message field"
assert_contains "3" "$ctx_c" \
  "one marker: additionalContext mentions the marker's occurrences field"
assert_contains "plan/.telemetry-failures" "$ctx_c" \
  "one marker: additionalContext names the marker location"
assert_contains "block-or-proceed" "$ctx_c" \
  "one marker: additionalContext instructs surfacing the block-or-proceed question"

rm -rf "$SCRATCH_C"

# =============================================================================
# Scenario 3: multiple distinct markers present
# =============================================================================

echo ""
echo "=== 0000026: multiple markers -> all are mentioned ==="

SCRATCH_D=$(mktemp -d -t planifest_0000026_d_XXXXXX)
SCRATCH_D="$(to_native_path "$SCRATCH_D")"
mkdir -p "$SCRATCH_D/plan/.telemetry-failures"
cat > "$SCRATCH_D/plan/.telemetry-failures/emit-phase-start--typeerror--conn-refused.json" << 'EOF'
{
  "hook": "emit-phase-start",
  "root_cause_key": "emit-phase-start::TypeError::conn-refused",
  "error_type": "TypeError",
  "error_message": "connect ECONNREFUSED",
  "phase": "spec",
  "session_id": "sess-d1",
  "first_seen": "2026-08-01T00:00:00.000Z",
  "last_seen": "2026-08-01T00:00:00.000Z",
  "occurrences": 1
}
EOF
cat > "$SCRATCH_D/plan/.telemetry-failures/emit-phase-end--http-500--boom.json" << 'EOF'
{
  "hook": "emit-phase-end",
  "root_cause_key": "emit-phase-end::http_500::boom",
  "error_type": "http_500",
  "error_message": "emission POST failed: HTTP 500",
  "phase": "codegen",
  "session_id": "sess-d2",
  "first_seen": "2026-08-01T00:00:00.000Z",
  "last_seen": "2026-08-01T00:00:00.000Z",
  "occurrences": 2
}
EOF

output_d=$(run_hook "$SCRATCH_D")
exit_d=$?
assert_exit_zero "$exit_d" "multiple markers: hook exits 0"

ctx_d="$(get_additional_context "$output_d")"
assert_contains "emit-phase-start" "$ctx_d" \
  "multiple markers: additionalContext mentions the first marker's hook"
assert_contains "connect ECONNREFUSED" "$ctx_d" \
  "multiple markers: additionalContext mentions the first marker's error_message"
assert_contains "emit-phase-end" "$ctx_d" \
  "multiple markers: additionalContext mentions the second marker's hook"
assert_contains "http_500" "$ctx_d" \
  "multiple markers: additionalContext mentions the second marker's error_type"

rm -rf "$SCRATCH_D"

# =============================================================================
# Scenario 4: malformed marker JSON does not crash the hook
# =============================================================================

echo ""
echo "=== 0000026: malformed marker JSON -> hook does not crash, exits 0 ==="

SCRATCH_E=$(mktemp -d -t planifest_0000026_e_XXXXXX)
SCRATCH_E="$(to_native_path "$SCRATCH_E")"
mkdir -p "$SCRATCH_E/plan/.telemetry-failures"
printf '{ this is not valid json {{{' > "$SCRATCH_E/plan/.telemetry-failures/broken.json"

output_e=$(run_hook "$SCRATCH_E")
exit_e=$?
assert_exit_zero "$exit_e" "malformed-only: hook still exits 0 (fail-open)"
assert_equals "" "$output_e" "malformed-only: no additionalContext for a directory with only unparsable markers"

# Malformed marker alongside a valid one: the valid marker must still surface.
cat > "$SCRATCH_E/plan/.telemetry-failures/context-pressure--typeerror--ok.json" << 'EOF'
{
  "hook": "context-pressure",
  "root_cause_key": "context-pressure::TypeError::ok",
  "error_type": "TypeError",
  "error_message": "still-readable",
  "phase": "monitoring",
  "session_id": "sess-e",
  "first_seen": "2026-08-01T00:00:00.000Z",
  "last_seen": "2026-08-01T00:00:00.000Z",
  "occurrences": 1
}
EOF

output_e2=$(run_hook "$SCRATCH_E")
exit_e2=$?
assert_exit_zero "$exit_e2" "malformed + valid: hook still exits 0"
ctx_e2="$(get_additional_context "$output_e2")"
assert_contains "still-readable" "$ctx_e2" \
  "malformed + valid: valid marker still surfaced despite the malformed sibling"

rm -rf "$SCRATCH_E"

print_summary
