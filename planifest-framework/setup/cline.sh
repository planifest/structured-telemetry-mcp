# Cline / Roo Code - tool configuration
# https://github.com/cline/cline  |  https://roosoft.com
#
# Skills:    .clinerules/skills/{name}/SKILL.md     (loaded via .clinerules context)
# Workflows: (none - Cline uses .clinerules for persistent instructions)
# Boot file: .clinerules                            (project root - always-on rules file)

TOOL_SKILLS_DIR=".clinerules/skills"
TOOL_WORKFLOWS_DIR=""

TOOL_BOOT_FILE=".clinerules"

TOOL_BOOT_TEMPLATE="planifest-framework/templates/standard-boot.md"

# Enforcement tier — native hooks adapter (ADR-001, REQ-009, REQ-013, REQ-027)
PLANIFEST_TIER=1
TOOL_HOOK_ADAPTER_SRC="hooks/adapters/cline.mjs"
TOOL_HOOK_ADAPTER_DEST=".clinerules/hooks/adapters/cline.mjs"
TOOL_HOOKS_INSTALL_DIR=".clinerules/hooks"
TOOL_SETTINGS_FILE=".clinerules/hooks.json"