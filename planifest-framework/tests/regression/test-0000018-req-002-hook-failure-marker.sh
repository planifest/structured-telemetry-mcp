#!/usr/bin/env bash
# Tests for feature 0000018, req-002: durable hook failure marker.
# Covers: emit-phase-start.mjs, emit-phase-end.mjs, context-pressure.mjs
# writing a best-effort marker file on emission failure, while preserving
# ADR-005's exit-zero/never-block guarantee exactly.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/../.." && pwd)"
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

DEAD_URL="http://127.0.0.1:19998"

# emit-phase-start.mjs's pre-existing dedup guard (ADR-003) stores its flag
# in the SYSTEM-WIDE temp directory (os.tmpdir()/planifest-telemetry/),
# keyed only by session_id+phase — not scoped to this test's scratch cwd.
# A fixed session_id would collide with a flag left behind by a PRIOR run of
# this very test file, silently short-circuiting every emission attempt on
# every run after the first. RUN_ID makes every session_id unique per test
# execution so this file never self-collides across repeated runs.
RUN_ID="$$-$(date +%s%N 2>/dev/null || date +%s)"

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

read_marker_field() {
  local file="$1"
  local field="$2"
  node -e "
    const fs = require('fs');
    const j = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
    const v = j[process.argv[2]];
    console.log(v === undefined || v === null ? '' : v);
  " "$file" "$field"
}

marker_dir_for() {
  printf '%s/plan/.telemetry-failures' "$1"
}

find_marker() {
  # find_marker <marker_dir> <hook-name-prefix>
  local dir="$1"
  local prefix="$2"
  [ -d "$dir" ] || return 1
  find "$dir" -maxdepth 1 -type f -name "${prefix}--*.json" 2>/dev/null | head -n 1
}

# =============================================================================
# Documentation discoverability (AC: format/location documented so req-003
# knows where to look without touching the SKILL.md files owned by req-003/004/007)
# =============================================================================

echo ""
echo "=== req-002: marker format/location documented in each hook file ==="

for f in "$_phase_start_abs" "$_phase_end_abs" "$_ctx_pressure_abs"; do
  name="$(basename "$f")"
  assert_equals "yes" "$(grep -q "plan/.telemetry-failures" "$f" && echo yes || echo no)" \
    "$name: documents plan/.telemetry-failures location"
  assert_equals "yes" "$(grep -q "root_cause_key" "$f" && echo yes || echo no)" \
    "$name: documents root_cause_key marker field"
  assert_equals "yes" "$(grep -q "req-003" "$f" && echo yes || echo no)" \
    "$name: notes req-003 as the marker's consumer"
done

# =============================================================================
# emit-phase-start.mjs: dead backend -> marker written, hook still exits 0
# =============================================================================

echo ""
echo "=== req-002: emit-phase-start.mjs unreachable backend writes a marker ==="

SCRATCH_A=$(mktemp -d -t planifest_req002_a_XXXXXX)
SCRATCH_A="$(to_native_path "$SCRATCH_A")"
INPUT_A="{\"session_id\":\"sess-a-$RUN_ID\",\"cwd\":\"$SCRATCH_A\",\"hook_event_name\":\"PreToolUse\"}"

output=$(printf '%s' "$INPUT_A" | PLANIFEST_TELEMETRY_URL=$DEAD_URL node "$PHASE_START" req002-phase 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-start: still exits 0 when backend is unreachable"

MARKER_DIR_A="$(marker_dir_for "$SCRATCH_A")"
MARKER_A="$(find_marker "$MARKER_DIR_A" "emit-phase-start")"
assert_equals "yes" "$([ -n "$MARKER_A" ] && [ -f "$MARKER_A" ] && echo yes || echo no)" \
  "emit-phase-start: marker file written under plan/.telemetry-failures/"

if [ -n "$MARKER_A" ] && [ -f "$MARKER_A" ]; then
  assert_equals "emit-phase-start" "$(read_marker_field "$MARKER_A" hook)" \
    "emit-phase-start: marker records hook name"
  assert_equals "req002-phase" "$(read_marker_field "$MARKER_A" phase)" \
    "emit-phase-start: marker records phase"
  assert_equals "1" "$(read_marker_field "$MARKER_A" occurrences)" \
    "emit-phase-start: marker starts at occurrences=1"
  ROOT_CAUSE_KEY_A="$(read_marker_field "$MARKER_A" root_cause_key)"
  assert_contains "emit-phase-start" "$ROOT_CAUSE_KEY_A" \
    "emit-phase-start: root_cause_key includes hook name"
  ERROR_TYPE_A="$(read_marker_field "$MARKER_A" error_type)"
  assert_equals "yes" "$([ -n "$ERROR_TYPE_A" ] && echo yes || echo no)" \
    "emit-phase-start: marker records a non-empty error_type"
  ERROR_MESSAGE_A="$(read_marker_field "$MARKER_A" error_message)"
  assert_equals "yes" "$([ -n "$ERROR_MESSAGE_A" ] && echo yes || echo no)" \
    "emit-phase-start: marker records a non-empty error_message"
fi

# Same root cause fires again -> same marker file, occurrences increments
# (req-003 needs this to tell "same failure" from "new, different failure").
# Uses a DIFFERENT session_id (not a second call with INPUT_A) deliberately:
# emit-phase-start.mjs's pre-existing dedup guard (ADR-003) writes its flag
# unconditionally before attempting emission, keyed by session_id+phase — a
# second call with the *same* session_id+phase always short-circuits at the
# guard and never reaches the failure path at all, regardless of outcome.
# Repeated occurrences of one root cause can only be observed across
# genuinely different sessions (i.e. different real pipeline runs hitting
# the same underlying error), which is also what req-003 actually needs to
# detect — not two calls within one deduplicated session+phase.
INPUT_A2="{\"session_id\":\"sess-a2-$RUN_ID\",\"cwd\":\"$SCRATCH_A\",\"hook_event_name\":\"PreToolUse\"}"
output2=$(printf '%s' "$INPUT_A2" | PLANIFEST_TELEMETRY_URL=$DEAD_URL node "$PHASE_START" req002-phase 2>&1)
exit_code2=$?
assert_exit_zero "$exit_code2" "emit-phase-start: still exits 0 on a repeat of the same failure"

MARKER_A_AFTER="$(find_marker "$MARKER_DIR_A" "emit-phase-start")"
assert_equals "$MARKER_A" "$MARKER_A_AFTER" \
  "emit-phase-start: a repeat of the same root cause reuses the same marker file"
if [ -n "$MARKER_A_AFTER" ] && [ -f "$MARKER_A_AFTER" ]; then
  assert_equals "2" "$(read_marker_field "$MARKER_A_AFTER" occurrences)" \
    "emit-phase-start: repeat failure increments occurrences to 2"
fi

MARKER_COUNT_A=$(find "$MARKER_DIR_A" -maxdepth 1 -type f -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
assert_equals "1" "$MARKER_COUNT_A" \
  "emit-phase-start: exactly one marker file exists for one distinct root cause"

rm -rf "$SCRATCH_A"

# =============================================================================
# emit-phase-end.mjs: dead backend -> marker written, hook still exits 0
# =============================================================================

echo ""
echo "=== req-002: emit-phase-end.mjs unreachable backend writes a marker ==="

SCRATCH_B=$(mktemp -d -t planifest_req002_b_XXXXXX)
SCRATCH_B="$(to_native_path "$SCRATCH_B")"
INPUT_B="{\"session_id\":\"sess-b-$RUN_ID\",\"cwd\":\"$SCRATCH_B\",\"hook_event_name\":\"Stop\"}"

output=$(printf '%s' "$INPUT_B" | PLANIFEST_TELEMETRY_URL=$DEAD_URL node "$PHASE_END" req002-phase 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-end: still exits 0 when backend is unreachable"

MARKER_DIR_B="$(marker_dir_for "$SCRATCH_B")"
MARKER_B="$(find_marker "$MARKER_DIR_B" "emit-phase-end")"
assert_equals "yes" "$([ -n "$MARKER_B" ] && [ -f "$MARKER_B" ] && echo yes || echo no)" \
  "emit-phase-end: marker file written under plan/.telemetry-failures/"

if [ -n "$MARKER_B" ] && [ -f "$MARKER_B" ]; then
  assert_equals "emit-phase-end" "$(read_marker_field "$MARKER_B" hook)" \
    "emit-phase-end: marker records hook name"
fi

rm -rf "$SCRATCH_B"

# =============================================================================
# context-pressure.mjs: dead backend -> marker written, hook still exits 0
# =============================================================================

echo ""
echo "=== req-002: context-pressure.mjs unreachable backend writes a marker ==="

SCRATCH_C=$(mktemp -d -t planifest_req002_c_XXXXXX)
SCRATCH_C="$(to_native_path "$SCRATCH_C")"
TRANSCRIPT_DIR_C=$(mktemp -d -t planifest_req002_c_transcript_XXXXXX)
TRANSCRIPT_DIR_C="$(to_native_path "$TRANSCRIPT_DIR_C")"
UUID_C="c0ffee00-1111-2222-3333-444455556666"
LARGE_FILE_C="$TRANSCRIPT_DIR_C/${UUID_C}.jsonl"
# 700 KB > 630 KB threshold, so the hook proceeds to emit
node -e "require('fs').writeFileSync(process.argv[1], Buffer.alloc(700 * 1024))" "$LARGE_FILE_C"

INPUT_C="{\"session_id\":\"sess-c-$RUN_ID\",\"cwd\":\"$SCRATCH_C\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Read\",\"transcript_path\":\"$LARGE_FILE_C\"}"
output=$(printf '%s' "$INPUT_C" | PLANIFEST_TELEMETRY_URL=$DEAD_URL node "$CTX_PRESSURE" 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "context-pressure: still exits 0 when backend is unreachable"
assert_equals "" "$output" "context-pressure: no stdout/stderr output on failure (NFR-001 unchanged)"

MARKER_DIR_C="$(marker_dir_for "$SCRATCH_C")"
MARKER_C="$(find_marker "$MARKER_DIR_C" "context-pressure")"
assert_equals "yes" "$([ -n "$MARKER_C" ] && [ -f "$MARKER_C" ] && echo yes || echo no)" \
  "context-pressure: marker file written under plan/.telemetry-failures/"

if [ -n "$MARKER_C" ] && [ -f "$MARKER_C" ]; then
  assert_equals "context-pressure" "$(read_marker_field "$MARKER_C" hook)" \
    "context-pressure: marker records hook name"
  assert_equals "monitoring" "$(read_marker_field "$MARKER_C" phase)" \
    "context-pressure: marker records phase=monitoring"
fi

rm -rf "$SCRATCH_C" "$TRANSCRIPT_DIR_C"

# =============================================================================
# Distinct root cause -> distinct marker file (AC: "a genuinely new/different
# root cause produces a new marker distinguishable from a prior one")
# =============================================================================

echo ""
echo "=== req-002: a different root cause (HTTP 500) produces a distinct marker ==="

SCRATCH_D=$(mktemp -d -t planifest_req002_d_XXXXXX)
SCRATCH_D="$(to_native_path "$SCRATCH_D")"
MARKER_DIR_D="$(marker_dir_for "$SCRATCH_D")"
INPUT_D_UNREACHABLE="{\"session_id\":\"sess-d-$RUN_ID\",\"cwd\":\"$SCRATCH_D\",\"hook_event_name\":\"PreToolUse\"}"

# First: connection-refused failure.
printf '%s' "$INPUT_D_UNREACHABLE" | PLANIFEST_TELEMETRY_URL=$DEAD_URL node "$PHASE_START" req002-d >/dev/null 2>&1
MARKER_D1="$(find_marker "$MARKER_DIR_D" "emit-phase-start")"
assert_equals "yes" "$([ -n "$MARKER_D1" ] && echo yes || echo no)" \
  "distinct root cause: first (connection-refused) marker written"

# Second: a mock server that always answers HTTP 500 — a structurally
# different root cause (http_500 vs. a connection-refused TypeError).
MOCK_500_DIR=$(mktemp -d -t planifest_req002_mock500_XXXXXX)
MOCK_500_JS="$(to_native_path "$MOCK_500_DIR/mock-500.mjs")"
READY_500="$(to_native_path "$MOCK_500_DIR/ready")"
# PID-derived, not fixed: avoids EADDRINUSE if a prior run's mock server
# hasn't fully released the port yet (observed flakiness with a fixed port
# under rapid repeated test invocations).
MOCK_500_PORT=$((19500 + ($$ % 400)))
cat > "$MOCK_500_JS" << 'MOCK_EOF'
import http from 'node:http';
import { writeFileSync } from 'node:fs';
const [,, port, readyFile] = process.argv;
const server = http.createServer((req, res) => {
  req.on('data', () => {});
  req.on('end', () => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"error":"boom"}');
  });
});
server.listen(parseInt(port), '127.0.0.1', () => {
  writeFileSync(readyFile, 'ready');
});
MOCK_EOF

node "$MOCK_500_JS" "$MOCK_500_PORT" "$READY_500" &
MOCK_500_PID=$!
wait_for_file "$READY_500" 40

# Different session_id from the connection-refused call above (same reason as
# scenario A): reusing session_id+phase would hit emit-phase-start.mjs's
# pre-existing dedup guard (ADR-003) and skip the emission attempt entirely,
# never reaching the HTTP-500 failure path at all.
INPUT_D_500="{\"session_id\":\"sess-d2-$RUN_ID\",\"cwd\":\"$SCRATCH_D\",\"hook_event_name\":\"PreToolUse\"}"
printf '%s' "$INPUT_D_500" | PLANIFEST_TELEMETRY_URL=http://127.0.0.1:$MOCK_500_PORT \
  node "$PHASE_START" req002-d >/dev/null 2>&1
exit_code_500=$?
assert_exit_zero "$exit_code_500" "distinct root cause: HTTP 500 case still exits 0"

kill "$MOCK_500_PID" 2>/dev/null || true

MARKER_COUNT_D=$(find "$MARKER_DIR_D" -maxdepth 1 -type f -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
assert_equals "2" "$MARKER_COUNT_D" \
  "distinct root cause: two distinct marker files now exist (connection-refused + http_500)"

MARKER_D2="$(find "$MARKER_DIR_D" -maxdepth 1 -type f -name "*http-500*.json" 2>/dev/null | head -n 1)"
if [ -z "$MARKER_D2" ]; then
  # Fall back to whichever marker isn't MARKER_D1, in case the http_500 slug
  # normalises differently than expected.
  MARKER_D2="$(find "$MARKER_DIR_D" -maxdepth 1 -type f -name "*.json" ! -name "$(basename "$MARKER_D1")" 2>/dev/null | head -n 1)"
fi
assert_equals "yes" "$([ -n "$MARKER_D2" ] && [ "$MARKER_D2" != "$MARKER_D1" ] && echo yes || echo no)" \
  "distinct root cause: HTTP 500 failure got its own marker file, distinct from the connection-refused one"

rm -rf "$SCRATCH_D" "$MOCK_500_DIR"

# =============================================================================
# Marker write itself fails -> hook must STILL exit 0 (ADR-005 preserved even
# when the best-effort marker write fails, per req-002's second AC)
# =============================================================================

echo ""
echo "=== req-002: marker write failure never causes a non-zero exit ==="

SCRATCH_E=$(mktemp -d -t planifest_req002_e_XXXXXX)
SCRATCH_E="$(to_native_path "$SCRATCH_E")"
# Force mkdirSync(plan/.telemetry-failures) to fail: pre-create "plan" as a
# plain FILE (not a directory) so the marker directory can never be created.
mkdir -p "$SCRATCH_E"
: > "$SCRATCH_E/plan"

INPUT_E="{\"session_id\":\"sess-e-$RUN_ID\",\"cwd\":\"$SCRATCH_E\",\"hook_event_name\":\"PreToolUse\"}"
output=$(printf '%s' "$INPUT_E" | PLANIFEST_TELEMETRY_URL=$DEAD_URL node "$PHASE_START" req002-e 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-start: exits 0 even when the marker write itself cannot succeed"
assert_equals "" "$output" "emit-phase-start: no output even when the marker write itself fails"

rm -rf "$SCRATCH_E"

print_summary
