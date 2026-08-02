#!/usr/bin/env bash
# Tests for feature 0000009: framework rail tightening
# Covers REQ-001 through REQ-012 (design.md numbering).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../helpers/assert.sh"

FRAMEWORK="$SCRIPT_DIR/../.."
SETUP_SH="$FRAMEWORK/setup.sh"
SETUP_PS1="$FRAMEWORK/setup.ps1"
ORCHESTRATOR="$FRAMEWORK/skills/planifest-orchestrator/SKILL.md"
SHIP_AGENT="$FRAMEWORK/skills/planifest-ship-agent/SKILL.md"
GATE_WRITE="$FRAMEWORK/hooks/enforcement/gate-write.mjs"
AUTO_TRIGGER="$FRAMEWORK/hooks/enforcement/auto-trigger-orchestrator.mjs"
PRESENCE_CHECK="$FRAMEWORK/hooks/enforcement/check-orchestrator-presence.mjs"
DESIGN_TPL="$FRAMEWORK/templates/design.template.md"
PAUSE_TPL="$FRAMEWORK/templates/pause.template.md"
STANDARD_BOOT="$FRAMEWORK/templates/standard-boot.md"
GETTING_STARTED="$FRAMEWORK/getting-started.md"
PIPELINE_REFERENCE="$FRAMEWORK/pipeline-reference.md"

file_exists() { [ -f "$1" ] && echo "yes" || echo "no"; }
grep_has()    { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }
grep_str()    { grep "$1" "$2" 2>/dev/null || true; }

# ── REQ-001: .skips path ─────────────────────────────────────────────────────

echo ""
echo "=== REQ-001: .skips path corrected to plan/current/.skips ==="

assert_contains "plan/current/.skips" \
  "$(grep_str "\.skips" "$ORCHESTRATOR")" \
  "REQ-001: orchestrator references plan/current/.skips"

# ── REQ-002: auto-trigger-orchestrator hook ───────────────────────────────────

echo ""
echo "=== REQ-002: auto-trigger-orchestrator hook ==="

assert_equals "yes" "$(file_exists "$AUTO_TRIGGER")" \
  "REQ-002: auto-trigger-orchestrator.mjs exists"

assert_equals "yes" "$(grep_has "planifest-framework" "$AUTO_TRIGGER")" \
  "REQ-002: hook checks for planifest-framework presence"

assert_equals "yes" "$(grep_has "orchestrator-active" "$AUTO_TRIGGER")" \
  "REQ-002: hook checks sentinel absence"

assert_equals "yes" "$(grep_has "auto-trigger-orchestrator" "$SETUP_SH")" \
  "REQ-002: setup.sh wires auto-trigger-orchestrator"

assert_equals "yes" "$(grep_has "PLANIFEST_TRIGGER" "$SETUP_SH")" \
  "REQ-002: setup.sh passes trigger cmd to UserPromptSubmit wiring"

assert_equals "yes" "$(grep_has "auto-trigger-orchestrator" "$STANDARD_BOOT")" \
  "REQ-002: standard-boot.md documents auto-trigger hook"

assert_equals "yes" "$(grep_has "planifest-orchestrator skill" "$STANDARD_BOOT")" \
  "REQ-002: standard-boot.md has fallback instruction"

# ── REQ-003: Skill Map in design template ─────────────────────────────────────

echo ""
echo "=== REQ-003: Skill Map in design.template.md ==="

assert_equals "yes" "$(grep_has "## Skill Map" "$DESIGN_TPL")" \
  "REQ-003b: design.template.md has Skill Map section"

assert_equals "yes" "$(grep_has "Skill Map" "$ORCHESTRATOR")" \
  "REQ-003b: orchestrator produces Skill Map in P0"

assert_equals "yes" "$(grep_has "Subagent Decomposition" "$ORCHESTRATOR")" \
  "REQ-003a: orchestrator has Subagent Decomposition Directive"

# ── REQ-004: open-source skill library ───────────────────────────────────────

echo ""
echo "=== REQ-004: external-skills library ==="

assert_equals "yes" "$(file_exists "$FRAMEWORK/external-skills/nelson/SKILL.md")" \
  "REQ-004: nelson skill present"

assert_equals "yes" "$(file_exists "$FRAMEWORK/external-skills/soul/SKILL.md")" \
  "REQ-004: soul skill present"

assert_equals "yes" "$(file_exists "$FRAMEWORK/external-skills/android-development/SKILL.md")" \
  "REQ-004: android-development skill present"

assert_equals "yes" "$(grep_has "include-full-skill-library" "$SETUP_SH")" \
  "REQ-004: setup.sh has --include-full-skill-library flag"

assert_equals "yes" "$(grep_has "copy_external_skills" "$SETUP_SH")" \
  "REQ-004: setup.sh calls copy_external_skills"

assert_equals "yes" "$(grep_has "include-full-skill-library" "$SETUP_PS1")" \
  "REQ-004: setup.ps1 has --include-full-skill-library flag"

assert_equals "yes" "$(grep_has "Copy-ExternalSkills" "$SETUP_PS1")" \
  "REQ-004: setup.ps1 has Copy-ExternalSkills function"

# ── REQ-005: pause/resume ────────────────────────────────────────────────────

echo ""
echo "=== REQ-005: pause/resume via pause.md ==="

assert_equals "yes" "$(file_exists "$PAUSE_TPL")" \
  "REQ-005: pause.template.md exists"

assert_equals "yes" "$(grep_has "active_task" "$PAUSE_TPL")" \
  "REQ-005: pause template has active_task field"

assert_equals "yes" "$(grep_has "Pause Command" "$ORCHESTRATOR")" \
  "REQ-005: orchestrator has Pause Command section"

assert_equals "yes" "$(grep_has "pause\.md" "$GATE_WRITE")" \
  "REQ-005: gate-write permits pause.md"

assert_equals "yes" "$(grep_has "isAlwaysPermittedBasename" "$GATE_WRITE")" \
  "REQ-005: gate-write bypasses sentinel for always-permitted basenames"

# ── REQ-006/REQ-007: setup.sh override instructions parity ───────────────────

echo ""
echo "=== REQ-006/REQ-007: setup.sh override instructions parity with setup.ps1 ==="

assert_equals "yes" "$(grep_has "^append_override_instructions" "$SETUP_SH")" \
  "REQ-006: setup.sh defines append_override_instructions function"

assert_equals "yes" "$(grep_has "planifest-overrides/instructions" "$SETUP_SH")" \
  "REQ-007: setup.sh references planifest-overrides/instructions"

assert_equals "yes" "$(grep_has 'append_override_instructions "\$TOOL_BOOT_FILE"' "$SETUP_SH")" \
  "REQ-007: setup.sh calls append_override_instructions in setup_tool"

assert_equals "yes" "$(grep_has "Append-OverrideInstructions" "$SETUP_PS1")" \
  "REQ-006: setup.ps1 has Append-OverrideInstructions (pre-existing)"

# ── REQ-008: setup.sh copy_capability_skills parity ──────────────────────────

echo ""
echo "=== REQ-008: setup.sh Copy-CapabilitySkills parity ==="

assert_equals "yes" "$(grep_has "^copy_capability_skills" "$SETUP_SH")" \
  "REQ-008: setup.sh defines copy_capability_skills function"

assert_equals "yes" "$(grep_has "planifest-overrides/capability-skills" "$SETUP_SH")" \
  "REQ-008: setup.sh references planifest-overrides/capability-skills"

assert_equals "yes" "$(grep_has 'copy_capability_skills "\$skills_dir"' "$SETUP_SH")" \
  "REQ-008: setup.sh calls copy_capability_skills in setup_tool"

assert_equals "yes" "$(grep_has "Copy-CapabilitySkills" "$SETUP_PS1")" \
  "REQ-008: setup.ps1 has Copy-CapabilitySkills (pre-existing)"

# ── REQ-009: setup.ps1 Tier 1 adapter support ────────────────────────────────

echo ""
echo "=== REQ-009: setup.ps1 Tier 1 adapter support ==="

assert_equals "yes" "$(grep_has "function Install-Tier1Hooks" "$SETUP_PS1")" \
  "REQ-009: setup.ps1 has Install-Tier1Hooks function"

assert_equals "yes" "$(grep_has "toolConfig.Tier -eq 1" "$SETUP_PS1")" \
  "REQ-009: setup.ps1 dispatches Tier 1 install"

assert_equals "yes" "$(grep_has "Tier.*=.*1" "$FRAMEWORK/setup/cursor.ps1")" \
  "REQ-009: cursor.ps1 declares Tier 1"

assert_equals "yes" "$(grep_has "Tier.*=.*1" "$FRAMEWORK/setup/windsurf.ps1")" \
  "REQ-009: windsurf.ps1 declares Tier 1"

assert_equals "yes" "$(grep_has "Tier.*=.*1" "$FRAMEWORK/setup/cline.ps1")" \
  "REQ-009: cline.ps1 declares Tier 1"

assert_equals "yes" "$(grep_has "HookAdapterSrc" "$FRAMEWORK/setup/cursor.ps1")" \
  "REQ-009: cursor.ps1 has HookAdapterSrc"

assert_equals "yes" "$(grep_has "HookAdapterSrc" "$FRAMEWORK/setup/windsurf.ps1")" \
  "REQ-009: windsurf.ps1 has HookAdapterSrc"

assert_equals "yes" "$(grep_has "HookAdapterSrc" "$FRAMEWORK/setup/cline.ps1")" \
  "REQ-009: cline.ps1 has HookAdapterSrc"

# ── REQ-010: setup.ps1 opencode support ──────────────────────────────────────

echo ""
echo "=== REQ-010: setup.ps1 opencode support ==="

assert_equals "yes" "$(grep_has "'opencode'" "$SETUP_PS1")" \
  "REQ-010: opencode in ValidTools"

assert_equals "yes" "$(file_exists "$FRAMEWORK/setup/opencode.ps1")" \
  "REQ-010: setup/opencode.ps1 exists"

assert_equals "yes" "$(file_exists "$FRAMEWORK/setup/opencode.sh")" \
  "REQ-010: setup/opencode.sh exists"

# ── REQ-011: TypeScript adapter for OpenCode ──────────────────────────────────

echo ""
echo "=== REQ-011: TypeScript adapter for OpenCode ==="

assert_equals "yes" "$(file_exists "$FRAMEWORK/hooks/adapters/opencode/index.ts")" \
  "REQ-011: opencode adapter index.ts exists"

assert_equals "yes" "$(file_exists "$FRAMEWORK/hooks/adapters/opencode/package.json")" \
  "REQ-011: opencode adapter package.json exists"

# ── REQ-012: gate-write Windows path fix ─────────────────────────────────────

echo ""
echo "=== REQ-012: gate-write.mjs Windows path normalisation ==="

assert_equals "yes" "$(grep_has "function norm\|const norm" "$GATE_WRITE")" \
  "REQ-012: gate-write.mjs defines norm() helper"

assert_equals "yes" "$(grep_has "cwdPrefix" "$GATE_WRITE")" \
  "REQ-012: gate-write.mjs uses cwdPrefix for comparison"

assert_equals "no" "$(grep_has "cwdWithSep" "$GATE_WRITE")" \
  "REQ-012: gate-write.mjs does not use old cwdWithSep"

assert_equals "yes" "$(file_exists "$FRAMEWORK/tests/test-gate-write-windows.mjs")" \
  "REQ-012: Node.js regression test exists"

# ── REQ-008 (mid-pipeline): orchestrator-presence-check hook ─────────────────

echo ""
echo "=== REQ-008 (mid-pipeline): check-orchestrator-presence hook ==="

assert_equals "yes" "$(file_exists "$PRESENCE_CHECK")" \
  "REQ-008p: check-orchestrator-presence.mjs exists"

assert_equals "yes" "$(grep_has "orchestrator-active" "$PRESENCE_CHECK")" \
  "REQ-008p: hook checks .orchestrator-active sentinel"

assert_equals "yes" "$(grep_has "PLANIFEST PIPELINE ACTIVE" "$PRESENCE_CHECK")" \
  "REQ-008p: advisory mode banner present"

assert_equals "yes" "$(grep_has "orchestrator-strict" "$PRESENCE_CHECK")" \
  "REQ-008p: hook reads .orchestrator-strict for strict mode"

assert_equals "yes" "$(grep_has "orchestrator-ack" "$PRESENCE_CHECK")" \
  "REQ-008p: hook reads/compares .orchestrator-ack"

assert_equals "yes" "$(grep_has "session_id" "$PRESENCE_CHECK")" \
  "REQ-008p: hook uses session_id for ack"

assert_equals "yes" "$(grep_has "PLANIFEST STRICT MODE\|STRICT MODE" "$PRESENCE_CHECK")" \
  "REQ-008p: strict mode hard-block banner present"

assert_equals "yes" "$(grep_has "check-orchestrator-presence" "$SETUP_SH")" \
  "REQ-008p: setup.sh wires check-orchestrator-presence"

assert_equals "yes" "$(grep_has "PLANIFEST_PRESENCE" "$SETUP_SH")" \
  "REQ-008p: setup.sh passes presence cmd to UserPromptSubmit wiring"

assert_equals "yes" "$(grep_has "strict-orchestrator" "$SETUP_SH")" \
  "REQ-008p: setup.sh has --strict-orchestrator flag"

assert_equals "yes" "$(grep_has "orchestrator-strict" "$SETUP_SH")" \
  "REQ-008p: setup.sh writes plan/.orchestrator-strict sentinel"

assert_equals "yes" "$(grep_has "check-orchestrator-presence\|presenceEntry" "$SETUP_PS1")" \
  "REQ-008p: setup.ps1 wires check-orchestrator-presence"

assert_equals "yes" "$(grep_has "strict-orchestrator\|StrictOrchestrator" "$SETUP_PS1")" \
  "REQ-008p: setup.ps1 has --strict-orchestrator flag"

assert_equals "yes" "$(grep_has "orchestrator-strict" "$SETUP_PS1")" \
  "REQ-008p: setup.ps1 writes plan/.orchestrator-strict sentinel"

assert_equals "yes" "$(grep_has "orchestrator-ack" "$ORCHESTRATOR")" \
  "REQ-008p: orchestrator SKILL.md writes .orchestrator-ack on P0 start"

assert_equals "yes" "$(grep_has "orchestrator-ack" "$SHIP_AGENT")" \
  "REQ-008p: ship-agent deletes .orchestrator-ack at P7"

# getting-started.md is the entry-point file (deliberately terse, per the
# 0000012 three-file docs architecture, ADR-001); presence-check/strict-mode
# is deep-reference material and lives in pipeline-reference.md instead.
assert_equals "yes" "$(grep_has "check-orchestrator-presence\|orchestrator-presence" "$PIPELINE_REFERENCE")" \
  "REQ-008p: pipeline-reference.md documents presence check hook"

assert_equals "yes" "$(grep_has "strict-orchestrator" "$PIPELINE_REFERENCE")" \
  "REQ-008p: pipeline-reference.md documents --strict-orchestrator flag"

print_summary
