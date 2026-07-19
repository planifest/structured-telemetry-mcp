# OpenAI Codex - tool configuration (REQ-019)
# https://openai.com/codex
#
# Skills:    .agents/skills/{name}/SKILL.md       (auto-discovered)
# Workflows: .agents/workflows/{name}.md          (auto-discovered)
# Boot file: AGENTS.md                            (project root)
# Hooks:     .codex/config.toml features.codex_hooks = true (PreToolUse, UserPromptSubmit)
#
# Hook envelope: { hook_event_name, session_id, cwd, tool_name, tool_input }
# Block format:  JSON deny via stdout (not exit code) — exit 0 always

TOOL_SKILLS_DIR=".agents/skills"
TOOL_WORKFLOWS_DIR=".agents/workflows"

TOOL_BOOT_FILE="AGENTS.md"

TOOL_BOOT_TEMPLATE="planifest-framework/templates/standard-boot.md"

# Enforcement tier — Bash-only adapter; no settings.json wiring (ADR-001, REQ-010, REQ-019)
PLANIFEST_TIER=1b
TOOL_HOOK_ADAPTER_SRC="hooks/adapters/codex.mjs"
TOOL_HOOK_ADAPTER_DEST=".agents/hooks/adapters/codex.mjs"
TOOL_HOOKS_INSTALL_DIR=".agents/hooks"