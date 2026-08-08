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
8. [Log Viewer UI](#8-log-viewer-ui)
9. [E2E testing](#9-e2e-testing)

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

Ingests a structured telemetry event. The argument is `envelope` (renamed from `event` in 0.10.0 to avoid colliding with the envelope's own `event` discriminator field) and must be a JSON object, not a string.

**Input schema:**
```json
{
  "envelope": { /* TelemetryEvent envelope — see Section 5 */ }
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
  "envelope": {
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

#### Troubleshooting: `"(root): must be object"` / `"expected object, received string"`

If `emit_event` rejects a call with an error like `(root): must be object` (pre-0.10.0) or `expected object, received string` (0.10.0+), the calling model passed the envelope as a **JSON string** instead of a bare object — a common tool-calling failure mode against an under-specified argument schema (root-caused as R-009). Fix: pass `envelope` as an actual JSON object, not `JSON.stringify()`'d text. As of 0.10.0, the tool's argument schema is a real object schema with full `properties`, which should guide correctly-behaving MCP clients to construct the right shape; if you still hit this, check whether your client is manually serializing tool arguments before sending them.

A related but distinct error — `(root): must have required property 'schema_version'` or similar — means the envelope was double-wrapped (e.g. `{ envelope: { event: {...} } }`). Un-nest it: the envelope's own fields (`schema_version`, `event`, `session_id`, ...) go directly under `envelope`, not under a second `event` key.

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
{ "ok": true, "version": "0.15.0", "buildId": "a1b2c3…" }
```

`buildId` is a SHA-256 fingerprint of `server-http.bundle.mjs` (`null` when running unbundled under `tsx` in dev) — added in 0000018 so `npm run deploy` can detect a stale running daemon even at an unchanged `version` string.

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

### Request boundary and error handling _(0000019)_

As of 0000019 (ADR-032), the daemon checks caller **provenance** on every request before routing — closing a browser-mediated CSRF-write and DNS-rebinding-read surface. There is still no credential (no token, password, or key); what is checked is where the request comes from. A request that fails a boundary check is refused before its body is read.

The full request-boundary contract is published as an OpenAPI spec at `src/structured-telemetry-mcp/docs/openapi-spec.yaml`. In summary, a request is refused with:

| Status | When | Notes |
|--------|------|-------|
| `403` | The `Host` header is absent or not on the allow-list (`127.0.0.1:<port>` / `localhost:<port>`, compared against the actually-bound port), **or** an `Origin` header is present and is not the daemon's own origin | A request with **no** `Origin` is accepted — the stdio proxy (ADR-009) and the Planifest emission hooks are non-browser clients and send none. Decided before anything executes, so a `403` carries no `correlationId`. No `Access-Control-Allow-Origin` header is ever emitted — cross-origin access is refused, not negotiated. The `Host` check also guards the `404` fallthrough, so a foreign-`Host` request to an unknown path is `403`, not `404` |
| `415` | `Content-Type` is missing or is not `application/json` (on `POST /emit` and `POST /query`) | Parameters are ignored, so `application/json; charset=utf-8` is accepted. This forces any cross-origin write into a preflight the daemon then declines — closing the CORS-simple no-preflight path (`text/plain`, `application/x-www-form-urlencoded`, `multipart/form-data`) |
| `413` | The request body exceeds `PLANIFEST_MAX_BODY_BYTES` (default 4 MB) | Enforced at two independent points — a `Content-Length` pre-check and a streaming byte counter — so a chunked or forged-`Content-Length` request cannot bypass the cap |
| `500` | An engine or internal failure | The body carries a generic message and a `correlationId` only; the full error and stack are written to the daemon's stderr against the same id. **Never** leaks SQL text, a stack trace, or a stored row value. Before 0000019 these were reported as `400` with the raw engine error interpolated into the body |
| `400` | Client input failed the shared validation gate (e.g. a non-integer or over-ceiling `limit`) — see §7 | Reserved for validated client input; an engine failure is a `500`, not a `400`. The body names the offending field and quotes no value |

A connection that sends headers and then stalls is closed by the request timeout (`PLANIFEST_REQUEST_TIMEOUT_MS`, default 30 s) — a transport-level outcome, not a status code.

#### Environment variables _(0000019)_

| Variable | Default | Effect |
|----------|---------|--------|
| `PLANIFEST_MAX_BODY_BYTES` | `4194304` (4 MB) | Maximum accepted request-body size; a larger body is refused with `413` |
| `PLANIFEST_REQUEST_TIMEOUT_MS` | `30000` (30 s) | A request that sends headers but stalls before completing its body is closed after this interval |
| `PLANIFEST_MCP_TEXT_BUDGET` | `100000` | Character budget for assembled `query_telemetry` MCP tool-result text; output is truncated at section boundaries so the agent never receives a half-serialised JSON block |

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
| `product_id` | string | **Optional.** Identifies the emitting repo/project — git repo root path, falling back to `cwd` (0000015). NULL/absent displays as "unknown"; never backfilled on existing rows |
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

### `loop_iteration` _(added 0.10.0)_
Emitted after every RECORD step of a governed pipeline loop.
```json
{ "data": { "loop_id": "design_critic", "iteration": 2, "cap": 3, "decision": "continue", "toggle_level": "on" } }
```
| Field | Type | Required |
|---|---|---|
| `loop_id` | enum: `p0_completeness` \| `design_critic` \| `reversal_protocol` \| `verify_by_execution` \| `cross_model_review` | yes |
| `iteration` | integer | yes |
| `cap` | integer | yes |
| `decision` | enum: `continue` \| `done` \| `escalate` | yes |
| `toggle_level` | enum: `report-only` \| `on` | yes |

---

### `phase_reversal_petitioned` _(added 0.10.0)_
A P3–P6 agent files a defect report petitioning for a scoped correction of an upstream artifact.
```json
{ "data": { "report": "001-schema-gap", "filing_phase": "P4", "binding_artifact": "plan/current/design.md" } }
```
| Field | Type | Required |
|---|---|---|
| `report` | string | yes |
| `filing_phase` | string | yes |
| `binding_artifact` | string | yes |

---

### `phase_reversal_granted` _(added 0.10.0)_
The reversal assessor grants a petitioned reversal.
```json
{ "data": { "report": "001-schema-gap", "classification": "additive", "cascade_size": 2, "budget_remaining": 1 } }
```
| Field | Type | Required |
|---|---|---|
| `report` | string | yes |
| `classification` | enum: `additive` \| `altering` | yes |
| `cascade_size` | integer | yes |
| `budget_remaining` | integer | yes |

---

### `phase_reversal_denied` _(added 0.10.0)_
The reversal assessor denies a petitioned reversal. Same shape as `phase_reversal_granted`.
```json
{ "data": { "report": "001-schema-gap", "classification": "altering", "cascade_size": 5, "budget_remaining": 0 } }
```
| Field | Type | Required |
|---|---|---|
| `report` | string | yes |
| `classification` | enum: `additive` \| `altering` | yes |
| `cascade_size` | integer | yes |
| `budget_remaining` | integer | yes |

---

## 7. Query reference

All queries are sent to `POST /query` (REST) or the `query_telemetry` MCP tool.

As of 0000019 (req-005), both paths share one validation gate (`src/query/validate-query.ts`) applied before dispatch. It enforces integer-and-range constraints on `limit`, `offset`, and `loop_threshold`, with a per-mode `limit` ceiling (`event_log` 1000, `distinct_values` 20, `failure_sequence`/`drill_down` 1000; `trend` treats `limit` as a day count, ceiling 365). Over-ceiling and non-integer values are **rejected** (`400` over HTTP), never silently coerced or clamped. `offset` was previously undeclared and unvalidated on both paths; it is now constrained too.

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

As of 0000019, `failure_sequence` is bounded by a row cap and its `## JSON` payload carries two additive fields: `total_count` (all matching rows, computed by a count query independent of how many were returned) and `truncated` (`true` when the cap was reached, so a caller can tell a capped result from a complete one). See [drill_down](#token-efficiency-queries--mode) for the same fields on the token-efficiency side.

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

As of 0000019, `drill_down` is bounded by a row cap and its `## JSON` payload carries the same additive `total_count` and `truncated` fields as `failure_sequence` (see above). Note that when `mode` is `trend`, `limit` is a **day count** (default 30, ceiling 365), not a row count — the row ceilings do not apply to it.

---

### Event log query — `mode: "event_log"`

Raw event log — returns individual events, not an aggregate. As of 0000015 (ADR-016), no scope parameter is required: every request is bounded solely by `limit`/`offset`. This is the query family backing the [Log Viewer UI](#8-log-viewer-ui).

| Parameter | Type | Default | Description |
|---|---|---|---|
| `mode` | string | — | `"event_log"` |
| `session_id` | string | — | Filter by session (exact match) |
| `initiative_id` | string | — | Filter by initiative (exact match) |
| `event_type` | string | — | Filter by event type (exact match) |
| `phase` | string | — | Filter by phase (exact match) _(0000015)_ |
| `agent` | string | — | Filter by agent (exact match) _(0000015)_ |
| `product_id` | string | — | Filter by the full repo-root path — not the truncated basename shown in the UI _(0000015)_ |
| `from` | ISO 8601 timestamp | — | Inclusive lower bound, full timestamp precision _(0000015)_ |
| `to` | ISO 8601 timestamp | — | Inclusive upper bound, full timestamp precision _(0000015)_ |
| `limit` | number | `100` | Capped at `1000` — a higher value is rejected with an error _(0000015)_ |
| `offset` | number | `0` | For pagination, paired with `total_count` in the response _(0000015)_ |
| `sort` | `"asc"` \| `"desc"` | `"asc"` | `"desc"` = newest first. Default stays `"asc"` for backward compatibility with pre-0000015 callers _(0000015)_ |
| `sortField` | string | `"timestamp"` | Column to sort by. Allow-listed: `timestamp`, `event`, `session_id`, `phase`, `agent`, `product_id` — an unlisted value is rejected with an error before any SQL runs. Omitting it is byte-identical to pre-0000017 behavior _(0000017, ADR-025)_ |

All filters combine with AND semantics. The `## JSON` section of the response includes `total_count` (all rows matching the filters, independent of the current page) alongside `event_count` (rows in this page) and `events` (full row objects — every envelope field, not a summary).

**Examples:**
```json
{ "mode": "event_log", "session_id": "my-session-001" }
{ "mode": "event_log", "initiative_id": "0000009-ship-phase-enum" }
{ "mode": "event_log", "event_type": "test_failure" }
{ "mode": "event_log", "session_id": "my-session-001", "event_type": "phase_start" }
{ "mode": "event_log", "limit": 50, "offset": 0, "sort": "desc" }
{ "mode": "event_log", "phase": "validate", "agent": "planifest-validate-agent", "from": "2026-08-01T00:00:00Z" }
{ "mode": "event_log", "sortField": "agent", "sort": "asc" }
```

---

### Distinct values query — `mode: "distinct_values"`

Added in 0000017 (ADR-026). Returns up to 20 distinct non-null values for an allow-listed field — used to populate the [Log Viewer UI](#8-log-viewer-ui)'s filter-suggestion comboboxes. Not paginated; there is no `offset`, and it is reached through the same `mode`-keyed `POST /query` dispatch as every other query family here, not a dedicated route.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `mode` | string | — | `"distinct_values"` |
| `field` | string | — | Required. Allow-listed: `session_id`, `initiative_id`, `event`, `phase`, `agent`, `product_id` — an unlisted value is rejected with an error before any SQL runs |
| `q` | string | — | Optional prefix match (case-insensitive), evaluated server-side and always passed as a bound SQL parameter, never string-concatenated |
| `limit` | number | `20` | Ceiling `20`. As of 0000019 a higher value is **rejected with an error** (`400` over HTTP), not silently clamped — matching `event_log`'s reject-not-clamp behaviour _(0000019, req-005)_ |

The `## JSON` section of the response is `{ "mode": "distinct_values", "field": "<field>", "values": [...] }` — a flat array of matching values, not row objects.

Note: the field allow-list uses real column names, so the event-type field is `event`, not `event_type` — the latter is only the `event_log` filter param name and the Log Viewer UI's form field id; the UI translates `event_type` → `event` before calling `distinct_values`.

**Examples:**
```json
{ "mode": "distinct_values", "field": "agent" }
{ "mode": "distinct_values", "field": "phase", "q": "val" }
```

---

## 8. Log Viewer UI

Added in 0000015; extended in 0000017 with auto-refresh, filter-value suggestions, and sortable column headers (see below). A read-only browser page for browsing telemetry without hand-writing a query — served at `GET /ui` on the same daemon that handles `/emit` and `/query`:

```
http://127.0.0.1:3741/ui
```

No installation, build step, or new dependency — plain HTML/CSS/vanilla JS, embedded in the daemon (ADR-018) and served the moment the daemon starts.

### What it does

- Paginated, newest-first table of events with a filter for every `event_log` parameter from Section 7 (`session_id`, `initiative_id`, `event_type`, `phase`, `agent`, `product_id`, `from`, `to`), plus page size and sort controls
- Filter inputs suggest values as you type: each of the 6 filterable fields is backed by a `<datalist>`, populated from the `distinct_values` query mode (Section 7) on focus (empty prefix, up to 20 values) and again on debounced input as you narrow it down _(0000017)_
- Column headers (`Timestamp`, `Event`, `Session ID`, `Phase`, `Agent`, `Product`) are clickable to sort: first click on a new column sorts by it using that column's default direction, a second click toggles direction; the clicked header, the `Sort` dropdown, and the `sortField`/`sort` URL params all stay three-way synced _(0000017)_
- Optional auto-refresh: a checkbox that polls `/query` every 5 seconds while checked, persisted as `autoRefresh=1` in the URL; a poll tick only updates row data and pager labels — it never blanks the table, disturbs scroll position, or clobbers in-progress (unsubmitted) filter typing, and a failed poll shows a quiet "Auto-refresh failed — retrying…" message rather than the backend-unreachable banner _(0000017)_
- Click any row to expand its full envelope + `data` payload as pretty-printed JSON — reuses the already-fetched row, no extra request
- Filters, page number, page size, sort, and sort field all live in the URL query string — reload, bookmark, or share the exact same view
- `product_id` displays as a truncated basename with the full path as a hover tooltip; the filter itself matches the full path (same exact-match semantics as the underlying query)
- A backend-unreachable banner and distinct "no events yet" / "no matching events" states replace blank or broken pages when there's nothing to show

### What it does not do

Read-only — no editing or deleting events. No authentication (inherits the daemon's existing 127.0.0.1-only, no-auth posture unchanged). No aggregation/dashboard charts (bottleneck/failure/token-efficiency queries remain MCP/REST-only) — those may become a future wave on top of this UI's shell, but are out of scope today.

---

## 9. E2E testing

Added in 0000016. Two `@playwright/test` suites give black-box coverage of the HTTP and browser surface described in this guide — real requests and a real browser against a real running daemon, not handler-level mocking.

```bash
npm run test:e2e            # both suites
npm run test:e2e:backend    # /emit, /query, /health only
npm run test:e2e:ui         # GET /ui only (Chromium)
```

Each suite starts its own `server-http.ts` process on an OS-assigned ephemeral port against a fresh temp-file DuckDB, and tears both down afterward — no shared state between runs, no need for a daemon to already be running. First local run (or first CI run) needs the Chromium browser binary once:

```bash
npx playwright install chromium --with-deps
```

CI runs both suites as a blocking check on every PR (`.github/workflows/ci.yml`, `e2e` job) — Chromium-only (ADR-023), combined runtime budget p95 < 5 min (NFR-001, measured ~3s in practice). See ADR-020 through ADR-023 for the full rationale, including why the Playwright MCP server (used only for interactive test authoring, never in CI) is a distinct tool from `@playwright/test` (the CI-executed framework) — see ADR-021.
