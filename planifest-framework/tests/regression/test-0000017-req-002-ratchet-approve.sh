#!/usr/bin/env bash
# Tests for feature 0000017-ratchet-forgery-detection-and-telemetry-schema-spec
# req-002: ratchet-marker-approval-mechanism (ADR-001)
#
# Covers:
#   (a) new `path | reason | timestamp` marker format is parsed correctly
#   (b) a malformed line (missing `|` or missing a field) is treated as no-approval
#   (c) an uncommitted-approval scenario blocks with an explicit message naming
#       the pending path and instructing the approver to commit it first
#   (d) a consumed approval's full record appears in the permanent audit log
#   (e) a reason field over 500 chars is truncated in the audit log

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS="$FRAMEWORK/hooks/enforcement"
RATCHET="$HOOKS/ratchet-check.mjs"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# -----------------------------------------------------------------------
# Fixture helpers
# -----------------------------------------------------------------------

mk_proj() {
  # Creates a fresh project fixture with an active loop and a requirements
  # doc with two acceptance criteria. Echoes the project root path.
  local proj="$1"
  mkdir -p "$proj/plan/current"
  cat > "$proj/plan/current/loop-state-design_critic.md" <<'MD'
---
status: "active"
---
# Loop State: design_critic
MD
  cat > "$proj/plan/current/requirements-doc.md" <<'MD'
# Requirement: REQ-001 - Demo
## Acceptance Criteria
- [ ] criterion alpha holds
- [ ] criterion beta holds
MD
  echo "$proj"
}

WEAK=$'# Requirement: REQ-001 - Demo\n## Acceptance Criteria\n- [ ] criterion alpha holds'

# Runs ratchet-check.mjs for a Write of `content` to `file_path` with cwd `proj`.
# Returns "<exit-code>\x1f<stdout>" so callers can split both out.
run_ratchet_capture() {
  local file_path="$1" content="$2" proj="$3"
  local payload
  payload=$(node -e '
    const [fp, content] = process.argv.slice(1);
    process.stdout.write(JSON.stringify({tool_name:"Write",tool_input:{file_path:fp,content}}));
  ' "$file_path" "$content")
  local out rc
  out=$(cd "$proj" && printf '%s' "$payload" | node "$RATCHET" 2>/dev/null)
  rc=$?
  printf '%s\x1f%s' "$rc" "$out"
}

split_rc()  { local s="$1"; printf '%s' "${s%%$'\x1f'*}"; }
split_out() { local s="$1"; printf '%s' "${s#*$'\x1f'}"; }

file_contains() { grep -qF "$2" "$1" 2>/dev/null && echo "yes" || echo "no"; }
file_exists()   { [ -f "$1" ] && echo "yes" || echo "no"; }

assert_file_exists() {
  local path="$1" label="$2"
  if [ -e "$path" ]; then
    assert_equals "0" "0" "$label"
  else
    assert_equals "exists" "missing" "$label: $path"
  fi
}

# -----------------------------------------------------------------------
echo ""
echo "=== req-002: hook exists ==="
# -----------------------------------------------------------------------

assert_file_exists "$RATCHET" "req-002: ratchet-check.mjs exists"

# -----------------------------------------------------------------------
echo ""
echo "=== req-002(a)+(d): new 'path | reason | timestamp' format parses and consumption is audited ==="
# -----------------------------------------------------------------------

PROJ_A="$TMP/proj_a"; mk_proj "$PROJ_A" >/dev/null

printf '%s\n' "plan/current/requirements-doc.md | rewording criterion beta after human review | 2026-07-26T10:00:00Z" \
  > "$PROJ_A/plan/current/.ratchet-approve"

RESULT=$(run_ratchet_capture "$PROJ_A/plan/current/requirements-doc.md" "$WEAK" "$PROJ_A")
RC=$(split_rc "$RESULT")
assert_equals "0" "$RC" "req-002a: well-formed pipe-delimited approval passes the weakening write"

if [ -s "$PROJ_A/plan/current/.ratchet-approve" ]; then
  assert_equals "consumed" "still-present" "req-002a: matched approval line consumed (marker emptied/removed)"
else
  assert_equals "0" "0" "req-002a: matched approval line consumed (marker emptied/removed)"
fi

AUDIT_A="$PROJ_A/plan/ratchet-audit-log.md"
assert_equals "yes" "$(file_exists "$AUDIT_A")" \
  "req-002d: permanent audit log file created"
assert_equals "yes" "$(file_contains "$AUDIT_A" "plan/current/requirements-doc.md")" \
  "req-002d: audit log records the approved path"
assert_equals "yes" "$(file_contains "$AUDIT_A" "rewording criterion beta after human review")" \
  "req-002d: audit log records the verbatim reason"
assert_equals "yes" "$(file_contains "$AUDIT_A" "2026-07-26T10:00:00Z")" \
  "req-002d: audit log records the timestamp"

# -----------------------------------------------------------------------
echo ""
echo "=== req-002(b): malformed lines are treated as no-approval-present ==="
# -----------------------------------------------------------------------

# Missing the '|' delimiter entirely (old ADR-004 bare-path format).
PROJ_B1="$TMP/proj_b1"; mk_proj "$PROJ_B1" >/dev/null
printf '%s\n' "plan/current/requirements-doc.md" > "$PROJ_B1/plan/current/.ratchet-approve"

RESULT=$(run_ratchet_capture "$PROJ_B1/plan/current/requirements-doc.md" "$WEAK" "$PROJ_B1")
RC=$(split_rc "$RESULT")
OUT=$(split_out "$RESULT")
assert_equals "2" "$RC" "req-002b: line missing '|' delimiter is treated as no-approval (blocked)"
assert_equals "yes" "$(printf '%s' "$OUT" | grep -qF "while a loop is active" && echo yes || echo no)" \
  "req-002b: block uses the standard weakening message, not the uncommitted-approval message"

# Missing a field (empty reason between the pipes).
PROJ_B2="$TMP/proj_b2"; mk_proj "$PROJ_B2" >/dev/null
printf '%s\n' "plan/current/requirements-doc.md |  | 2026-07-26T10:00:00Z" \
  > "$PROJ_B2/plan/current/.ratchet-approve"

RESULT=$(run_ratchet_capture "$PROJ_B2/plan/current/requirements-doc.md" "$WEAK" "$PROJ_B2")
RC=$(split_rc "$RESULT")
assert_equals "2" "$RC" "req-002b: line missing a field (empty reason) is treated as no-approval (blocked)"

# -----------------------------------------------------------------------
echo ""
echo "=== req-002(c): uncommitted approval blocks with an explicit message ==="
# -----------------------------------------------------------------------

PROJ_C="$TMP/proj_c"; mk_proj "$PROJ_C" >/dev/null
(
  cd "$PROJ_C" || exit 1
  git init -q
  git config user.email "test@example.com"
  git config user.name "Test"
  git add -A
  git commit -q -m "baseline fixture"
)

# Approval line is written but never committed.
printf '%s\n' "plan/current/requirements-doc.md | approved verbally, forgot to commit | 2026-07-26T11:00:00Z" \
  > "$PROJ_C/plan/current/.ratchet-approve"

RESULT=$(run_ratchet_capture "$PROJ_C/plan/current/requirements-doc.md" "$WEAK" "$PROJ_C")
RC=$(split_rc "$RESULT")
OUT=$(split_out "$RESULT")
assert_equals "2" "$RC" "req-002c: weakening write is blocked when approval is uncommitted"
assert_equals "yes" "$(printf '%s' "$OUT" | grep -qi "uncommitted" && echo yes || echo no)" \
  "req-002c: block message explicitly names the uncommitted state"
assert_equals "yes" "$(printf '%s' "$OUT" | grep -qF "plan/current/.ratchet-approve" && echo yes || echo no)" \
  "req-002c: block message names the pending marker path"
assert_equals "yes" "$(printf '%s' "$OUT" | grep -qi "commit" && echo yes || echo no)" \
  "req-002c: block message instructs the approver to commit first"

if [ -s "$PROJ_C/plan/current/.ratchet-approve" ]; then
  assert_equals "0" "0" "req-002c: approval line is not consumed while uncommitted"
else
  assert_equals "still-present" "consumed" "req-002c: approval line is not consumed while uncommitted"
fi

# -----------------------------------------------------------------------
echo ""
echo "=== req-002(e): reason field over 500 chars is truncated in the audit log ==="
# -----------------------------------------------------------------------

PROJ_E="$TMP/proj_e"; mk_proj "$PROJ_E" >/dev/null

LONG_REASON=$(printf 'r%.0s' $(seq 1 600))
TAIL_MARKER="ZZZ_END_OF_LONG_REASON_ZZZ"
LONG_REASON="${LONG_REASON}${TAIL_MARKER}"

printf '%s\n' "plan/current/requirements-doc.md | ${LONG_REASON} | 2026-07-26T12:00:00Z" \
  > "$PROJ_E/plan/current/.ratchet-approve"

RESULT=$(run_ratchet_capture "$PROJ_E/plan/current/requirements-doc.md" "$WEAK" "$PROJ_E")
RC=$(split_rc "$RESULT")
assert_equals "0" "$RC" "req-002e: long-reason approval still passes the weakening write"

AUDIT_E="$PROJ_E/plan/ratchet-audit-log.md"
assert_equals "yes" "$(file_exists "$AUDIT_E")" \
  "req-002e: audit log created for long-reason approval"
assert_equals "no" "$(file_contains "$AUDIT_E" "$TAIL_MARKER")" \
  "req-002e: audit log does not contain the un-truncated tail of a >500 char reason"
assert_equals "yes" "$(printf '%s' "$(cat "$AUDIT_E" 2>/dev/null)" | grep -qi "truncated" && echo yes || echo no)" \
  "req-002e: audit log marks the truncation explicitly"

print_summary
