# Roadmap Item: Structured Telemetry Framework Integration (0008b)

## Source
Planifest Framework Review (April 2026) → Section 4: The Tooling Ecosystem & Observability

## Observation
Once the [Structured Telemetry MCP Server (0008a)](../0008a--feature--structured-telemetry-mcp-server.md) is deployed, the Planifest framework must be wired to use it. This requires an explicit opt-in mechanism in the setup scripts and precise telemetry sections in each agent skill so that events are emitted consistently and with the correct data shape.

## Planifest Rating
🟠 Developing

## Recommendation
Wire the Planifest framework to the telemetry service via an explicit `--structured-telemetry-mcp` setup flag. Update agent skills with structured Telemetry sections specifying exact event types and required data fields. Install a combined context-pressure hook when both `--structured-telemetry-mcp` and `--context-mode-mcp` are active.

---

## Design Goals

1. **Explicit opt-in.** Telemetry is disabled by default. Only activated when `--structured-telemetry-mcp` is passed to the setup script.
2. **Zero fallback.** If the MCP server is not provisioned, no telemetry is emitted. No local file fallbacks.
3. **Tool-presence gating.** Agents check for the `emit_event` tool before any emission attempt. If absent, skip silently.
4. **Schema-strict payloads.** Skill Telemetry sections specify exact required fields to match the server's `additionalProperties: false` schema.
5. **Context-mode ready.** When both flags are active, a hook captures `context_pressure` events automatically.

---

## Prerequisites

The HTTP backend service must be running before setup is executed. The service owns the single DuckDB connection that all MCP stdio sessions write through.

```powershell
# Windows — run once as administrator
.\scripts\deploy.ps1          # builds, installs globally, registers Windows service
```

```bash
# macOS / Linux — run once
./scripts/deploy.sh
```

Verify:
```powershell
curl http://127.0.0.1:3741/health   # → {"ok":true,"version":"0.1.0"}
```

---

## Setup Flag

The framework `setup.ps1` / `setup.sh` scripts accept `--structured-telemetry-mcp` after the tool argument:

```powershell
# Windows
.\planifest-framework\setup.ps1 claude-code --structured-telemetry-mcp
.\planifest-framework\setup.ps1 claude-code --context-mode-mcp --structured-telemetry-mcp
```

```bash
# macOS / Linux
./planifest-framework/setup.sh claude-code --structured-telemetry-mcp
./planifest-framework/setup.sh claude-code --context-mode-mcp --structured-telemetry-mcp
```

An optional `--backend-url` argument overrides the default backend port:

```powershell
.\planifest-framework\setup.ps1 claude-code --structured-telemetry-mcp --backend-url http://localhost:3741
```

### What the flag does

1. **Registers the MCP server** in the tool's configuration file using a `command + args` entry. The stdio process is a thin proxy; all DB writes go to the HTTP backend.

   **Claude Code** (`~/.claude/settings.json`):
   ```json
   "mcpServers": {
     "structured-telemetry-mcp": {
       "command": "C:\\Program Files\\nodejs\\node.exe",
       "args": [
         "C:\\...\\node_modules\\structured-telemetry-mcp\\server.bundle.mjs",
         "http://localhost:3741"
       ]
     }
   }
   ```

   **Claude Desktop** (`claude_desktop_config.json`): same `command + args` format.

   **Cursor** (`.cursor/mcp.json`): same `command + args` format.

2. **Does not restart the tool.** The user must restart their agentic tool after setup for the new MCP server to be discovered.

3. **Does not register a hook by itself.** The `context_pressure` hook is only installed when `--context-mode-mcp` is also present (see Context Pressure Hooks below).

---

## Event Envelope

Every event shares this envelope. Fields are resolved as follows:

| Field | Source |
|---|---|
| `schema_version` | Always `"1.0"` |
| `event` | The specific event type (see table below) |
| `session_id` | context-mode session ID if available; otherwise `crypto.randomUUID()` per run |
| `initiative_id` | Feature ID read from `plan/current/design.md` header; omit if not in a pipeline run |
| `phase` | Current pipeline phase: `orchestrator`, `spec`, `adr`, `codegen`, `validate`, `security`, `docs`, `change` |
| `agent` | Skill name: `planifest-orchestrator`, `planifest-codegen-agent`, etc. |
| `tool` | Agentic tool: `claude-code`, `cursor`, `antigravity`, etc. |
| `model` | Model identifier, e.g. `claude-sonnet-4-6` |
| `mcp_mode` | Determined at session start from active setup flags: `none`, `workspace`, `context`, or `workspace+context` |
| `timestamp` | ISO 8601 at point of emission |
| `data` | Typed payload — see per-event schemas below |

### Determining `mcp_mode`

| Active setup flags | `mcp_mode` value |
|---|---|
| Neither `--mcp-workspace` nor `--context-mode-mcp` | `"none"` |
| `--mcp-workspace` only | `"workspace"` |
| `--context-mode-mcp` only | `"context"` |
| Both | `"workspace+context"` |

The agent stamps this value on every event. It is the primary dimension for MCP impact analysis.

---

## Skill Telemetry Sections

Each affected `SKILL.md` gains a **Telemetry** section. The data fields shown are the exact required fields — the server rejects additional properties.

### planifest-orchestrator

```markdown
## Telemetry
If `emit_event` is available:

**phase_start** — emit before delegating to any phase skill:
```json
{ "phase_name": "<current phase name>" }
```

**phase_end** — emit after each phase skill returns:
```json
{ "phase_name": "<phase>", "status": "pass" | "fail", "duration_ms": <elapsed> }
```

**spec_gap** — emit when human clarification is required before proceeding:
```json
{ "question": "<the question being asked>", "phase_name": "<current phase>" }
```
```

### planifest-spec-agent, planifest-adr-agent

```markdown
## Telemetry
If `emit_event` is available:

**phase_start** at task entry. **phase_end** at task exit.

**spec_gap** when the spec or ADR cannot proceed without human input:
```json
{ "question": "<blocking question>", "phase_name": "spec" | "adr" }
```
```

### planifest-codegen-agent, planifest-change-agent

```markdown
## Telemetry
If `emit_event` is available:

**phase_start** / **phase_end** at task boundaries.

**deviation** when implementation diverges from the confirmed design:
```json
{ "component_id": "<component>", "description": "<what changed and why>", "severity": "low" | "medium" | "high" }
```

**migration_proposal** when a schema change is required (before writing the proposal file):
```json
{ "component_id": "<component>", "proposal_path": "src/<id>/docs/migrations/proposed-<desc>.md", "destructive": true | false }
```

**self_correction** when retrying a failed action:
```json
{ "phase_name": "<phase>", "attempt_number": <n>, "action_id": "<action>", "correction_type": "<type>" }
```
```

### planifest-validate-agent

```markdown
## Telemetry
If `emit_event` is available:

**phase_start** / **phase_end** at task boundaries.

**validation_failure** for each test or check failure:
```json
{ "failure_type": "<test|lint|type|build>", "phase_name": "validate", "attempt_number": <n>, "action_id": "<test suite or check name>" }
```

**self_correction** when retrying after a failure:
```json
{ "phase_name": "validate", "attempt_number": <n>, "action_id": "<action>", "correction_type": "fix_and_retry" }
```
```

### planifest-security-agent, planifest-docs-agent

```markdown
## Telemetry
If `emit_event` is available:

**phase_start** / **phase_end** at task boundaries.

**deviation** if the output diverges from the confirmed design:
```json
{ "component_id": "<component>", "description": "<deviation>", "severity": "low" | "medium" | "high" }
```
```

---

## Context Pressure Hooks

When both `--structured-telemetry-mcp` and `--context-mode-mcp` are active, the setup script installs an additional `PostToolUse` hook alongside the existing context-mode hooks.

**Hook behaviour:** after each tool call, the hook reads the current context fill percentage from the context-mode session state and emits a `context_pressure` event if the fill percentage exceeds a configured threshold (default: 70%).

```json
{
  "event": "context_pressure",
  "data": {
    "context_fill_pct": 78.5,
    "unused_sources": ["design.md", "ADR-003"],
    "trigger": "threshold_exceeded"
  }
}
```

The hook is installed at:
- `.claude/hooks/telemetry/context-pressure.mjs` (Claude Code)
- Registered in `.claude/settings.json` as a `PostToolUse` hook

---

## Framework Changes Required

| File | Change |
|---|---|
| `planifest-framework/setup.sh` | Add `--structured-telemetry-mcp` flag; call `structured-telemetry-mcp setup --non-interactive --tool <tool>` |
| `planifest-framework/setup.ps1` | Same as above (PowerShell) |
| `planifest-framework/hooks/telemetry/context-pressure.mjs` | New hook — emits `context_pressure` when fill % exceeds threshold |
| `skills/planifest-orchestrator/SKILL.md` | Add Telemetry section: `phase_start`, `phase_end`, `spec_gap` |
| `skills/planifest-spec-agent/SKILL.md` | Add Telemetry section: `phase_start`, `phase_end`, `spec_gap` |
| `skills/planifest-adr-agent/SKILL.md` | Add Telemetry section: `phase_start`, `phase_end` |
| `skills/planifest-codegen-agent/SKILL.md` | Add Telemetry section: `phase_start`, `phase_end`, `deviation`, `migration_proposal`, `self_correction` |
| `skills/planifest-validate-agent/SKILL.md` | Add Telemetry section: `phase_start`, `phase_end`, `validation_failure`, `self_correction` |
| `skills/planifest-change-agent/SKILL.md` | Add Telemetry section: `phase_start`, `phase_end`, `deviation`, `migration_proposal`, `self_correction` |
| `skills/planifest-security-agent/SKILL.md` | Add Telemetry section: `phase_start`, `phase_end`, `deviation` |
| `skills/planifest-docs-agent/SKILL.md` | Add Telemetry section: `phase_start`, `phase_end`, `deviation` |

---

## Dependencies

| Dependency | Required for |
|---|---|
| **0008a** — Structured Telemetry MCP Server | The ingestion backend. Must be deployed and running before setup. |
| **0006c** — context-mode | Automated `context_pressure` events via `PostToolUse` hook. Without it, pressure data requires manual emission. |

---

## Resolved Questions

1. **Auto-discovery**: The setup script does not auto-discover a running server. The `--structured-telemetry-mcp` flag is always required. ✅
2. **Schema bundling**: The framework does not bundle a local copy of the schema. Validation is performed exclusively by the MCP server at ingestion time. ✅
3. **MCP config format**: `command + args` (stdio proxy → HTTP backend). Not SSE URL. Works identically across Claude Code, Claude Desktop, and Cursor. ✅
