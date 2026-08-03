#!/usr/bin/env bash
# Tests for feature 0000023, req-004: telemetry product_id emission.
# Covers: emit-phase-start.mjs, emit-phase-end.mjs, context-pressure.mjs
# each populating `product_id` on the emitted event —
#   - git-repo cwd -> product_id equals that repo's `git rev-parse --show-toplevel`
#   - non-git-repo cwd -> product_id equals the raw cwd
#   - missing git binary -> falls back to raw cwd, never throws/blocks (ADR-005/NFR-001)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
_phase_start_abs="$FRAMEWORK/hooks/telemetry/emit-phase-start.mjs"
_phase_end_abs="$FRAMEWORK/hooks/telemetry/emit-phase-end.mjs"
_ctx_pressure_abs="$FRAMEWORK/hooks/telemetry/context-pressure.mjs"

# cygpath converts /c/d/... to C:\d\... for Node.js on Windows/Git Bash
if command -v cygpath >/dev/null 2>&1; then
  PHASE_START="$(cygpath -w "$_phase_start_abs")"
  PHASE_END="$(cygpath -w "$_phase_end_abs")"
  CTX_PRESSURE="$(cygpath -w "$_ctx_pressure_abs")"
else
  PHASE_START="$_phase_start_abs"
  PHASE_END="$_phase_end_abs"
  CTX_PRESSURE="$_ctx_pressure_abs"
fi

NODE_BIN="$(command -v node)"

# Unique per test execution so repeated runs never collide on
# emit-phase-start.mjs's session_id+phase dedup guard (ADR-003) — see
# test-0000018-req-002-hook-failure-marker.sh for the same rationale.
RUN_ID="$$-$(date +%s%N 2>/dev/null || date +%s)"
SESSION_COUNTER=0
next_session() {
  SESSION_COUNTER=$((SESSION_COUNTER + 1))
  printf 'sess-%s-%s' "$RUN_ID" "$SESSION_COUNTER"
}

to_native_path() {
  # Only rewrites for Windows/Git Bash; identity elsewhere.
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    printf '%s' "$1"
  fi
}

wait_for_file() {
  local file="$1"
  local max_attempts="${2:-40}" # 40 x 50ms = 2s
  local i=0
  while [ ! -f "$file" ] && [ "$i" -lt "$max_attempts" ]; do
    sleep 0.05
    i=$((i + 1))
  done
  [ -f "$file" ]
}

read_json_field() {
  local file="$1"
  local field="$2"
  node -e "
    const fs = require('fs');
    const j = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
    const v = j[process.argv[2]];
    console.log(v === undefined || v === null ? '' : v);
  " "$file" "$field"
}

# =============================================================================
# Shared mock backend: a 200-OK server that captures each POSTed body to
# CAPTURE_FILE (overwritten per request). Hook invocations in this file run
# strictly sequentially, so reading CAPTURE_FILE immediately after a hook
# process exits always reflects that hook's own request — the mock writes the
# body to disk before sending the response, and the hook's `await fetch`
# cannot resolve (and the process cannot exit) until the response arrives.
# =============================================================================

MOCK_DIR=$(mktemp -d -t planifest_req004_mock_XXXXXX)
MOCK_JS="$(to_native_path "$MOCK_DIR/mock-capture.mjs")"
READY_FILE="$(to_native_path "$MOCK_DIR/ready")"
CAPTURE_FILE="$(to_native_path "$MOCK_DIR/capture.json")"
# PID-derived port: avoids EADDRINUSE if a prior run's mock server hasn't
# fully released the port yet (same rationale as req-002's mock-500 server).
MOCK_PORT=$((19900 + ($$ % 300)))
MOCK_URL="http://127.0.0.1:$MOCK_PORT"

cat > "$MOCK_JS" << 'MOCK_EOF'
import http from 'node:http';
import { writeFileSync } from 'node:fs';
const [,, port, readyFile, captureFile] = process.argv;
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    try { writeFileSync(captureFile, body); } catch { /* best effort */ }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
});
server.listen(parseInt(port), '127.0.0.1', () => {
  writeFileSync(readyFile, 'ready');
});
MOCK_EOF

node "$MOCK_JS" "$MOCK_PORT" "$READY_FILE" "$CAPTURE_FILE" &
MOCK_PID=$!
wait_for_file "$READY_FILE" 40 >/dev/null

cleanup() {
  kill "$MOCK_PID" 2>/dev/null || true
  rm -rf "$MOCK_DIR" "$SCRATCH_TRANSCRIPT_DIR" 2>/dev/null || true
}
trap cleanup EXIT

# Shared >630KB transcript for context-pressure.mjs's threshold gate (700KB,
# same size used in test-0000018-req-002-hook-failure-marker.sh). Content is
# irrelevant to product_id, so one file is reused across all three
# context-pressure scenarios below.
SCRATCH_TRANSCRIPT_DIR=$(mktemp -d -t planifest_req004_transcript_XXXXXX)
SCRATCH_TRANSCRIPT_DIR="$(to_native_path "$SCRATCH_TRANSCRIPT_DIR")"
UUID_T="d0ffee00-1111-2222-3333-444455556666"
LARGE_TRANSCRIPT="$SCRATCH_TRANSCRIPT_DIR/${UUID_T}.jsonl"
node -e "require('fs').writeFileSync(process.argv[1], Buffer.alloc(700 * 1024))" "$LARGE_TRANSCRIPT"

# Empty PATH dir: simulates a missing `git` binary. Invoked via NODE_BIN's
# absolute path so node itself is always found regardless of this override;
# only the hook's own internal `execFileSync("git", ...)` call is starved.
EMPTY_PATH_DIR=$(mktemp -d -t planifest_req004_nogitpath_XXXXXX)

# =============================================================================
# emit-phase-start.mjs
# =============================================================================

echo ""
echo "=== req-004: emit-phase-start.mjs — git-repo cwd ==="

SCRATCH_GIT_A=$(mktemp -d -t planifest_req004_a_git_XXXXXX)
SCRATCH_GIT_A="$(to_native_path "$SCRATCH_GIT_A")"
git init -q "$SCRATCH_GIT_A" >/dev/null 2>&1
EXPECTED_TOPLEVEL_A="$(git -C "$SCRATCH_GIT_A" rev-parse --show-toplevel)"

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_GIT_A\",\"hook_event_name\":\"PreToolUse\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$PHASE_START" req004-a 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-start: exits 0 for a git-repo cwd"
assert_equals "$EXPECTED_TOPLEVEL_A" "$(read_json_field "$CAPTURE_FILE" product_id)" \
  "emit-phase-start: product_id equals git rev-parse --show-toplevel for a git-repo cwd"

rm -rf "$SCRATCH_GIT_A"

echo ""
echo "=== req-004: emit-phase-start.mjs — non-git-repo cwd ==="

SCRATCH_NOGIT_A=$(mktemp -d -t planifest_req004_a_nogit_XXXXXX)
SCRATCH_NOGIT_A="$(to_native_path "$SCRATCH_NOGIT_A")"

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_NOGIT_A\",\"hook_event_name\":\"PreToolUse\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$PHASE_START" req004-a2 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-start: exits 0 for a non-git-repo cwd"
assert_equals "$SCRATCH_NOGIT_A" "$(read_json_field "$CAPTURE_FILE" product_id)" \
  "emit-phase-start: product_id equals the raw cwd for a non-git-repo cwd"

rm -rf "$SCRATCH_NOGIT_A"

echo ""
echo "=== req-004: emit-phase-start.mjs — missing git binary ==="

SCRATCH_NOGITBIN_A=$(mktemp -d -t planifest_req004_a_nogitbin_XXXXXX)
SCRATCH_NOGITBIN_A="$(to_native_path "$SCRATCH_NOGITBIN_A")"

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_NOGITBIN_A\",\"hook_event_name\":\"PreToolUse\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL PATH="$EMPTY_PATH_DIR" "$NODE_BIN" "$PHASE_START" req004-a3 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-start: exits 0 when the git binary is missing"
assert_equals "" "$output" "emit-phase-start: no stdout/stderr when the git binary is missing"
assert_equals "$SCRATCH_NOGITBIN_A" "$(read_json_field "$CAPTURE_FILE" product_id)" \
  "emit-phase-start: product_id falls back to raw cwd when the git binary is missing"

rm -rf "$SCRATCH_NOGITBIN_A"

# =============================================================================
# emit-phase-end.mjs
# =============================================================================

echo ""
echo "=== req-004: emit-phase-end.mjs — git-repo cwd ==="

SCRATCH_GIT_B=$(mktemp -d -t planifest_req004_b_git_XXXXXX)
SCRATCH_GIT_B="$(to_native_path "$SCRATCH_GIT_B")"
git init -q "$SCRATCH_GIT_B" >/dev/null 2>&1
EXPECTED_TOPLEVEL_B="$(git -C "$SCRATCH_GIT_B" rev-parse --show-toplevel)"

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_GIT_B\",\"hook_event_name\":\"Stop\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$PHASE_END" req004-b 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-end: exits 0 for a git-repo cwd"
assert_equals "$EXPECTED_TOPLEVEL_B" "$(read_json_field "$CAPTURE_FILE" product_id)" \
  "emit-phase-end: product_id equals git rev-parse --show-toplevel for a git-repo cwd"

rm -rf "$SCRATCH_GIT_B"

echo ""
echo "=== req-004: emit-phase-end.mjs — non-git-repo cwd ==="

SCRATCH_NOGIT_B=$(mktemp -d -t planifest_req004_b_nogit_XXXXXX)
SCRATCH_NOGIT_B="$(to_native_path "$SCRATCH_NOGIT_B")"

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_NOGIT_B\",\"hook_event_name\":\"Stop\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$PHASE_END" req004-b2 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-end: exits 0 for a non-git-repo cwd"
assert_equals "$SCRATCH_NOGIT_B" "$(read_json_field "$CAPTURE_FILE" product_id)" \
  "emit-phase-end: product_id equals the raw cwd for a non-git-repo cwd"

rm -rf "$SCRATCH_NOGIT_B"

echo ""
echo "=== req-004: emit-phase-end.mjs — missing git binary ==="

SCRATCH_NOGITBIN_B=$(mktemp -d -t planifest_req004_b_nogitbin_XXXXXX)
SCRATCH_NOGITBIN_B="$(to_native_path "$SCRATCH_NOGITBIN_B")"

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_NOGITBIN_B\",\"hook_event_name\":\"Stop\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL PATH="$EMPTY_PATH_DIR" "$NODE_BIN" "$PHASE_END" req004-b3 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-end: exits 0 when the git binary is missing"
assert_equals "" "$output" "emit-phase-end: no stdout/stderr when the git binary is missing"
assert_equals "$SCRATCH_NOGITBIN_B" "$(read_json_field "$CAPTURE_FILE" product_id)" \
  "emit-phase-end: product_id falls back to raw cwd when the git binary is missing"

rm -rf "$SCRATCH_NOGITBIN_B"

# =============================================================================
# context-pressure.mjs
# =============================================================================

echo ""
echo "=== req-004: context-pressure.mjs — git-repo cwd ==="

SCRATCH_GIT_C=$(mktemp -d -t planifest_req004_c_git_XXXXXX)
SCRATCH_GIT_C="$(to_native_path "$SCRATCH_GIT_C")"
git init -q "$SCRATCH_GIT_C" >/dev/null 2>&1
EXPECTED_TOPLEVEL_C="$(git -C "$SCRATCH_GIT_C" rev-parse --show-toplevel)"

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_GIT_C\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Read\",\"transcript_path\":\"$LARGE_TRANSCRIPT\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$CTX_PRESSURE" 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "context-pressure: exits 0 for a git-repo cwd"
assert_equals "$EXPECTED_TOPLEVEL_C" "$(read_json_field "$CAPTURE_FILE" product_id)" \
  "context-pressure: product_id equals git rev-parse --show-toplevel for a git-repo cwd"

rm -rf "$SCRATCH_GIT_C"

echo ""
echo "=== req-004: context-pressure.mjs — non-git-repo cwd ==="

SCRATCH_NOGIT_C=$(mktemp -d -t planifest_req004_c_nogit_XXXXXX)
SCRATCH_NOGIT_C="$(to_native_path "$SCRATCH_NOGIT_C")"

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_NOGIT_C\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Read\",\"transcript_path\":\"$LARGE_TRANSCRIPT\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$CTX_PRESSURE" 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "context-pressure: exits 0 for a non-git-repo cwd"
assert_equals "$SCRATCH_NOGIT_C" "$(read_json_field "$CAPTURE_FILE" product_id)" \
  "context-pressure: product_id equals the raw cwd for a non-git-repo cwd"

rm -rf "$SCRATCH_NOGIT_C"

echo ""
echo "=== req-004: context-pressure.mjs — missing git binary ==="

SCRATCH_NOGITBIN_C=$(mktemp -d -t planifest_req004_c_nogitbin_XXXXXX)
SCRATCH_NOGITBIN_C="$(to_native_path "$SCRATCH_NOGITBIN_C")"

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_NOGITBIN_C\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Read\",\"transcript_path\":\"$LARGE_TRANSCRIPT\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL PATH="$EMPTY_PATH_DIR" "$NODE_BIN" "$CTX_PRESSURE" 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "context-pressure: exits 0 when the git binary is missing"
assert_equals "" "$output" "context-pressure: no stdout/stderr when the git binary is missing"
assert_equals "$SCRATCH_NOGITBIN_C" "$(read_json_field "$CAPTURE_FILE" product_id)" \
  "context-pressure: product_id falls back to raw cwd when the git binary is missing"

rm -rf "$SCRATCH_NOGITBIN_C" "$EMPTY_PATH_DIR"

print_summary
