#!/usr/bin/env bash
# Tests for feature 0000017, req-005: scope-lock-suggested-answers
# Covers ADR-003 — the orchestrator always offers a suggested-answer option
# at each Scope Lock Challenge question, but only dispatches the drafting
# subagent (planifest-scope-lock-agent) on explicit human request.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$SCRIPT_DIR/.."
ORCHESTRATOR="$FRAMEWORK/skills/planifest-orchestrator/SKILL.md"
SCOPE_LOCK_AGENT="$FRAMEWORK/skills/planifest-scope-lock-agent/SKILL.md"

file_exists() { [ -f "$1" ] && echo "yes" || echo "no"; }
grep_has()    { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }
grep_str()    { grep "$1" "$2" 2>/dev/null || true; }
grep_count()  { grep -c "$1" "$2" 2>/dev/null || echo 0; }

# ── (a) orchestrator offers a suggested-answer option at each question ──────

echo ""
echo "=== req-005(a): orchestrator offers suggested-answer option at every Scope Lock question ==="

assert_equals "yes" "$(grep_has "Suggested-answer option" "$ORCHESTRATOR")" \
  "req-005a: orchestrator has a Suggested-answer option subsection under Scope Lock Challenge"

assert_equals "yes" "$(grep_has "Want me to suggest an answer" "$ORCHESTRATOR")" \
  "req-005a: orchestrator's scenario-path questions carry the suggest-an-answer offer"

# All four numbered scenario-path questions must each carry the offer text -
# not just one of them.
OFFER_COUNT="$(grep_count "Want me to suggest an answer" "$ORCHESTRATOR")"
assert_equals "4" "$OFFER_COUNT" \
  "req-005a: the offer appears at all 4 scenario-path questions (happy/first-run/error/cross-session)"

assert_equals "yes" "$(grep_has "never silently skipped" "$ORCHESTRATOR")" \
  "req-005a: orchestrator states the offer is never silently skipped"

assert_equals "yes" "$(grep_has "only.*explicit.*request\|explicit human request" "$ORCHESTRATOR")" \
  "req-005a: orchestrator states drafting is only triggered on explicit human request"

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
