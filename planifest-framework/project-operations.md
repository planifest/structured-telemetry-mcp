# Project Operations

> Day-to-day operations reference for Planifest projects. For first-time setup, start with [getting-started.md](getting-started.md). For detailed step-by-step coverage of every topic on this page, see [pipeline-reference.md](pipeline-reference.md).

---

## Git Guardrails

The setup script activates a **three-tier Progressive Guardrail System** that protects `main` without blocking atomic commits.

| Tier | When | Effect |
|------|------|--------|
| **1 — Advisory pre-commit** | Every local commit | Warns if code was staged without docs. Commit **succeeds**. |
| **2 — Branch pre-push** | Every `git push` | Fails if `src/` changed with no update to `plan/`, `docs/`, or `component.yml` — unless all commits use `fix(fast-path):`, which requires only a `component.yml` or changelog update. |
| **3 — CI/CD pipeline** | Every Pull Request | Same check in GitHub Actions. Blocks the merge button on violation. Recognises `fix(fast-path):` with the same relaxed rule. |

Hooks live in `planifest-framework/hooks/` and are wired via `git config core.hooksPath`. No `.git/` modifications required. The CI workflow is copied to `.github/workflows/planifest.yml` on first setup.

→ [Detailed guardrail mechanics, hook file locations, and violation messages](pipeline-reference.md#git-guardrails)

---

## Orchestrator Sentinel

When Phase 0 starts, the orchestrator writes `plan/.orchestrator-active` containing the active feature-id. Three hooks check for it on every turn:

| Hook | What it does |
|------|-------------|
| **gate-write** (PreToolUse) | Blocks writes outside always-permitted paths unless `plan/current/design.md` exists and the target path is a declared component |
| **check-orchestrator-presence** (UserPromptSubmit) | Injects a reminder banner on every prompt while a pipeline is active, so the orchestrator skill reloads after context compaction or session resume |
| **check-design** (UserPromptSubmit) | Injects a hard STOP message if neither the sentinel nor a `feature-brief.md` is present |

The sentinel is deleted last at Phase 7, after the archive is confirmed complete. You never create or delete it manually.

**If a pipeline run is interrupted** and you want to start fresh: delete `plan/.orchestrator-active` and `plan/current/feature-brief.md`, then reload the orchestrator.

→ [Full sentinel lifecycle, hook internals, gate-write interaction with design.md, and manual recovery](pipeline-reference.md#orchestrator-sentinel)

---

## Strict Orchestrator Mode

By default, `check-orchestrator-presence` is advisory — it injects a reminder banner but never blocks. Enable **strict mode** for stronger enforcement:

```bash
# macOS / Linux
./planifest-framework/setup.sh claude-code --strict-orchestrator
```

```powershell
# Windows (PowerShell)
.\planifest-framework\setup.ps1 claude-code --strict-orchestrator
```

This writes `plan/.orchestrator-strict`. When present, the hook injects a **hard-block banner** on every new session until the orchestrator loads and writes a session acknowledgement to `plan/.orchestrator-ack`. Subsequent prompts in the same session pass silently. The ack file is deleted at Phase 7 so each new pipeline starts clean.

→ [Strict mode internals, ack file lifecycle, and session_id protocol](pipeline-reference.md#strict-orchestrator-mode)

---

## Customising with planifest-overrides

`planifest-overrides/` is your team's customisation layer — committed to the repo, never overwritten by setup scripts.

| Directory | Purpose |
|-----------|---------|
| `library-standards/` | Override framework library preferences per language. Agents check here before the framework defaults. Structure mirrors `planifest-framework/standards/library-standards/`. |
| `instructions/` | Project-specific instructions appended to the boot file (e.g. `CLAUDE.md`) on every setup run. Files sorted alphabetically and injected between HTML comment markers. |
| `capability-skills/` | Permanent agent skills installed alongside built-in Planifest skills on every setup run. Each skill is a directory containing a `SKILL.md`. |

→ [Full directory structure, file formats, and examples](pipeline-reference.md#customising-with-planifest-overrides)

---

## Updating the Framework

After pulling new files into `planifest-framework/`, re-run the setup script to propagate changes. Pass the same flags used during initial setup. Re-running is idempotent.

```bash
# macOS / Linux
./planifest-framework/setup.sh claude-code
./planifest-framework/setup.sh claude-code --context-mode-mcp
./planifest-framework/setup.sh claude-code --context-mode-mcp --structured-telemetry-mcp
```

```powershell
# Windows (PowerShell)
.\planifest-framework\setup.ps1 claude-code
.\planifest-framework\setup.ps1 claude-code --context-mode-mcp
.\planifest-framework\setup.ps1 claude-code --context-mode-mcp --structured-telemetry-mcp
```

After updating, check `planifest-framework/migrations/` for any pending `.md` files — the orchestrator will handle them automatically at next session start.

→ [Full update protocol and migration handling](pipeline-reference.md#updating-the-framework)

---

## What to Commit

| Path | Commit? | Why |
|------|:-------:|-----|
| `planifest-framework/` | ✅ | Source of truth — shared with team |
| `planifest-framework/hooks/` | ✅ | Git hooks and CI workflow — applied by setup scripts |
| `.github/workflows/planifest.yml` | ✅ | CI/CD strict gate — must be committed to take effect |
| `plan/` | ✅ | Feature briefs, execution plans, ADRs, scope docs — commit throughout the pipeline run, not just at P7 |
| `src/` | ✅ | Component code and manifests |
| `docs/` | ✅ | Repo-wide registry and dependency graph |
| `planifest-overrides/` | ✅ | Team customisations — commit to share with the team |
| `.claude/`, `.cursor/`, `.agents/`, `.gemini/`, `.github/skills/` | Optional | Generated copies — can be `.gitignore`d and regenerated by setup |
| `CLAUDE.md`, `AGENTS.md` | Optional | Boot files — regenerated by setup |
| `.claude/telemetry-enabled` | Optional | Telemetry opt-in sentinel |

→ [What "Optional" means and commit message standards](pipeline-reference.md#what-to-commit)

---

## Retrofit an Existing Project

Add Planifest to a codebase that already has source code.

1. Copy `planifest-framework/` into your repo root
2. Run the setup script for your tool (see [getting-started.md → Run the setup script](getting-started.md#3-run-the-setup-script))
3. Add a `component.yml` manifest to each existing component in `src/` — use the [component manifest template](templates/component.template.yml) and [guide](templates/component-guide.md)
4. Tell the orchestrator to use **retrofit** adoption mode:

```
Execute the confirmed design Agentic Iteration Loop in retrofit mode.
Feature brief: plan/current/feature-brief.md
```

In retrofit mode, the orchestrator runs a structured discovery pass before Phase 0 coaching — scanning entry points, mapping data ownership, discovering API contracts, and surfacing tech debt — then uses those findings to reduce the coaching questions you need to answer.

→ [Full retrofit discovery protocol: entry point scan, component identification, data ownership mapping, API contract discovery, pattern detection, and tech debt surfacing](pipeline-reference.md#retrofit-an-existing-project)
