#!/usr/bin/env bash
# Tests for feature 0000025, req-007: Scope Lock default-drafted, batch-presented.
#
# This is a prose skill-file change (ADR-003 superseding 0000017-ADR-003), so
# these are content-assertion tests: grep the SKILL.md files to confirm they
# now describe always-dispatch/batch-present behavior for the Scope Lock
# Challenge's four scenario-path questions, and no longer describe the
# opt-in-per-question sequential default as the primary flow.
#
# Covers:
#   - planifest-framework/skills/planifest-orchestrator/SKILL.md Scope Lock Challenge section
#   - planifest-framework/skills/planifest-scope-lock-agent/SKILL.md Invocation Contract + description
#
# Targets planifest-framework/skills/ (the tracked, canonical source) rather
# than .claude/skills/ (a locally-installed, gitignored runtime copy synced
# from planifest-framework/skills/ by setup.sh — not committed, and not
# guaranteed present or in sync in a fresh clone or CI checkout).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"

ORCH_SKILL="$FRAMEWORK/skills/planifest-orchestrator/SKILL.md"
SCOPE_LOCK_SKILL="$FRAMEWORK/skills/planifest-scope-lock-agent/SKILL.md"

# Local file-content assertions. Deliberately do NOT use assert_contains
# (from helpers/assert.sh) here: it prints the full haystack on failure,
# and the haystack for these tests is an entire multi-KB SKILL.md file —
# noisy and pointless for a fixed-string content check. These wrappers use
# `grep -F` directly against the file and only ever print PASS/FAIL + the
# needle, matching the fixed-string (not haystack-dump) reporting style
# appropriate for whole-file content assertions.
assert_file_contains() {
  local file="$1"
  local needle="$2"
  local message="$3"

  if grep -qF -- "$needle" "$file"; then
    echo "  PASS: $message"
    ((PASS++)) || true
  else
    echo "  FAIL: $message"
    echo "        needle (expected present): $needle"
    ((FAIL++)) || true
  fi
}

assert_file_not_contains() {
  local file="$1"
  local needle="$2"
  local message="$3"

  if grep -qF -- "$needle" "$file"; then
    echo "  FAIL: $message"
    echo "        needle (should be absent): $needle"
    ((FAIL++)) || true
  else
    echo "  PASS: $message"
    ((PASS++)) || true
  fi
}

[ -f "$ORCH_SKILL" ] || { echo "FATAL: $ORCH_SKILL not found"; exit 1; }
[ -f "$SCOPE_LOCK_SKILL" ] || { echo "FATAL: $SCOPE_LOCK_SKILL not found"; exit 1; }

# =============================================================================
# planifest-orchestrator/SKILL.md — Scope Lock Challenge section
# =============================================================================

echo ""
echo "=== req-007: orchestrator SKILL.md — default parallel dispatch, no opt-in ==="

assert_file_contains "$ORCH_SKILL" "planifest-scope-lock-agent" \
  "orchestrator: still references planifest-scope-lock-agent dispatch"

assert_file_contains "$ORCH_SKILL" "in parallel, by default" \
  "orchestrator: dispatch is described as parallel and default (no opt-in)"

assert_file_contains "$ORCH_SKILL" "all four scenario-path questions" \
  "orchestrator: dispatch covers all four scenario-path questions"

echo ""
echo "=== req-007: orchestrator SKILL.md — batch presentation ==="

assert_file_contains "$ORCH_SKILL" "Batch presentation" \
  "orchestrator: batch presentation is a named step"

assert_file_contains "$ORCH_SKILL" "single turn" \
  "orchestrator: all four questions presented together in a single turn"

echo ""
echo "=== req-007: orchestrator SKILL.md — per-item confirmation unchanged ==="

assert_file_contains "$ORCH_SKILL" "separate, explicit accept / edit / reject" \
  "orchestrator: per-item explicit accept/edit/reject is still required"

assert_file_contains "$ORCH_SKILL" "No blanket or implied confirmation" \
  "orchestrator: blanket/implied confirmation across items is explicitly disallowed"

assert_file_contains "$ORCH_SKILL" "record it as its own" \
  "orchestrator: build-log entry still written per item"

assert_file_contains "$ORCH_SKILL" "immediately" \
  "orchestrator: build-log entry still written immediately (not deferred to end of batch)"

echo ""
echo "=== req-007: orchestrator SKILL.md — partial-failure fallback ==="

assert_file_contains "$ORCH_SKILL" "Partial-failure fallback" \
  "orchestrator: partial-failure fallback is a named step"

assert_file_contains "$ORCH_SKILL" "fall back to the original blank-question, opt-in flow for that one item only" \
  "orchestrator: failed dispatch falls back to blank-question opt-in flow for that one item only"

echo ""
echo "=== req-007: orchestrator SKILL.md — scoped narrowly against 0000014-ADR-008 ==="

assert_file_contains "$ORCH_SKILL" "0000014-ADR-008" \
  "orchestrator: Scope Lock Challenge section names 0000014-ADR-008"

assert_file_contains "$ORCH_SKILL" "does not alter" \
  "orchestrator: explicitly states the one-question-at-a-time convention is not altered elsewhere"

echo ""
echo "=== req-007: orchestrator SKILL.md — opt-in-per-question is no longer the primary flow ==="

assert_file_not_contains "$ORCH_SKILL" "ask each of these four questions **one at a time**" \
  "orchestrator: no longer asks the four scenario-path questions one at a time by default"

assert_file_not_contains "$ORCH_SKILL" "Never pre-draft a suggested answer automatically. Until the human explicitly asks for one" \
  "orchestrator: no longer states drafts are never pre-made until explicitly requested"

assert_file_not_contains "$ORCH_SKILL" "Suggested-answer option (ADR-003 — always offered, only drafted on explicit request)" \
  "orchestrator: old offer-then-opt-in section header is gone"

# =============================================================================
# planifest-scope-lock-agent/SKILL.md — Invocation Contract + description
# =============================================================================

echo ""
echo "=== req-007: scope-lock-agent SKILL.md — Invocation Contract reflects default dispatch ==="

assert_file_contains "$SCOPE_LOCK_SKILL" "by default" \
  "scope-lock-agent: Invocation Contract mentions default dispatch"

assert_file_contains "$SCOPE_LOCK_SKILL" "parallel" \
  "scope-lock-agent: Invocation Contract mentions parallel batch dispatch"

assert_file_contains "$SCOPE_LOCK_SKILL" "never for more than one item at a time" \
  "scope-lock-agent: per-agent-instance single-item scope constraint preserved"

assert_file_not_contains "$SCOPE_LOCK_SKILL" "never pre-emptively, never automatically" \
  "scope-lock-agent: old never-pre-emptive/never-automatic wording removed"

echo ""
echo "=== req-007: scope-lock-agent SKILL.md — description no longer says on-request-only ==="

assert_file_not_contains "$SCOPE_LOCK_SKILL" "dispatched only on explicit human request" \
  "scope-lock-agent: description no longer says dispatched only on explicit human request"

print_summary
