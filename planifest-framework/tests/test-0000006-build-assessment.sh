#!/usr/bin/env bash
# Tests for feature 0000006-build-assessment-phase
# Covers: req-001 through req-008

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS="$FRAMEWORK/skills"
TEMPLATES="$FRAMEWORK/templates"

# -----------------------------------------------------------------------

echo ""
echo "=== req-001: build log working file ==="

assert_file_exists() {
  local path="$1" label="$2"
  if [ -e "$path" ]; then
    assert_equals "0" "0" "$label"
  else
    assert_equals "exists" "missing" "$label: $path"
  fi
}

ORCH=$(cat "$SKILLS/planifest-orchestrator/SKILL.md")
assert_contains "build-log.md"               "$ORCH" "req-001: orchestrator references build-log.md"
assert_contains "build-log.template.md"      "$ORCH" "req-001: orchestrator references build-log template"
assert_contains "append"                     "$ORCH" "req-001: orchestrator has append instruction for resume"

# -----------------------------------------------------------------------

echo ""
echo "=== req-002: planifest-build-assessment-agent skill ==="

SKILL_FILE="$SKILLS/planifest-build-assessment-agent/SKILL.md"
assert_file_exists "$SKILL_FILE"                                "req-002: skill file exists"

ASSESS=$(cat "$SKILL_FILE")
FRONTMATTER_NAME=$(grep "^name:" "$SKILL_FILE" | head -1 | awk '{print $2}')
assert_equals "planifest-build-assessment-agent" "$FRONTMATTER_NAME" "req-002: frontmatter name matches directory"

assert_contains "Model"                      "$ASSESS" "req-002: Model Usage section present"
assert_contains "Skills Invoked"             "$ASSESS" "req-002: Skills Invoked section present"
assert_contains "Subagent"                   "$ASSESS" "req-002: Subagent Dispatch section present"
assert_contains "MCP"                        "$ASSESS" "req-002: MCP Tool Usage section present"
assert_contains "Parallel"                   "$ASSESS" "req-002: Parallel Task Bursts section present"
assert_contains "Self-Correction"            "$ASSESS" "req-002: Self-Corrections section present"
assert_contains "Artefact"                   "$ASSESS" "req-002: Artefact Counts section present"
assert_contains "Efficiency"                 "$ASSESS" "req-002: Efficiency Observations section present"
assert_contains "build-report.md"            "$ASSESS" "req-002: output path references build-report.md"
assert_contains "build-log.md"               "$ASSESS" "req-002: skill reads build-log.md as input"

# -----------------------------------------------------------------------

echo ""
echo "=== req-003: P8 wired in orchestrator ==="

assert_contains "P8:"                        "$ORCH" "req-003: P8 in orchestrator prefix table"
assert_contains "P8 Build Assessment"        "$ORCH" "req-003: P8 pipeline sequence includes Build Assessment"
assert_contains "planifest-build-assessment-agent" "$ORCH" "req-003: orchestrator Framework Index includes P8 skill"

SHIP=$(cat "$SKILLS/planifest-ship-agent/SKILL.md")
assert_contains "planifest-build-assessment-agent" "$SHIP" "req-003: ship agent references P8 skill"
assert_contains "build-report.md"            "$SHIP" "req-003: ship agent confirms build-report.md in final output"

# -----------------------------------------------------------------------

echo ""
echo "=== req-004: model routing rules ==="

assert_contains "Model Tier"                 "$ORCH" "req-004: orchestrator has Model Tier section"
assert_contains "Primary"                    "$ORCH" "req-004: Primary tier defined"
assert_contains "Cheaper"                    "$ORCH" "req-004: Cheaper tier defined"
assert_contains "Code generation"            "$ORCH" "req-004: code generation classified"
assert_contains "Security review"            "$ORCH" "req-004: security review classified"
assert_contains "Codebase discovery"         "$ORCH" "req-004: codebase discovery classified"
assert_contains "Formatting"                 "$ORCH" "req-004: formatting classified"
assert_contains "Tier-to-model"              "$ORCH" "req-004: tier-to-model mapping table present"
assert_contains "claude-haiku"               "$ORCH" "req-004: Haiku listed as cheaper tier for Claude Code"

# -----------------------------------------------------------------------

echo ""
echo "=== req-005: parallelism directives in orchestrator ==="

assert_contains "Parallelism Rules"          "$ORCH" "req-005: Parallelism Rules section present"
assert_contains "Default posture: parallel"  "$ORCH" "req-005: default posture is parallel stated"
assert_contains "Dependency test"            "$ORCH" "req-005: dependency test present"
assert_contains "MUST parallelise"           "$ORCH" "req-005: MUST parallelise table present"
assert_contains "Cannot parallelise"         "$ORCH" "req-005: Cannot parallelise table present"

# -----------------------------------------------------------------------

echo ""
echo "=== req-006: parallelism directives in phase skills ==="

SPEC=$(cat "$SKILLS/planifest-spec-agent/SKILL.md")
assert_contains "Parallelism Directive"      "$SPEC" "req-006: spec-agent has Parallelism Directive"
assert_contains "MUST"                       "$SPEC" "req-006: spec-agent uses MUST"

ADR=$(cat "$SKILLS/planifest-adr-agent/SKILL.md")
assert_contains "Parallelism Directive"      "$ADR" "req-006: adr-agent has Parallelism Directive"
assert_contains "MUST"                       "$ADR" "req-006: adr-agent uses MUST"

CODEGEN=$(cat "$SKILLS/planifest-codegen-agent/SKILL.md")
assert_contains "Parallelism Directive"      "$CODEGEN" "req-006: codegen-agent has Parallelism Directive"
assert_contains "MUST"                       "$CODEGEN" "req-006: codegen-agent uses MUST"

VALIDATE=$(cat "$SKILLS/planifest-validate-agent/SKILL.md")
assert_contains "Parallelism Directive"      "$VALIDATE" "req-006: validate-agent has Parallelism Directive"
assert_contains "MUST"                       "$VALIDATE" "req-006: validate-agent uses MUST"

SECURITY=$(cat "$SKILLS/planifest-security-agent/SKILL.md")
assert_contains "Parallelism Directive"      "$SECURITY" "req-006: security-agent has Parallelism Directive"
assert_contains "MUST"                       "$SECURITY" "req-006: security-agent uses MUST"

DOCS=$(cat "$SKILLS/planifest-docs-agent/SKILL.md")
assert_contains "Parallelism Directive"      "$DOCS" "req-006: docs-agent has Parallelism Directive"
assert_contains "MUST"                       "$DOCS" "req-006: docs-agent uses MUST"

# -----------------------------------------------------------------------

echo ""
echo "=== req-007: build-log.template.md ==="

TEMPLATE="$TEMPLATES/build-log.template.md"
assert_file_exists "$TEMPLATE"                               "req-007: build-log.template.md exists"

TMPL=$(cat "$TEMPLATE")
assert_contains "feature-id"                 "$TMPL" "req-007: template has feature-id field"
assert_contains "primary-model"              "$TMPL" "req-007: template has primary model field"
assert_contains "cheaper-model"              "$TMPL" "req-007: template has cheaper model field"
assert_contains "Model tier"                 "$TMPL" "req-007: template has model tier per-phase field"
assert_contains "Agents spawned"             "$TMPL" "req-007: template has agents spawned field"
assert_contains "MCP calls"                  "$TMPL" "req-007: template has MCP calls field"
assert_contains "Parallel task"              "$TMPL" "req-007: template has parallel task batches field"
assert_contains "Summary"                    "$TMPL" "req-007: template has Summary section"
assert_contains "{{feature-id}}"             "$TMPL" "req-007: template uses placeholder tokens"

# -----------------------------------------------------------------------

print_summary
