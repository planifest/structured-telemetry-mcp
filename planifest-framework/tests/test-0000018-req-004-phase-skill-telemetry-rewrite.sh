#!/usr/bin/env bash
# Tests for feature 0000018 req-004: all phase skills' Telemetry sections
# rewritten for immediate-interactive agent-driven failure, removing the old
# "skip silently if unavailable" framing (ADR-002).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$FRAMEWORK/skills"

# Actual set of skills whose Telemetry section previously had the "skip
# silently" gate (verified via grep at implementation time — this is the
# real affected set, not the aspirational one in req-004's original spec,
# which incorrectly named ship-agent instead of change-agent; ship-agent's
# Telemetry section already deferred entirely to telemetry-standards.md with
# no local gate line, so it never needed this fix).
SKILLS=(
  planifest-orchestrator
  planifest-spec-agent
  planifest-adr-agent
  planifest-codegen-agent
  planifest-validate-agent
  planifest-change-agent
  planifest-security-agent
  planifest-docs-agent
)

echo ""
echo "=== req-004: old soft-skip framing removed from all 8 affected skills ==="

for skill in "${SKILLS[@]}"; do
  file="$SKILLS_DIR/$skill/SKILL.md"
  content=$(cat "$file")
  assert_equals "no" "$(printf '%s' "$content" | grep -q "skip silently" && echo yes || echo no)" \
    "$skill: 'skip silently' framing removed"
  assert_contains "nified signal" "$content" \
    "$skill: references the unified signal"
  assert_contains "mandatory, not best-effort" "$content" \
    "$skill: emission is mandatory, not best-effort"
done

echo ""
echo "=== req-004: envelope documentation stays centralized (ADR-002, 0000007) ==="

for skill in "${SKILLS[@]}"; do
  file="$SKILLS_DIR/$skill/SKILL.md"
  content=$(cat "$file")
  # None of these skills should duplicate the full envelope schema fields
  # (schema_version + mcp_mode together is a reasonable proxy for "the full
  # envelope was pasted in here" rather than referenced).
  HAS_SCHEMA_VERSION=$(printf '%s' "$content" | grep -q '"schema_version"' && echo yes || echo no)
  HAS_MCP_MODE=$(printf '%s' "$content" | grep -q '"mcp_mode"' && echo yes || echo no)
  assert_equals "no" "$([ "$HAS_SCHEMA_VERSION" = "yes" ] && [ "$HAS_MCP_MODE" = "yes" ] && echo yes || echo no)" \
    "$skill: does not duplicate the full event envelope (still references telemetry-standards.md)"
done

print_summary
