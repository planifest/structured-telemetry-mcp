# Windsurf - tool configuration (REQ-016)
# https://docs.windsurf.com/windsurf/cascade/hooks
#
# Skills:    .windsurf/skills/{name}/SKILL.md       (auto-discovered via memories/rules)
# Workflows: (none - Windsurf uses rules, not a separate workflow directory)
# Boot file: .windsurfrules                         (project root - always-on rules file)
# Hooks:     .windsurf/hooks.json                   (pre_write_code, pre_mcp_tool_use, pre_user_prompt)

@{
    SkillsDir        = '.windsurf\skills'
    WorkflowsDir     = ''
    BootFile         = '.windsurfrules'
    BootTemplate     = 'planifest-framework/templates/standard-boot.md'

    # Enforcement — Tier 1: native hooks adapter (ADR-001, ADR-003, REQ-016)
    Tier             = 1
    HookAdapterSrc   = 'hooks\adapters\windsurf.mjs'
    HookAdapterDest  = '.windsurf\hooks\adapters\windsurf.mjs'
    HooksInstallDir  = '.windsurf\hooks'
    # Note: hook registration is written to .windsurf/hooks.json by Install-WindsurfHookConfig
    # called from Invoke-PlanifestSetup for Windsurf. Not via the generic SettingsFile path.
}
