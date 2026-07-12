# Cline / Roo Code - tool configuration
# https://github.com/cline/cline  |  https://roosoft.com
#
# Skills:    .clinerules/skills/{name}/SKILL.md     (loaded via .clinerules context)
# Workflows: (none - Cline uses .clinerules for persistent instructions)
# Boot file: .clinerules                            (project root - always-on rules file)

@{
    SkillsDir        = '.clinerules\skills'
    WorkflowsDir     = ''
    BootFile         = '.clinerules'
    BootTemplate     = 'planifest-framework/templates/standard-boot.md'

    # Enforcement — Tier 1: native hooks adapter (REQ-009)
    Tier             = 1
    HookAdapterSrc   = 'hooks\adapters\cline.mjs'
    HookAdapterDest  = '.clinerules\hooks\adapters\cline.mjs'
    HooksInstallDir  = '.clinerules\hooks'
    SettingsFile     = '.clinerules\hooks.json'
}
