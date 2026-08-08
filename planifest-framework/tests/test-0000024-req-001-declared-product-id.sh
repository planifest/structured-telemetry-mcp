#!/usr/bin/env bash
# Tests for feature 0000024, req-001: declared product_id for telemetry.
# Covers: emit-phase-start.mjs, emit-phase-end.mjs, context-pressure.mjs
# each sourcing `product_id` from product.yml's top-level `id` field instead
# of a git-derived filesystem path (supersedes the git-path assertions in
# test-0000023-req-004-telemetry-product-id-emission.sh).
#
# Four cases per hook (req-001 acceptance criteria):
#   1. declared id present -> product_id equals the declared id
#   2. product.yml absent -> failure marker written, hook exits 0, no POST
#   3. product.yml has unparseable YAML on the id line -> same as (2)
#   4. product.yml parses but has no `id` field -> same as (2)
# None of cases 2-4 ever produces a path-shaped product_id.

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

# Unique per test execution so repeated runs never collide on
# emit-phase-start.mjs's session_id+phase dedup guard (ADR-003).
RUN_ID="$$-$(date +%s%N 2>/dev/null || date +%s)"
SESSION_COUNTER=0
next_session() {
  SESSION_COUNTER=$((SESSION_COUNTER + 1))
  printf 'sess-%s-%s' "$RUN_ID" "$SESSION_COUNTER"
}

to_native_path() {
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

SENTINEL='{"product_id":"__UNTOUCHED_SENTINEL__"}'
reset_capture() {
  printf '%s' "$SENTINEL" > "$CAPTURE_FILE"
}

# =============================================================================
# Shared mock backend: a 200-OK server that captures each POSTed body to
# CAPTURE_FILE (overwritten per request). Used for the "declared id present"
# cases (product_id must equal the declared id in the captured body) AND for
# the failure cases (CAPTURE_FILE is reset to a sentinel before each failing
# invocation; if it still holds the sentinel afterward, no POST ever reached
# the mock — proving the hook never emitted, path-shaped or otherwise).
# =============================================================================

MOCK_DIR=$(mktemp -d -t planifest_req001_mock_XXXXXX)
MOCK_JS="$(to_native_path "$MOCK_DIR/mock-capture.mjs")"
READY_FILE="$(to_native_path "$MOCK_DIR/ready")"
CAPTURE_FILE="$(to_native_path "$MOCK_DIR/capture.json")"
MOCK_PORT=$((19700 + ($$ % 300)))
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

# Shared >630KB transcript for context-pressure.mjs's threshold gate.
SCRATCH_TRANSCRIPT_DIR=$(mktemp -d -t planifest_req001_transcript_XXXXXX)
SCRATCH_TRANSCRIPT_DIR="$(to_native_path "$SCRATCH_TRANSCRIPT_DIR")"
UUID_T="a0ffee00-1111-2222-3333-444455556666"
LARGE_TRANSCRIPT="$SCRATCH_TRANSCRIPT_DIR/${UUID_T}.jsonl"
node -e "require('fs').writeFileSync(process.argv[1], Buffer.alloc(700 * 1024))" "$LARGE_TRANSCRIPT"

DECLARED_ID="test-product-alpha"

# =============================================================================
# emit-phase-start.mjs
# =============================================================================

echo ""
echo "=== req-001: emit-phase-start.mjs — declared id present ==="

SCRATCH_A1=$(mktemp -d -t planifest_req001_a1_XXXXXX)
SCRATCH_A1="$(to_native_path "$SCRATCH_A1")"
cat > "$SCRATCH_A1/product.yml" << EOF
id: "$DECLARED_ID"
name: "Test Product"
version: "1.2.3"
versionPolicy: "explicit"
EOF

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_A1\",\"hook_event_name\":\"PreToolUse\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$PHASE_START" req001-a1 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-start: exits 0 with a declared product id"
assert_equals "$DECLARED_ID" "$(read_json_field "$CAPTURE_FILE" product_id)" \
  "emit-phase-start: product_id equals the declared id from product.yml"

rm -rf "$SCRATCH_A1"

echo ""
echo "=== req-001: emit-phase-start.mjs — product.yml absent ==="

SCRATCH_A2=$(mktemp -d -t planifest_req001_a2_XXXXXX)
SCRATCH_A2="$(to_native_path "$SCRATCH_A2")"
reset_capture

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_A2\",\"hook_event_name\":\"PreToolUse\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$PHASE_START" req001-a2 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-start: exits 0 when product.yml is absent"
assert_equals "$SENTINEL" "$(cat "$CAPTURE_FILE")" \
  "emit-phase-start: no POST ever reached the backend when product.yml is absent"

MARKER_DIR_A2="$(marker_dir_for "$SCRATCH_A2")"
MARKER_A2="$(find_marker "$MARKER_DIR_A2" "emit-phase-start")"
assert_equals "yes" "$([ -n "$MARKER_A2" ] && [ -f "$MARKER_A2" ] && echo yes || echo no)" \
  "emit-phase-start: failure marker written when product.yml is absent"
if [ -n "$MARKER_A2" ] && [ -f "$MARKER_A2" ]; then
  assert_contains "product.yml" "$(read_marker_field "$MARKER_A2" error_message)" \
    "emit-phase-start: marker error_message references product.yml (absent case)"
fi

rm -rf "$SCRATCH_A2"

echo ""
echo "=== req-001: emit-phase-start.mjs — product.yml malformed (unbalanced quoting) ==="

SCRATCH_A3=$(mktemp -d -t planifest_req001_a3_XXXXXX)
SCRATCH_A3="$(to_native_path "$SCRATCH_A3")"
cat > "$SCRATCH_A3/product.yml" << 'EOF'
id: "broken
name: "Test Product"
EOF
reset_capture

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_A3\",\"hook_event_name\":\"PreToolUse\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$PHASE_START" req001-a3 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-start: exits 0 when product.yml id line is malformed YAML"
assert_equals "$SENTINEL" "$(cat "$CAPTURE_FILE")" \
  "emit-phase-start: no POST ever reached the backend when product.yml is malformed"

MARKER_DIR_A3="$(marker_dir_for "$SCRATCH_A3")"
MARKER_A3="$(find_marker "$MARKER_DIR_A3" "emit-phase-start")"
assert_equals "yes" "$([ -n "$MARKER_A3" ] && [ -f "$MARKER_A3" ] && echo yes || echo no)" \
  "emit-phase-start: failure marker written when product.yml is malformed"
if [ -n "$MARKER_A3" ] && [ -f "$MARKER_A3" ]; then
  assert_contains "product.yml" "$(read_marker_field "$MARKER_A3" error_message)" \
    "emit-phase-start: marker error_message references product.yml (malformed case)"
fi

rm -rf "$SCRATCH_A3"

echo ""
echo "=== req-001: emit-phase-start.mjs — product.yml present without an id field ==="

SCRATCH_A4=$(mktemp -d -t planifest_req001_a4_XXXXXX)
SCRATCH_A4="$(to_native_path "$SCRATCH_A4")"
cat > "$SCRATCH_A4/product.yml" << 'EOF'
name: "Test Product"
version: "1.0.0"
versionPolicy: "explicit"
EOF
reset_capture

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_A4\",\"hook_event_name\":\"PreToolUse\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$PHASE_START" req001-a4 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-start: exits 0 when product.yml has no id field"
assert_equals "$SENTINEL" "$(cat "$CAPTURE_FILE")" \
  "emit-phase-start: no POST ever reached the backend when product.yml has no id field"

MARKER_DIR_A4="$(marker_dir_for "$SCRATCH_A4")"
MARKER_A4="$(find_marker "$MARKER_DIR_A4" "emit-phase-start")"
assert_equals "yes" "$([ -n "$MARKER_A4" ] && [ -f "$MARKER_A4" ] && echo yes || echo no)" \
  "emit-phase-start: failure marker written when product.yml has no id field"
if [ -n "$MARKER_A4" ] && [ -f "$MARKER_A4" ]; then
  assert_contains "product.yml" "$(read_marker_field "$MARKER_A4" error_message)" \
    "emit-phase-start: marker error_message references product.yml (missing id case)"
fi

rm -rf "$SCRATCH_A4"

# =============================================================================
# emit-phase-end.mjs
# =============================================================================

echo ""
echo "=== req-001: emit-phase-end.mjs — declared id present ==="

SCRATCH_B1=$(mktemp -d -t planifest_req001_b1_XXXXXX)
SCRATCH_B1="$(to_native_path "$SCRATCH_B1")"
cat > "$SCRATCH_B1/product.yml" << EOF
id: "$DECLARED_ID"
name: "Test Product"
version: "1.2.3"
versionPolicy: "explicit"
EOF

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_B1\",\"hook_event_name\":\"Stop\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$PHASE_END" req001-b1 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-end: exits 0 with a declared product id"
assert_equals "$DECLARED_ID" "$(read_json_field "$CAPTURE_FILE" product_id)" \
  "emit-phase-end: product_id equals the declared id from product.yml"

rm -rf "$SCRATCH_B1"

echo ""
echo "=== req-001: emit-phase-end.mjs — product.yml absent ==="

SCRATCH_B2=$(mktemp -d -t planifest_req001_b2_XXXXXX)
SCRATCH_B2="$(to_native_path "$SCRATCH_B2")"
reset_capture

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_B2\",\"hook_event_name\":\"Stop\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$PHASE_END" req001-b2 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-end: exits 0 when product.yml is absent"
assert_equals "$SENTINEL" "$(cat "$CAPTURE_FILE")" \
  "emit-phase-end: no POST ever reached the backend when product.yml is absent"

MARKER_DIR_B2="$(marker_dir_for "$SCRATCH_B2")"
MARKER_B2="$(find_marker "$MARKER_DIR_B2" "emit-phase-end")"
assert_equals "yes" "$([ -n "$MARKER_B2" ] && [ -f "$MARKER_B2" ] && echo yes || echo no)" \
  "emit-phase-end: failure marker written when product.yml is absent"
if [ -n "$MARKER_B2" ] && [ -f "$MARKER_B2" ]; then
  assert_contains "product.yml" "$(read_marker_field "$MARKER_B2" error_message)" \
    "emit-phase-end: marker error_message references product.yml (absent case)"
fi

rm -rf "$SCRATCH_B2"

echo ""
echo "=== req-001: emit-phase-end.mjs — product.yml malformed (unbalanced quoting) ==="

SCRATCH_B3=$(mktemp -d -t planifest_req001_b3_XXXXXX)
SCRATCH_B3="$(to_native_path "$SCRATCH_B3")"
cat > "$SCRATCH_B3/product.yml" << 'EOF'
id: "broken
name: "Test Product"
EOF
reset_capture

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_B3\",\"hook_event_name\":\"Stop\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$PHASE_END" req001-b3 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-end: exits 0 when product.yml id line is malformed YAML"
assert_equals "$SENTINEL" "$(cat "$CAPTURE_FILE")" \
  "emit-phase-end: no POST ever reached the backend when product.yml is malformed"

MARKER_DIR_B3="$(marker_dir_for "$SCRATCH_B3")"
MARKER_B3="$(find_marker "$MARKER_DIR_B3" "emit-phase-end")"
assert_equals "yes" "$([ -n "$MARKER_B3" ] && [ -f "$MARKER_B3" ] && echo yes || echo no)" \
  "emit-phase-end: failure marker written when product.yml is malformed"
if [ -n "$MARKER_B3" ] && [ -f "$MARKER_B3" ]; then
  assert_contains "product.yml" "$(read_marker_field "$MARKER_B3" error_message)" \
    "emit-phase-end: marker error_message references product.yml (malformed case)"
fi

rm -rf "$SCRATCH_B3"

echo ""
echo "=== req-001: emit-phase-end.mjs — product.yml present without an id field ==="

SCRATCH_B4=$(mktemp -d -t planifest_req001_b4_XXXXXX)
SCRATCH_B4="$(to_native_path "$SCRATCH_B4")"
cat > "$SCRATCH_B4/product.yml" << 'EOF'
name: "Test Product"
version: "1.0.0"
versionPolicy: "explicit"
EOF
reset_capture

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_B4\",\"hook_event_name\":\"Stop\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$PHASE_END" req001-b4 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "emit-phase-end: exits 0 when product.yml has no id field"
assert_equals "$SENTINEL" "$(cat "$CAPTURE_FILE")" \
  "emit-phase-end: no POST ever reached the backend when product.yml has no id field"

MARKER_DIR_B4="$(marker_dir_for "$SCRATCH_B4")"
MARKER_B4="$(find_marker "$MARKER_DIR_B4" "emit-phase-end")"
assert_equals "yes" "$([ -n "$MARKER_B4" ] && [ -f "$MARKER_B4" ] && echo yes || echo no)" \
  "emit-phase-end: failure marker written when product.yml has no id field"
if [ -n "$MARKER_B4" ] && [ -f "$MARKER_B4" ]; then
  assert_contains "product.yml" "$(read_marker_field "$MARKER_B4" error_message)" \
    "emit-phase-end: marker error_message references product.yml (missing id case)"
fi

rm -rf "$SCRATCH_B4"

# =============================================================================
# context-pressure.mjs
# =============================================================================

echo ""
echo "=== req-001: context-pressure.mjs — declared id present ==="

SCRATCH_C1=$(mktemp -d -t planifest_req001_c1_XXXXXX)
SCRATCH_C1="$(to_native_path "$SCRATCH_C1")"
cat > "$SCRATCH_C1/product.yml" << EOF
id: "$DECLARED_ID"
name: "Test Product"
version: "1.2.3"
versionPolicy: "explicit"
EOF

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_C1\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Read\",\"transcript_path\":\"$LARGE_TRANSCRIPT\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$CTX_PRESSURE" 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "context-pressure: exits 0 with a declared product id"
assert_equals "$DECLARED_ID" "$(read_json_field "$CAPTURE_FILE" product_id)" \
  "context-pressure: product_id equals the declared id from product.yml"

rm -rf "$SCRATCH_C1"

echo ""
echo "=== req-001: context-pressure.mjs — product.yml absent ==="

SCRATCH_C2=$(mktemp -d -t planifest_req001_c2_XXXXXX)
SCRATCH_C2="$(to_native_path "$SCRATCH_C2")"
reset_capture

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_C2\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Read\",\"transcript_path\":\"$LARGE_TRANSCRIPT\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$CTX_PRESSURE" 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "context-pressure: exits 0 when product.yml is absent"
assert_equals "$SENTINEL" "$(cat "$CAPTURE_FILE")" \
  "context-pressure: no POST ever reached the backend when product.yml is absent"

MARKER_DIR_C2="$(marker_dir_for "$SCRATCH_C2")"
MARKER_C2="$(find_marker "$MARKER_DIR_C2" "context-pressure")"
assert_equals "yes" "$([ -n "$MARKER_C2" ] && [ -f "$MARKER_C2" ] && echo yes || echo no)" \
  "context-pressure: failure marker written when product.yml is absent"
if [ -n "$MARKER_C2" ] && [ -f "$MARKER_C2" ]; then
  assert_contains "product.yml" "$(read_marker_field "$MARKER_C2" error_message)" \
    "context-pressure: marker error_message references product.yml (absent case)"
fi

rm -rf "$SCRATCH_C2"

echo ""
echo "=== req-001: context-pressure.mjs — product.yml malformed (unbalanced quoting) ==="

SCRATCH_C3=$(mktemp -d -t planifest_req001_c3_XXXXXX)
SCRATCH_C3="$(to_native_path "$SCRATCH_C3")"
cat > "$SCRATCH_C3/product.yml" << 'EOF'
id: "broken
name: "Test Product"
EOF
reset_capture

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_C3\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Read\",\"transcript_path\":\"$LARGE_TRANSCRIPT\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$CTX_PRESSURE" 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "context-pressure: exits 0 when product.yml id line is malformed YAML"
assert_equals "$SENTINEL" "$(cat "$CAPTURE_FILE")" \
  "context-pressure: no POST ever reached the backend when product.yml is malformed"

MARKER_DIR_C3="$(marker_dir_for "$SCRATCH_C3")"
MARKER_C3="$(find_marker "$MARKER_DIR_C3" "context-pressure")"
assert_equals "yes" "$([ -n "$MARKER_C3" ] && [ -f "$MARKER_C3" ] && echo yes || echo no)" \
  "context-pressure: failure marker written when product.yml is malformed"
if [ -n "$MARKER_C3" ] && [ -f "$MARKER_C3" ]; then
  assert_contains "product.yml" "$(read_marker_field "$MARKER_C3" error_message)" \
    "context-pressure: marker error_message references product.yml (malformed case)"
fi

rm -rf "$SCRATCH_C3"

echo ""
echo "=== req-001: context-pressure.mjs — product.yml present without an id field ==="

SCRATCH_C4=$(mktemp -d -t planifest_req001_c4_XXXXXX)
SCRATCH_C4="$(to_native_path "$SCRATCH_C4")"
cat > "$SCRATCH_C4/product.yml" << 'EOF'
name: "Test Product"
version: "1.0.0"
versionPolicy: "explicit"
EOF
reset_capture

SID="$(next_session)"
INPUT="{\"session_id\":\"$SID\",\"cwd\":\"$SCRATCH_C4\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Read\",\"transcript_path\":\"$LARGE_TRANSCRIPT\"}"
output=$(printf '%s' "$INPUT" | PLANIFEST_TELEMETRY_URL=$MOCK_URL node "$CTX_PRESSURE" 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "context-pressure: exits 0 when product.yml has no id field"
assert_equals "$SENTINEL" "$(cat "$CAPTURE_FILE")" \
  "context-pressure: no POST ever reached the backend when product.yml has no id field"

MARKER_DIR_C4="$(marker_dir_for "$SCRATCH_C4")"
MARKER_C4="$(find_marker "$MARKER_DIR_C4" "context-pressure")"
assert_equals "yes" "$([ -n "$MARKER_C4" ] && [ -f "$MARKER_C4" ] && echo yes || echo no)" \
  "context-pressure: failure marker written when product.yml has no id field"
if [ -n "$MARKER_C4" ] && [ -f "$MARKER_C4" ]; then
  assert_contains "product.yml" "$(read_marker_field "$MARKER_C4" error_message)" \
    "context-pressure: marker error_message references product.yml (missing id case)"
fi

rm -rf "$SCRATCH_C4"

print_summary
