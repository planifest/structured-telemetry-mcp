# GitHub Copilot - tool configuration (REQ-015)
# https://docs.github.com/en/copilot/reference/hooks-configuration
#
# Skills:    .github/skills/{name}/SKILL.md       (auto-discovered)
# Workflows: .github/copilot-workflows/{name}.md
# Boot file: .github/copilot-instructions.md
# Hooks:     .github/hooks/planifest.json  (preToolUse + userPromptSubmitted)

TOOL_SKILLS_DIR=".github/skills"
TOOL_WORKFLOWS_DIR=".github/copilot-workflows"

TOOL_BOOT_FILE=".github/copilot-instructions.md"

TOOL_BOOT_TEMPLATE="planifest-framework/templates/standard-boot.md"

# Enforcement tier — native hooks (Tier 1, REQ-015)
PLANIFEST_TIER=1
TOOL_HOOK_ADAPTER_SRC="hooks/adapters/copilot.mjs"
TOOL_HOOK_ADAPTER_DEST=".github/hooks/adapters/copilot.mjs"
TOOL_HOOKS_INSTALL_DIR=".github/hooks"

# Write .github/hooks/planifest.json (Copilot hook registration)
_copilot_hooks_dir="$PROJECT_ROOT/.github/hooks"
mkdir -p "$_copilot_hooks_dir"
cat > "$_copilot_hooks_dir/planifest.json" << 'EOF'
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "type": "command",
        "command": "node .github/hooks/adapters/copilot.mjs"
      }
    ],
    "userPromptSubmitted": [
      {
        "type": "command",
        "command": "node .github/hooks/adapters/copilot.mjs"
      }
    ]
  }
}
EOF
echo "  + .github/hooks/planifest.json (Copilot hook registration)"
