# Windsurf - tool configuration (REQ-016)
# https://docs.windsurf.com/windsurf/cascade/hooks
#
# Skills:    .windsurf/skills/{name}/SKILL.md       (auto-discovered via memories/rules)
# Workflows: (none - Windsurf uses rules, not a separate workflow directory)
# Boot file: .windsurfrules                         (project root - always-on rules file)
# Hooks:     .windsurf/hooks.json                   (pre_write_code, pre_mcp_tool_use, pre_user_prompt)

TOOL_SKILLS_DIR=".windsurf/skills"
TOOL_WORKFLOWS_DIR=""

TOOL_BOOT_FILE=".windsurfrules"

TOOL_BOOT_TEMPLATE="planifest-framework/templates/standard-boot.md"

# Enforcement tier — native hooks adapter (ADR-001, ADR-003, REQ-016)
PLANIFEST_TIER=1
TOOL_HOOK_ADAPTER_SRC="hooks/adapters/windsurf.mjs"
TOOL_HOOK_ADAPTER_DEST=".windsurf/hooks/adapters/windsurf.mjs"
TOOL_HOOKS_INSTALL_DIR=".windsurf/hooks"

# Write .windsurf/hooks.json (Planifest-managed workspace hook config per ADR-002)
mkdir -p "$PROJECT_ROOT/.windsurf"
cat > "$PROJECT_ROOT/.windsurf/hooks.json" << 'EOF'
{
  "hooks": {
    "pre_write_code": [
      {
        "command": "node planifest-framework/hooks/adapters/windsurf.mjs"
      }
    ],
    "pre_mcp_tool_use": [
      {
        "command": "node planifest-framework/hooks/adapters/windsurf.mjs"
      }
    ],
    "pre_user_prompt": [
      {
        "command": "node planifest-framework/hooks/adapters/windsurf.mjs"
      }
    ]
  }
}
EOF
echo "  + .windsurf/hooks.json (Windsurf hook registration)"
