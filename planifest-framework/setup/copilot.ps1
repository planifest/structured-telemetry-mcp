# GitHub Copilot - tool configuration (REQ-015)
# https://docs.github.com/en/copilot/reference/hooks-configuration
#
# Skills:    .github/skills/{name}/SKILL.md       (auto-discovered)
# Workflows: .github/copilot-workflows/{name}.md
# Boot file: .github/copilot-instructions.md
# Hooks:     .github/hooks/planifest.json  (preToolUse + userPromptSubmitted)

@{
    SkillsDir    = '.github\skills'
    WorkflowsDir = '.github\copilot-workflows'
    BootFile     = '.github\copilot-instructions.md'
    BootTemplate = 'planifest-framework/templates/standard-boot.md'
    Tier         = 1
}
