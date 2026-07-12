# Agentic Tool Setup Reference

> How each supported coding tool discovers skills, and what the setup script creates for each.

---

## Agent Skills Specification

Planifest fully supports the [Agent Skills specification](https://agentskills.io/specification). Each skill is deployed as a directory whose name matches the `name` field in YAML frontmatter - the requirement the spec mandates. The framework is designed for tools that implement the Agent Skills standard: skills are discoverable, frontmatter-driven, and portable across any compliant tool.

---

## Scripts

Two setup scripts are provided - use whichever matches your OS:

| OS | Script | Interpreter |
|----|--------|-------------|
| macOS / Linux | `setup.sh` | Bash (pre-installed) |
| Windows | `setup.ps1` | PowerShell (pre-installed) |

**Zero dependencies.** Both scripts use only built-in OS capabilities - no Node.js, Python, or anything else required.

### Optional Flags

| Flag | Purpose |
|------|---------|
| `--context-mode-mcp` | Installs [context-mode](https://github.com/mksglu/context-mode) enforcement hooks (Claude Code only). Routing rules are provided by the plugin's system prompt. |
| `--structured-telemetry-mcp` | Installs `.claude/telemetry-enabled` sentinel and (with `--context-mode-mcp`) the `context-pressure.mjs` PostToolUse hook. |

---

## What the Script Does

For each tool, the script:

1. **Creates the tool's skill directory** (e.g., `.claude/skills/`)
2. **Copies each skill** as `{skill-name}/SKILL.md` with the required YAML frontmatter (`name` + `description`)
3. **Copies supporting files** (templates, standards, schemas) into the skill directory as `_planifest-*` folders
4. **Copies workflows** (feature-pipeline, change-pipeline, retrofit) into the tool's workflow directory
5. **Creates a boot file** (e.g., `CLAUDE.md`) if one doesn't already exist
6. **Copies capability skills** from `planifest-overrides/capability-skills/` directly into the tool's skill directory — no separate registry file needed; the tool discovers them the same way it discovers built-in skills
7. **Appends override instructions** from `planifest-overrides/instructions/*.md` to the boot file — idempotent, replaces the previous block on re-run

---

## Tool Reference

### Claude Code (Anthropic)

| Item | Detail |
|------|--------|
| **Skill discovery** | `.claude/skills/{name}/SKILL.md` |
| **Workflow discovery** | `.claude/commands/{name}.md` (becomes `/name` slash command) |
| **Boot file** | `CLAUDE.md` (project root) |
| **Personal skills** | `~/.claude/skills/` |
| **Frontmatter** | `name` + `description` required |
| **Progressive disclosure** | Yes - reads frontmatter first, loads body on demand |
| **Setup command** | `./planifest-framework/setup.sh claude-code` or `.\planifest-framework\setup.ps1 claude-code` |

**Creates:**
```
.claude/
├── skills/
│   ├── planifest-orchestrator/SKILL.md
│   ├── planifest-spec-agent/SKILL.md
│   ├── planifest-adr-agent/SKILL.md
│   ├── planifest-codegen-agent/SKILL.md
│   ├── planifest-validate-agent/SKILL.md
│   ├── planifest-security-agent/SKILL.md
│   ├── planifest-change-agent/SKILL.md
│   ├── planifest-docs-agent/SKILL.md
│   ├── _planifest-templates/
│   ├── _planifest-standards/
│   ├── _planifest-schemas/
└── commands/
    ├── feature-pipeline.md
    ├── change-pipeline.md
    └── retrofit.md
└── hooks/context-mode/ (if --context-mode-mcp)
    ├── block-bash.sh
    ├── block-grep.sh
    └── block-webfetch.sh
CLAUDE.md
```

---

### Cursor

| Item | Detail |
|------|--------|
| **Skill discovery** | `.cursor/skills/{name}/SKILL.md` |
| **Workflow discovery** | Embedded in `.cursor/rules/*.mdc` (no dedicated workflow dir) |
| **Rules** | `.cursor/rules/*.mdc` |
| **Compat paths** | Also scans `.claude/skills/`, `.codex/skills/` |
| **Personal skills** | `~/.cursor/skills/` |
| **Frontmatter** | `name` + `description` required |
| **Progressive disclosure** | Yes |
| **Setup command** | `./planifest-framework/setup.sh cursor` or `.\planifest-framework\setup.ps1 cursor` |

**Creates:**
```
.cursor/
├── skills/
│   ├── planifest-orchestrator/SKILL.md
│   ├── planifest-spec-agent/SKILL.md
│   ├── ... (all 8 skills)
│   ├── _planifest-templates/
│   ├── _planifest-standards/
│   └── _planifest-schemas/
└── rules/
    └── planifest.mdc
```

---

### Codex (OpenAI)

| Item | Detail |
|------|--------|
| **Skill discovery** | `.agents/skills/{name}/SKILL.md` (walks up to repo root) |
| **Workflow discovery** | `.agents/workflows/{name}.md` |
| **Boot file** | `AGENTS.md` (project root) |
| **Compat paths** | Also scans `.claude/skills/`, `.github/skills/` |
| **Personal skills** | `~/.codex/skills/` or `$CODEX_HOME/skills/` |
| **Frontmatter** | `name` + `description` required |
| **Progressive disclosure** | Yes |
| **Setup command** | `./planifest-framework/setup.sh codex` or `.\planifest-framework\setup.ps1 codex` |

**Creates:**
```
.agents/
├── skills/
│   ├── planifest-orchestrator/SKILL.md
│   ├── planifest-spec-agent/SKILL.md
│   ├── ... (all 8 skills)
│   ├── _planifest-templates/
│   ├── _planifest-standards/
│   └── _planifest-schemas/
└── workflows/
    ├── feature-pipeline.md
    ├── change-pipeline.md
    └── retrofit.md
AGENTS.md
```

---

### Antigravity (Google)

| Item | Detail |
|------|--------|
| **Skill discovery** | `.gemini/skills/{name}/SKILL.md` or `.agent/skills/{name}/SKILL.md` |
| **Workflow discovery** | `.agent/workflows/{name}.md` (becomes `/name` slash command) |
| **Boot file** | `GEMINI.md` (project root) |
| **Personal skills** | `~/.gemini/antigravity/skills/` |
| **Frontmatter** | `name` + `description` required |
| **Progressive disclosure** | Yes |
| **Link command** | `gemini skills link ./planifest-framework/skills/<name>` |
| **Setup command** | `./planifest-framework/setup.sh antigravity` or `.\planifest-framework\setup.ps1 antigravity` |

**Creates:**
```
.gemini/
└── skills/
    ├── planifest-orchestrator/SKILL.md
    ├── planifest-spec-agent/SKILL.md
    ├── ... (all 8 skills)
    ├── _planifest-templates/
    ├── _planifest-standards/
    └── _planifest-schemas/
.agent/
└── workflows/
    ├── feature-pipeline.md
    ├── change-pipeline.md
    └── retrofit.md
GEMINI.md
```

---

### GitHub Copilot

| Item | Detail |
|------|--------|
| **Skill discovery** | `.github/skills/{name}/SKILL.md` |
| **Workflow discovery** | `.github/copilot-workflows/{name}.md` (natural language workflows - avoids GitHub Actions conflict) |
| **Boot file** | `.github/copilot-instructions.md` |
| **Personal skills** | `~/.copilot/skills/` |
| **Frontmatter** | `name` + `description` + optional `license` |
| **Progressive disclosure** | Yes |
| **Setup command** | `./planifest-framework/setup.sh copilot` or `.\planifest-framework\setup.ps1 copilot` |

**Creates:**
```
.github/
├── skills/
│   ├── planifest-orchestrator/SKILL.md
│   ├── planifest-spec-agent/SKILL.md
│   ├── ... (all 8 skills)
│   ├── _planifest-templates/
│   ├── _planifest-standards/
│   └── _planifest-schemas/
├── copilot-workflows/
│   ├── feature-pipeline.md
│   ├── change-pipeline.md
│   └── retrofit.md
├── hooks/
│   └── copilot.mjs          ← gate-write + check-design adapter
└── copilot-instructions.md
```

---

### Windsurf (Codeium)

| Item | Detail |
|------|--------|
| **Skill discovery** | `.windsurf/skills/{name}/SKILL.md` |
| **Workflow discovery** | None - rules are embedded in `.windsurfrules` |
| **Boot file** | `.windsurfrules` (project root - always applied by Cascade) |
| **Frontmatter** | `name` + `description` required |
| **Progressive disclosure** | Yes |
| **Setup command** | `./planifest-framework/setup.sh windsurf` or `.\planifest-framework\setup.ps1 windsurf` |

**Creates:**
```
.windsurf/
└── skills/
    ├── planifest-orchestrator/SKILL.md
    ├── planifest-spec-agent/SKILL.md
    ├── ... (all 8 skills)
    ├── _planifest-templates/
    ├── _planifest-standards/
    └── _planifest-schemas/
.windsurfrules
```

---

### Cline

> **Note:** Roo Code support has been dropped. Roo Code was sunset on 02 May 2026 and had no hook API. Use `cline` for Cline-based setups.

| Item | Detail |
|------|--------|
| **Skill discovery** | `.clinerules/skills/{name}/SKILL.md` |
| **Workflow discovery** | None - instructions are embedded in `.clinerules` |
| **Boot file** | `.clinerules` (project root - always loaded as persistent context) |
| **Frontmatter** | `name` + `description` required |
| **Progressive disclosure** | Yes |
| **Setup command** | `./planifest-framework/setup.sh cline` or `.\planifest-framework\setup.ps1 cline` |

**Creates:**
```
.clinerules/
└── skills/
    ├── planifest-orchestrator/SKILL.md
    ├── planifest-spec-agent/SKILL.md
    ├── ... (all 8 skills)
    ├── _planifest-templates/
    ├── _planifest-standards/
    └── _planifest-schemas/
.clinerules
```

## Common Patterns Across All Tools

All seven tools share these conventions:
- Skills are folders containing a `SKILL.md` file
- `SKILL.md` must have YAML frontmatter with `name` and `description`
- Tools use **progressive disclosure** - they read frontmatter first, then load the full body on demand
- Personal/global skills in `~/.<tool>/skills/` override project skills
- No tool supports custom scan paths - only their hardcoded directories

---

## After Setup

1. **Commit the generated files** to version control if your team uses the same tool
2. **Re-run the script** after updating any skills, templates, or standards in `planifest-framework/`
3. **Add to `.gitignore`** if you don't want tool-specific files committed:
   ```
   .claude/
   .cursor/
   .agents/
   .gemini/
   .github/skills/
   .windsurf/
   .clinerules/
   ```

---

## Context-Mode Integration

When the `--context-mode-mcp` flag is passed, the setup script installs enforcement hooks for Claude Code. Routing rules are provided automatically by the context-mode plugin's system prompt — no separate file is needed.

### Enforcement Hooks (Claude Code Only)

For Claude Code, the script installs physical guardrails that prevent the agent from bypassing the routing rules.

- **Hook scripts** are copied from `planifest-framework/hooks/context-mode/` to `.claude/hooks/context-mode/`.
- **Settings integration**: `.claude/settings.json` is updated (via `jq` on Unix or PowerShell on Windows) to register these scripts as `PreToolUse` hooks.

| Hook | Intercepted Tool | Logic |
|------|-----------------|-------|
| `block-grep.sh` | `Grep` | Always blocked. Redirects to `ctx_execute`. |
| `block-bash.sh` | `Bash` | Blocked if command matches patterns: `grep`, `rg`, `curl`, `wget`. |
| `block-webfetch.sh` | `WebFetch` | Always blocked. Redirects to `ctx_fetch_and_index`. |

**Bash Allowlist**: The following commands are always allowed through `block-bash.sh`:
`git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`.

---

*Source of truth: `planifest-framework/` - the generated files are copies.*

