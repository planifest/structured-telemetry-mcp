# structured-telemetry-mcp — Usage Guide

Structured telemetry for agentic pipelines. Stores events in a local DuckDB database and exposes them via two interfaces: an **MCP server** (for agent tools) and a **REST API** (for scripts, CI, and direct calls).

---

## Contents

1. [Architecture overview](#1-architecture-overview)
2. [Installation](#2-installation)
3. [Using via MCP](#3-using-via-mcp)
4. [Using via REST API](#4-using-via-rest-api)
5. [Event envelope schema](#5-event-envelope-schema)
6. [Event types and data payloads](#6-event-types-and-data-payloads)
7. [Query reference](#7-query-reference)

---

## 1. Architecture overview

```
Agent tool (Claude Code, Cursor, etc.)
    │  MCP stdio proxy
    ▼
server.bundle.mjs ──► HTTP backend (port 3741)
                           │
                      DuckDB (telemetry.db)
                           │
                    ◄── POST /query
                    ◄── POST /emit
                    ◄── GET  /health
```

The daemon runs as a Windows service (`structured-telemetry-mcp`). Agent tools connect via the MCP stdio proxy; scripts connect directly to the HTTP backend.

---

## 2. Installation

### Prerequisites

- Node.js 18+
- nssm (Windows service manager): `choco install nssm`
- Admin PowerShell for deploy

### Steps

```powershell
# 1. Build
.\scripts\build.ps1

# 2. Deploy (installs globally + registers Windows service)
.\scripts\deploy.ps1        # must be run as Administrator

# 3. Register with your agent tool
.\scripts\setup.ps1         # interactive menu
.\scripts\setup.ps1 -Tool claudecode   # or specify directly
```

Supported tools: `claudecode`, `cursor`, `windsurf`, `vscode`, `codex`, `opencode`, `antigravity`, `jetbrains`, `manual`.

### Verify

```powershell
structured-telemetry-mcp doctor
```

Expected output: service running, DB reachable, port 3741 responding.

---

## 3. Using via MCP

Once registered with your agent tool, two MCP tools are available.

### Tool: `emit_event`

Ingests a structured telemetry event.

**Input schema:**
```json
{
  "event": { /* TelemetryEvent envelope — see Section 5 */ }
}
```

**Response:**
```json
{ "ok": true, "id": "uuid-of-stored-event" }
```
or on validation failure:
```json
{ "ok": false, "errors": ["phase: must be one of ..."] }
```

**Example — emit a phase_start:**
```json
{
  "event": {
    "schema_version": "1.0",
    "event": "phase_start",
    "session_id": "session-abc-123",
    "phase": "codegen",
    "agent": "planifest-codegen-agent",
    "tool": "claude-code",
    "model": "claude-sonnet-4-6",
    "mcp_mode": "workspace",
    "timestamp": "2026-04-19T10:00:00.000Z",
    "data": { "phase_name": "codegen" }
  }
}
```

---

### Tool: `query_telemetry`

Runs a query against stored telemetry. Returns Markdown table, JSON aggregation, and a raw event sample.

**Input schema:**
```json
{
  "query": { /* QueryShape — see Section 7 */ }
}
```

**Response:** Formatted text with three sections:
- `## Results` — Markdown table
- `## JSON` — aggregation JSON
- `## Raw Sample` — up to 5 raw events

**Example — query bottlenecks by phase:**
```json
{
  "query": { "group_by": "phase" }
}
```

---

## 4. Using via REST API

The daemon listens on `http://127.0.0.1:3741`.

### `GET /health`

Health check.

```bash
curl http://127.0.0.1:3741/health
```

Response:
```json
{ "ok": true, "db": "connected" }
```

---

### `POST /emit`

Ingest an event. Body is the full `TelemetryEvent` envelope (not wrapped).

```bash
curl -X POST http://127.0.0.1:3741/emit \
  -H "Content-Type: application/json" \
  -d '{
    "schema_version": "1.0",
    "event": "phase_start",
    "session_id": "my-session-001",
    "phase": "codegen",
    "agent": "my-agent",
    "tool": "curl",
    "model": "n/a",
    "mcp_mode": "none",
    "timestamp": "2026-04-19T10:00:00.000Z",
    "data": { "phase_name": "codegen" }
  }'
```

Response:
```json
{ "ok": true, "id": "a1b2c3d4-..." }
```

PowerShell equivalent:
```powershell
$base = @{
  schema_version = "1.0"
  session_id     = "my-session-001"
  agent          = "my-agent"
  tool           = "powershell"
  model          = "n/a"
  mcp_mode       = "none"
  timestamp      = (Get-Date -Format "o")
}
function Emit($body) {
  Invoke-RestMethod -Uri http://127.0.0.1:3741/emit `
    -Method Post -ContentType "application/json" `
    -Body ($body | ConvertTo-Json -Depth 5)
}

Emit ($base + @{ event = "phase_start"; phase = "codegen"; data = @{ phase_name = "codegen" } })
```

---

### `POST /query`

Run a query. Body is the query shape directly (not wrapped).

```bash
curl -X POST http://127.0.0.1:3741/query \
  -H "Content-Type: application/json" \
  -d '{ "group_by": "phase" }'
```

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:3741/query `
  -Method Post -ContentType "application/json" `
  -Body '{ "group_by": "phase" }'
```

---

## 5. Event envelope schema

Every event shares the same outer envelope. All fields are required unless marked optional.

| Field | Type | Values / constraints |
|---|---|---|
| `schema_version` | string | `"1.0"` (constant) |
| `event` | string | See event types below |
| `session_id` | string | Non-empty. UUID identifying the agent session |
| `phase` | string | `orchestrator` `spec` `adr` `codegen` `validate` `security` `docs` `change` `ship` |
| `agent` | string | Non-empty. Skill name of the emitting agent |
| `tool` | string | Non-empty. Agent tool name (e.g. `claude-code`, `cursor`) |
| `model` | string | Non-empty. Model identifier (e.g. `claude-sonnet-4-6`) |
| `mcp_mode` | string | `none` `workspace` `context` `workspace+context` |
| `timestamp` | string | ISO 8601 date-time |
| `initiative_id` | string | **Optional.** Feature/initiative identifier |
| `model_config` | object | **Optional.** Tool-specific model config (e.g. `{ "thinking": true }`) |
| `data` | object | **Optional.** Typed payload — structure depends on `event` |

---

## 6. Event types and data payloads

### `phase_start`
Signal entry into a pipeline phase.
```json
{ "data": { "phase_name": "codegen" } }
```
| Field | Type | Required |
|---|---|---|
| `phase_name` | string | yes |

---

### `phase_end`
Signal completion of a pipeline phase.
```json
{ "data": { "phase_name": "codegen", "status": "pass", "duration_ms": 4200 } }
```
| Field | Type | Required | Values |
|---|---|---|---|
| `phase_name` | string | yes | |
| `status` | string | yes | `pass` `fail` |
| `duration_ms` | number | yes | >= 0 |
| `content_type` | string | no | |

---

### `spec_gap`
A required specification element was missing or ambiguous.
```json
{ "data": { "question": "What is the retry limit?", "phase_name": "spec" } }
```
| Field | Type | Required |
|---|---|---|
| `question` | string | yes |
| `phase_name` | string | yes |

---

### `validation_failure`
A validation step failed.
```json
{ "data": { "failure_type": "schema", "phase_name": "validate", "attempt_number": 2, "action_id": "emit-001" } }
```
| Field | Type | Required |
|---|---|---|
| `failure_type` | string | yes |
| `phase_name` | string | yes |
| `attempt_number` | integer | yes (>= 1) |
| `action_id` | string | yes |

---

### `deviation`
Implementation deviated from the spec or ADR.
```json
{ "data": { "component_id": "auth-service", "description": "Used bcrypt instead of argon2", "severity": "medium" } }
```
| Field | Type | Required | Values |
|---|---|---|---|
| `component_id` | string | yes | |
| `description` | string | yes | |
| `severity` | string | yes | `low` `medium` `high` |

---

### `migration_proposal`
A database migration has been proposed.
```json
{ "data": { "component_id": "users-db", "proposal_path": "migrations/0003-add-token.sql", "destructive": false } }
```
| Field | Type | Required |
|---|---|---|
| `component_id` | string | yes |
| `proposal_path` | string | yes |
| `destructive` | boolean | yes |

---

### `context_pressure`
Context window usage is approaching a threshold.
```json
{ "data": { "context_fill_pct": 87.5, "unused_sources": ["design.md"], "trigger": "large file read" } }
```
| Field | Type | Required |
|---|---|---|
| `context_fill_pct` | number | yes (0–100) |
| `unused_sources` | string[] | yes |
| `trigger` | string | yes |

---

### `mcp_impact`
Records token delta attributable to MCP mode.
```json
{ "data": { "mcp_mode": "workspace", "avg_token_delta": 1240, "peak_fill_pct": 91.2 } }
```
| Field | Type | Required |
|---|---|---|
| `mcp_mode` | string | yes |
| `avg_token_delta` | number | yes |
| `peak_fill_pct` | number | yes (0–100) |

---

### `self_correction`
The agent corrected its own output.
```json
{ "data": { "phase_name": "codegen", "attempt_number": 2, "action_id": "edit-004", "correction_type": "logic_error" } }
```
| Field | Type | Required |
|---|---|---|
| `phase_name` | string | yes |
| `attempt_number` | integer | yes (>= 1) |
| `action_id` | string | yes |
| `correction_type` | string | yes |

---

### `phase_skip`
A phase was intentionally skipped.
```json
{ "data": { "phase_name": "security", "reason": "no network-facing changes" } }
```
| Field | Type | Required |
|---|---|---|
| `phase_name` | string | yes |
| `reason` | string | yes |

---

### `security_finding`
A security issue was identified.
```json
{ "data": { "component_id": "api-gateway", "title": "SQL injection via unescaped input", "severity": "high", "cwe": "CWE-89" } }
```
| Field | Type | Required | Values |
|---|---|---|---|
| `component_id` | string | yes | |
| `title` | string | yes | |
| `severity` | string | yes | `low` `medium` `high` `critical` |
| `cwe` | string | no | |

---

### `retry_limit_exceeded`
Maximum retry attempts reached for an action.
```json
{ "data": { "phase_name": "validate", "action_id": "test-run-001", "attempt_count": 5 } }
```
| Field | Type | Required |
|---|---|---|
| `phase_name` | string | yes |
| `action_id` | string | yes |
| `attempt_count` | integer | yes (>= 1) |

---

### `adr_decision`
An architectural decision was recorded.
```json
{ "data": { "adr_id": "ADR-007", "title": "Use DuckDB for local storage", "chosen_option": "DuckDB embedded" } }
```
| Field | Type | Required |
|---|---|---|
| `adr_id` | string | yes |
| `title` | string | yes |
| `chosen_option` | string | yes |

---

### `doc_gap`
Documentation is missing or insufficient for a component.
```json
{ "data": { "component_id": "query-service", "description": "No usage examples in README" } }
```
| Field | Type | Required |
|---|---|---|
| `component_id` | string | yes |
| `description` | string | yes |

---

### `context_reset`
Context window was reset (e.g. compaction or /clear).
```json
{ "data": { "phase_name": "codegen", "reason": "compaction" } }
```
| Field | Type | Required |
|---|---|---|
| `phase_name` | string | yes |
| `reason` | string | yes |

---

### `approval_requested`
The agent has paused and is requesting human approval.
```json
{ "data": { "phase_name": "codegen", "subject": "drop column users.token", "action_id": "mig-003" } }
```
| Field | Type | Required |
|---|---|---|
| `phase_name` | string | yes |
| `subject` | string | yes |
| `action_id` | string | yes |

---

### `fast_path_engaged`
A fast path was used, bypassing standard validation steps.
```json
{ "data": { "change_type": "bug-fix", "reason": "isolated pure-function fix, no schema changes" } }
```
| Field | Type | Required |
|---|---|---|
| `change_type` | string | yes |
| `reason` | string | yes |

---

### `test_failure`
A test failed during a validation phase.
```json
{ "data": { "test_name": "should return 404 for unknown id", "phase_name": "validate", "attempt_number": 1, "error_summary": "expected 404, got 200" } }
```
| Field | Type | Required |
|---|---|---|
| `test_name` | string | yes |
| `phase_name` | string | yes |
| `attempt_number` | integer | yes (>= 1) |
| `error_summary` | string | no |

---

### `performance_regression`
A performance metric exceeded its threshold.
```json
{ "data": { "metric": "p95_latency_ms", "threshold": 50, "actual": 73.4, "phase_name": "validate" } }
```
| Field | Type | Required |
|---|---|---|
| `metric` | string | yes |
| `threshold` | number | yes |
| `actual` | number | yes |
| `phase_name` | string | yes |

---

### `dependency_blocked`
Progress is blocked waiting on an external dependency or human action.
```json
{ "data": { "phase_name": "codegen", "dependency": "human: approve migration", "reason": "destructive op requires consent" } }
```
| Field | Type | Required |
|---|---|---|
| `phase_name` | string | yes |
| `dependency` | string | yes |
| `reason` | string | yes |

---

### `schema_migration_applied`
A database schema migration was applied.
```json
{ "data": { "component_id": "auth-service", "migration_path": "migrations/0004-drop-legacy.sql", "destructive": true } }
```
| Field | Type | Required |
|---|---|---|
| `component_id` | string | yes |
| `migration_path` | string | yes |
| `destructive` | boolean | yes |

---

## 7. Query reference

All queries are sent to `POST /query` (REST) or the `query_telemetry` MCP tool.

---

### Bottleneck queries — `group_by`

Identify which phases, agents, or models take the most time.

| `group_by` value | Groups results by |
|---|---|
| `phase` | Pipeline phase |
| `agent` | Agent skill name |
| `model` | Model identifier |
| `mcp_mode` | MCP server configuration |

**Example:**
```json
{ "group_by": "phase" }
{ "group_by": "agent", "session_id": "my-session-001" }
{ "group_by": "model", "initiative_id": "0000009-ship-phase-enum" }
```

Optional filters: `session_id`, `initiative_id`.

---

### Failure queries — `mode`

| `mode` | Description | Required extra fields |
|---|---|---|
| `retry_summary` | Count of retries per action across sessions | none |
| `loop_candidates` | Sessions with consecutive identical failures >= threshold | `threshold` (integer) |
| `failure_sequence` | Full failure sequence for a single session | `session_id` |
| `failure_cluster` | Group failures by type across all sessions | none |

**Examples:**
```json
{ "mode": "retry_summary" }
{ "mode": "loop_candidates", "threshold": 3 }
{ "mode": "failure_sequence", "session_id": "my-session-001" }
{ "mode": "failure_cluster" }
```

---

### Token efficiency queries — `mode`

| `mode` | Description | Required extra fields |
|---|---|---|
| `context_pressure` | Sessions with high context fill percentage | none |
| `mcp_impact` | Token delta attributable to MCP mode | none |
| `request_volume` | Request volume over time | none |
| `trend` | Context pressure trend over time | none |
| `drill_down` | Full context timeline for a single session | `session_id` |

**Examples:**
```json
{ "mode": "context_pressure" }
{ "mode": "mcp_impact" }
{ "mode": "drill_down", "session_id": "my-session-001" }
```

---

### Event log query — `mode: "event_log"`

Raw event log. At least one scope parameter is required.

| Parameter | Type | Description |
|---|---|---|
| `mode` | string | `"event_log"` |
| `session_id` | string | Filter by session |
| `initiative_id` | string | Filter by initiative |
| `event_type` | string | Filter by event type |

**Examples:**
```json
{ "mode": "event_log", "session_id": "my-session-001" }
{ "mode": "event_log", "initiative_id": "0000009-ship-phase-enum" }
{ "mode": "event_log", "event_type": "test_failure" }
{ "mode": "event_log", "session_id": "my-session-001", "event_type": "phase_start" }
```
