# Google Antigravity - tool configuration
# https://antigravity.google
#
# Skills:    .gemini/skills/{name}/SKILL.md       (auto-discovered)
# Workflows: .agent/workflows/{name}.md           (becomes /name slash command)
# Boot file: GEMINI.md                            (project root)

TOOL_SKILLS_DIR=".gemini/skills"
TOOL_WORKFLOWS_DIR=".agent/workflows"

TOOL_BOOT_FILE="GEMINI.md"

TOOL_BOOT_TEMPLATE="planifest-framework/templates/standard-boot.md"

# Enforcement tier — no native hook system; instructions-only (ADR-001, REQ-012)
PLANIFEST_TIER=3