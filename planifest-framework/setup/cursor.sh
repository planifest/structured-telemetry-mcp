# Cursor - tool configuration
# https://docs.cursor.com
#
# Skills:    .cursor/skills/{name}/SKILL.md       (auto-discovered)
# Workflows: embedded in .cursor/rules/*.mdc      (Cursor uses rules, not a separate workflow dir)
# Boot file: .cursor/rules/planifest.mdc

TOOL_SKILLS_DIR=".cursor/skills"
TOOL_WORKFLOWS_DIR=""

TOOL_BOOT_FILE=".cursor/rules/planifest.mdc"

TOOL_BOOT_TEMPLATE="planifest-framework/templates/cursor-boot.md"

# Enforcement tier — native hooks adapter (ADR-001, REQ-009, REQ-013, REQ-027)
PLANIFEST_TIER=1
TOOL_HOOK_ADAPTER_SRC="hooks/adapters/cursor.mjs"
TOOL_HOOK_ADAPTER_DEST=".cursor/hooks/adapters/cursor.mjs"
TOOL_HOOKS_INSTALL_DIR=".cursor/hooks"
TOOL_SETTINGS_FILE=".cursor/settings.json"

# Register check-design for beforeSubmitPrompt in addition to gate-write for PreToolUse (REQ-018)
TOOL_BEFORE_SUBMIT_HOOK=true