#!/usr/bin/env bash
# Tests for feature 0000017, req-005: scope-lock-suggested-answers
# Section (a) updated by feature 0000025, req-007: 0000017-ADR-003's
# opt-in-per-question default (offer, draft only on explicit request) is
# superseded by 0000025-ADR-003 (always draft all four in parallel by
# default, batch-present, per-item accept/edit/reject) — section (a)'s
# assertions now check the new default. Sections (b)/(c)/(d) are unchanged:
# the drafting rigor rules and build-log recording still hold under the
# new default.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../helpers/assert.sh"

FRAMEWORK="$SCRIPT_DIR/../.."
ORCHESTRATOR="$FRAMEWORK/skills/planifest-orchestrator/SKILL.md"
SCOPE_LOCK_AGENT="$FRAMEWORK/skills/planifest-scope-lock-agent/SKILL.md"

file_exists() { [ -f "$1" ] && echo "yes" || echo "no"; }
grep_has()    { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }
grep_str()    { grep "$1" "$2" 2>/dev/null || true; }
grep_count()  { grep -c "$1" "$2" 2>/dev/null || echo 0; }

# ── (a) orchestrator always drafts all four answers, batch-presented ────────

echo ""
echo "=== req-005(a) [updated by 0000025-req-007]: default parallel dispatch, batch presentation ==="

assert_equals "yes" "$(grep_has "Default parallel dispatch, no opt-in" "$ORCHESTRATOR")" \
  "req-005a: orchestrator has a 'Default parallel dispatch, no opt-in' subsection under Scope Lock Challenge"

assert_equals "yes" "$(grep_has "dispatch \`planifest-scope-lock-agent\` for all four scenario-path questions" "$ORCHESTRATOR")" \
  "req-005a: orchestrator dispatches all four scenario-path questions by default"

assert_equals "yes" "$(grep_has "Drafting is always produced; it is never gated on a human opt-in request" "$ORCHESTRATOR")" \
  "req-005a: orchestrator states drafting is never gated on a human opt-in request"

assert_equals "yes" "$(grep_has "Batch presentation" "$ORCHESTRATOR")" \
  "req-005a: orchestrator has a Batch presentation subsection"

assert_equals "yes" "$(grep_has "separate, explicit accept / edit / reject for each of the four items individually" "$ORCHESTRATOR")" \
  "req-005a: orchestrator still requires a separate accept/edit/reject per item, not a blanket batch approval"

assert_equals "yes" "$(grep_has "Partial-failure fallback" "$ORCHESTRATOR")" \
  "req-005a: orchestrator has a Partial-failure fallback subsection for a failed dispatch"

assert_equals "yes" "$(grep_has "0000014-ADR-008" "$ORCHESTRATOR")" \
  "req-005a: orchestrator scopes this default against 0000014-ADR-008's one-question-at-a-time convention"

assert_equals "yes" "$(grep_has "planifest-scope-lock-agent" "$ORCHESTRATOR")" \
  "req-005a: orchestrator references the planifest-scope-lock-agent skill"

# ── (b) new skill file exists ────────────────────────────────────────────────

echo ""
echo "=== req-005(b): planifest-scope-lock-agent/SKILL.md exists ==="

assert_equals "yes" "$(file_exists "$SCOPE_LOCK_AGENT")" \
  "req-005b: planifest-scope-lock-agent/SKILL.md exists"

assert_equals "yes" "$(grep_has "^name: planifest-scope-lock-agent" "$SCOPE_LOCK_AGENT")" \
  "req-005b: skill frontmatter declares name planifest-scope-lock-agent"

# ── (c) rigor spec: 5 rules present in substance ─────────────────────────────

echo ""
echo "=== req-005(c): rigor spec rules present in planifest-scope-lock-agent ==="

assert_equals "yes" "$(grep_has "Usage-only framing" "$SCOPE_LOCK_AGENT")" \
  "req-005c-1: usage-only framing rule present"

assert_equals "yes" "$(grep_has "never the build.*pipeline\|never the build/pipeline" "$SCOPE_LOCK_AGENT")" \
  "req-005c-1: usage-only framing excludes build/pipeline/implementation process language"

assert_equals "yes" "$(grep_has "Outcome, not action" "$SCOPE_LOCK_AGENT")" \
  "req-005c-2: outcome-not-action rule present"

assert_equals "yes" "$(grep_has "never the act of running a tool" "$SCOPE_LOCK_AGENT")" \
  "req-005c-2: outcome-not-action rule states the resulting state, never the act of running a tool"

assert_equals "yes" "$(grep_has "doesn't meaningfully apply\|does not meaningfully apply" "$SCOPE_LOCK_AGENT")" \
  "req-005c-3: N/A-recognition rule present"

assert_equals "yes" "$(grep_has "manufacturing an artificial narrative" "$SCOPE_LOCK_AGENT")" \
  "req-005c-3: N/A-recognition rule rejects manufacturing an artificial narrative"

assert_equals "yes" "$(grep_has "Consistency check" "$SCOPE_LOCK_AGENT")" \
  "req-005c-4: consistency-check rule present"

assert_equals "yes" "$(grep_has "never smooth" "$SCOPE_LOCK_AGENT")" \
  "req-005c-4: consistency-check rule states contradictions are never smoothed over"

assert_equals "yes" "$(grep_has "skip this check silently" "$SCOPE_LOCK_AGENT")" \
  "req-005c-4: consistency-check rule is skipped silently when no confirmed decisions exist yet"

assert_equals "yes" "$(grep_has "No implicit confirmation" "$SCOPE_LOCK_AGENT")" \
  "req-005c-5: no-implicit-confirmation rule present"

assert_equals "yes" "$(grep_has "accept, edit, or reject\|accept.*edit.*reject" "$SCOPE_LOCK_AGENT")" \
  "req-005c-5: no-implicit-confirmation rule names accept/edit/reject as the only valid affirmative"

assert_equals "yes" "$(grep_has "Silence.*never approval\|never read as approval\|never approval" "$SCOPE_LOCK_AGENT")" \
  "req-005c-5: no-implicit-confirmation rule states silence/no-objection is never approval"

# ── (d) confirmations written to build-log.md ────────────────────────────────

echo ""
echo "=== req-005(d): confirmations recorded to build-log.md ==="

assert_equals "yes" "$(grep_has "build-log.md" "$SCOPE_LOCK_AGENT")" \
  "req-005d: planifest-scope-lock-agent references build-log.md"

assert_equals "yes" "$(grep_has "build-log.md" "$ORCHESTRATOR")" \
  "req-005d: orchestrator (pre-existing) references build-log.md"

assert_equals "yes" "$(grep_has "record it as its own \`plan/current/build-log.md\` entry immediately\|record the confirmation" "$ORCHESTRATOR")" \
  "req-005d: orchestrator's Scope Lock section states each confirmation is written to build-log.md immediately"

print_summary
