#!/usr/bin/env bash
# test-0000010-framework-quality-improvements.sh
# Acceptance tests for feature 0000010
# Run from repo root: bash planifest-framework/tests/test-0000010-framework-quality-improvements.sh

set -euo pipefail

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

TEMPLATE="planifest-framework/templates/requirement.template.md"
ORCH="planifest-framework/skills/planifest-orchestrator/SKILL.md"
CODEGEN="planifest-framework/skills/planifest-codegen-agent/SKILL.md"
VALIDATE="planifest-framework/skills/planifest-validate-agent/SKILL.md"
SETUP_SH="planifest-framework/setup.sh"
SETUP_PS1="planifest-framework/setup.ps1"
EXT="planifest-framework/external-skills"

echo ""
echo "=== REQ-001: Input Validation section in requirement.template.md ==="
if grep -q "## Input Validation" "$TEMPLATE"; then
  pass "REQ-001: template contains ## Input Validation section"
else
  fail "REQ-001: template missing ## Input Validation section"
fi

if grep -q "conditional\|only required\|only include" "$TEMPLATE"; then
  pass "REQ-001: template marks Input Validation as conditional"
else
  fail "REQ-001: template does not mark Input Validation as conditional"
fi

if grep -q "allowed character\|allowed chars\|character set\|\[a-z\]\|pattern" "$TEMPLATE"; then
  pass "REQ-001: template contains allowed character pattern placeholder"
else
  fail "REQ-001: template missing allowed character pattern placeholder"
fi

if grep -q "max.*length\|maximum.*length\|max.*chars\|length.*max" "$TEMPLATE"; then
  pass "REQ-001: template contains max length placeholder"
else
  fail "REQ-001: template missing max length placeholder"
fi

if grep -q "failure.*behav\|on.*failure\|fallback\|default.*value" "$TEMPLATE"; then
  pass "REQ-001: template contains failure behaviour placeholder"
else
  fail "REQ-001: template missing failure behaviour placeholder"
fi

existing_sections=$(grep -c "^## " "$TEMPLATE" 2>/dev/null || echo 0)
if grep -q "^## Functional Requirements" "$TEMPLATE" && grep -q "^## Acceptance Criteria" "$TEMPLATE"; then
  pass "REQ-001: existing Functional Requirements and Acceptance Criteria sections unchanged"
else
  fail "REQ-001: existing required sections missing or renamed"
fi

echo ""
echo "=== REQ-002: Agent tool in setup.sh ==="
if grep -q "Agent\|allowedTools" "$SETUP_SH"; then
  pass "REQ-002: setup.sh references Agent/allowedTools"
else
  fail "REQ-002: setup.sh does not reference Agent or allowedTools"
fi

if grep -q '"Agent"' "$SETUP_SH"; then
  pass "REQ-002: setup.sh contains \"Agent\" string for allowedTools"
else
  fail "REQ-002: setup.sh missing \"Agent\" in allowedTools"
fi

echo ""
echo "=== REQ-002: Agent tool in setup.ps1 ==="
if grep -q '"Agent"\|allowedTools' "$SETUP_PS1"; then
  pass "REQ-002: setup.ps1 references Agent allowedTools"
else
  fail "REQ-002: setup.ps1 does not reference Agent allowedTools"
fi

echo ""
echo "=== REQ-002: Agent dispatch template in orchestrator SKILL.md ==="
if grep -q "Agent Dispatch Template\|## Agent Dispatch" "$ORCH"; then
  pass "REQ-002: orchestrator has Agent Dispatch Template section"
else
  fail "REQ-002: orchestrator missing Agent Dispatch Template section"
fi

if grep -q "self-contained\|self.contained" "$ORCH"; then
  pass "REQ-002: orchestrator dispatch template includes self-contained prompt rule"
else
  fail "REQ-002: orchestrator missing self-contained prompt rule"
fi

# 0000022: relocated to standards/agent-dispatch-standards.md (ADR-001) - orchestrator points to it
DISPATCH_STD_FILE="planifest-framework/standards/agent-dispatch-standards.md"
if [ -f "$DISPATCH_STD_FILE" ] && grep -q "native tool\|two levels\|parallel native" "$DISPATCH_STD_FILE"; then
  pass "REQ-002: agent-dispatch-standards.md clarifies two levels of parallelism"
else
  fail "REQ-002: agent-dispatch-standards.md missing two-levels-of-parallelism note"
fi

echo ""
echo "=== REQ-002: Parallel Dispatch Checklist in codegen-agent SKILL.md ==="
if grep -q "Parallel Dispatch Checklist\|## Parallel Dispatch" "$CODEGEN"; then
  pass "REQ-002: codegen-agent has Parallel Dispatch Checklist section"
else
  fail "REQ-002: codegen-agent missing Parallel Dispatch Checklist section"
fi

echo ""
echo "=== REQ-002: Pre-Execution Parallelism Plan in validate-agent SKILL.md ==="
if grep -q "Pre-Execution Parallelism\|## Pre-Execution" "$VALIDATE"; then
  pass "REQ-002: validate-agent has Pre-Execution Parallelism Plan section"
else
  fail "REQ-002: validate-agent missing Pre-Execution Parallelism Plan section"
fi

echo ""
echo "=== REQ-003: Skill directory name normalisation ==="
mismatch_count=0
total=0
for dir in "$EXT"/*/; do
  skill_file="$dir/SKILL.md"
  [ -f "$skill_file" ] || continue
  total=$((total+1))
  # NB: quote/CR stripping uses tr, not a sed [".."] bracket class — on BSD
  # sed, `\r` inside [...] is NOT a carriage-return escape, it's the literal
  # characters `\` and `r`, which silently deleted every "r" from every name
  # field (279 false-positive mismatches on macOS before this fix).
  name_field=$(grep "^name:" "$skill_file" | head -1 | sed 's/^name: *//' | tr -d '"\r' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g;s/--*/-/g;s/^-//;s/-$//')
  dir_name=$(basename "$dir")
  if [ "$dir_name" != "$name_field" ] && [ -n "$name_field" ]; then
    mismatch_count=$((mismatch_count+1))
  fi
done
if [ "$mismatch_count" -eq 0 ] && [ "$total" -gt 0 ]; then
  pass "REQ-003: all $total skill directories match their SKILL.md name field (kebab-case)"
else
  fail "REQ-003: $mismatch_count/$total skill directories have name-vs-directory mismatch"
fi

echo ""
echo "=== REQ-004: New skills from high-signal repos ==="
new_skill_count=$(ls -d "$EXT"/*/ 2>/dev/null | wc -l)
if [ "$new_skill_count" -gt 200 ]; then
  pass "REQ-004: external-skills count ($new_skill_count) > 200 baseline — new skills added"
else
  fail "REQ-004: external-skills count ($new_skill_count) not greater than 200 baseline"
fi

missing_attribution=0
for dir in "$EXT"/*/; do
  [ -f "$dir/attribution.txt" ] || { ((missing_attribution++)); }
done
if [ "$missing_attribution" -eq 0 ]; then
  pass "REQ-004: all skill directories have attribution.txt"
else
  fail "REQ-004: $missing_attribution skill directories missing attribution.txt"
fi

missing_skill=0
for dir in "$EXT"/*/; do
  [ -f "$dir/SKILL.md" ] || { ((missing_skill++)); }
done
if [ "$missing_skill" -eq 0 ]; then
  pass "REQ-004: all skill directories have SKILL.md"
else
  fail "REQ-004: $missing_skill skill directories missing SKILL.md"
fi

if grep -q "sw-agent-skills\|wondelai\|garden-skills\|marketingskills" "$EXT"/*/attribution.txt 2>/dev/null; then
  pass "REQ-004: at least one skill attributed to a newly-extracted repo"
else
  fail "REQ-004: no skills found from newly-extracted repos"
fi

echo ""
echo "=== README completeness ==="
readme_lines=$(grep -c "^|" "$EXT/README.md" 2>/dev/null || echo 0)
if [ "$readme_lines" -gt 200 ]; then
  pass "README: skill index has $readme_lines rows (> 200)"
else
  fail "README: skill index has only $readme_lines rows"
fi

echo ""
echo "=== Summary ==="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "All tests passed."
  exit 0
else
  echo "$FAIL test(s) failed."
  exit 1
fi
