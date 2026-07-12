# Getting Started with Planifest

> Step-by-step instructions for humans setting up a Planifest project.
> For day-to-day operations reference, see [project-operations.md](project-operations.md). For deep pipeline mechanics, see [pipeline-reference.md](pipeline-reference.md).

---

## Prerequisites

- An agentic coding tool: Claude Code, Cursor, Codex, Antigravity, GitHub Copilot, Windsurf, Cline, or OpenCode
- A terminal with Bash (macOS/Linux) or PowerShell (Windows)

---

## New Project

### 1. Add the framework

Copy the `planifest-framework/` folder into your repository root. This is the only thing you need — it contains the skills, templates, standards, and setup scripts.

### 2. Create the project structure

```
mkdir plan plan/changelog src docs
```

These are the core working directories:
- `plan/` — The current change being planned.
  - `plan/current/design.md` — Confirmed design and build plan.
  - `plan/current/feature-brief.md` — The initiating human-authored brief.
  - `plan/current/build-log.md` — Working telemetry file maintained throughout the pipeline run.
  - `plan/current/iteration-log.md` — Audit trail of the pipeline run.
  - `plan/_archive/` — Historical plans filed here after merge.
  - `plan/changelog/` — A record of all changes (`{feature-id}-{YYYY-MM-DD}.md`).
- `src/` — Component source code, tests, and component manifests (`component.yml`).
- `docs/` — Living repository documentation (always current). Includes component registry and dependency graph.
- `planifest-overrides/` — Your team's customisations: override library standards, add permanent capability skills, or add project-specific instructions. Never overwritten by setup scripts. → See [project-operations.md → Customising](project-operations.md#customising-with-planifest-overrides).

See [feature-structure.md](../plan/feature-structure.md) for the full layout.

### 3. Run the setup script

This copies skills into the directory your agentic tool expects.

#### Basic setup

```bash
# macOS / Linux
chmod +x planifest-framework/setup.sh
./planifest-framework/setup.sh claude-code      # or cursor, codex, antigravity, copilot, windsurf, cline, opencode, all
```

```powershell
# Windows (PowerShell)
.\planifest-framework\setup.ps1 claude-code     # or cursor, codex, antigravity, copilot, windsurf, cline, opencode, all
```

Installs:
- Skill folders with YAML frontmatter (auto-discovered by your tool)
- Supporting files (templates, standards, schemas)
- A boot file for your tool (e.g. `CLAUDE.md`, `AGENTS.md`)
- Git guardrails and the orchestrator sentinel (activated automatically)

#### Option: Context-Mode (recommended)

[context-mode](https://github.com/mksglu/context-mode) routes large output — search results, file analysis, web fetches — into a sandboxed knowledge base. Only summaries enter the context window, so the agent stays fast and focused on large codebases.

Install context-mode first, then pass `--context-mode-mcp` during setup:

```bash
# macOS / Linux
./planifest-framework/setup.sh claude-code --context-mode-mcp
```

```powershell
# Windows (PowerShell)
.\planifest-framework\setup.ps1 claude-code --context-mode-mcp
```

See [docs/context-mode.md](../docs/context-mode.md) for prerequisites.

#### Option: Structured Telemetry

Requires [structured-telemetry-mcp](https://github.com/anthropics/structured-telemetry-mcp) to be running, then pass `--structured-telemetry-mcp`:

```bash
./planifest-framework/setup.sh claude-code --structured-telemetry-mcp
```

```powershell
.\planifest-framework\setup.ps1 claude-code --structured-telemetry-mcp
```

See [tool-setup-reference.md](tool-setup-reference.md) for what each tool expects.

→ **Git guardrails and the orchestrator sentinel** are activated automatically by setup. See [project-operations.md](project-operations.md) for how they work and how to enable strict mode.

### 4. Write your first feature brief

Use the template:

```
cp planifest-framework/templates/feature-brief.template.md plan/current/feature-brief.md
```

Fill it in. The [feature brief guide](templates/feature-brief-guide.md) walks you through each section.

Every agent response begins with a phase prefix (`P0:`, `P1:`, …) so you always know where you are in the pipeline. → See [pipeline-reference.md → Phase Indicators](pipeline-reference.md#phase-indicators) for the full table.

### 5. Start the orchestrator

Open your agentic tool. The orchestrator skill is now auto-discovered. Tell it:

```
Execute the confirmed design Agentic Iteration Loop.
Feature brief: plan/current/feature-brief.md
```

The orchestrator will assess your brief, coach you through any gaps, produce a confirmed design, then ask whether you want per-phase confirmation or a continuous run before executing the pipeline.

---

## Next Steps

| Topic | Where to look |
|-------|---------------|
| Git guardrails and how enforcement works | [project-operations.md](project-operations.md#git-guardrails) |
| Orchestrator sentinel and strict mode | [project-operations.md](project-operations.md#orchestrator-sentinel) |
| Customising with planifest-overrides | [project-operations.md](project-operations.md#customising-with-planifest-overrides) |
| Updating the framework | [project-operations.md](project-operations.md#updating-the-framework) |
| What to commit | [project-operations.md](project-operations.md#what-to-commit) |
| Retrofit an existing project | [project-operations.md](project-operations.md#retrofit-an-existing-project) |
| Trivial fixes (Fast Path) | [pipeline-reference.md](pipeline-reference.md#trivial-fixes--fast-path) |
| Targeted changes (Change Pipeline) | [pipeline-reference.md](pipeline-reference.md#change-pipeline) |
| Phase mechanics and confirmation gates | [pipeline-reference.md](pipeline-reference.md) |
