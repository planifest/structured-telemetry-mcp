# structured-telemetry-mcp

An MCP server for structured telemetry ingestion and querying across Planifest pipeline runs.

Agents emit typed events (phase timings, failures, context pressure) into a local DuckDB store. You query that store via two MCP tools — `emit_event` and `query_telemetry` — to surface bottlenecks, retry loops, and token efficiency patterns across sessions.

- **Transport:** stdio (works with Claude Code, Claude Desktop, Cursor, Antigravity)
- **Storage:** DuckDB (embedded, zero-config, local file)
- **Validation:** JSON Schema 2020-12 via AJV
- **Version:** 0.1.0

---

## Quick Start

### 1. Build

```powershell
.\scripts\build.ps1
```

Runs `tsc`, then bundles `server.bundle.mjs` (MCP server) and `cli.bundle.mjs` (setup CLI) via esbuild.

### 2. Deploy (global install)

```powershell
.\scripts\deploy.ps1
```

Runs `npm install -g .` and verifies `structured-telemetry-mcp` is on PATH.

### 3. Register with your agent tool

```powershell
.\scripts\setup.ps1
```

Interactive menu. Or pass `-Tool` directly:

```powershell
.\scripts\setup.ps1 -Tool claudecode
.\scripts\setup.ps1 -Tool cursor -ProjectDir C:\projects\myapp
.\scripts\setup.ps1 -Tool antigravity
.\scripts\setup.ps1 -Tool manual          # prints JSON block to add yourself
```

Default DB path: `$HOME\.planifest\telemetry.db`. Override with `-DbPath`:

```powershell
.\scripts\setup.ps1 -Tool claudecode -DbPath D:\data\telemetry.db
```

### 4. Verify

```powershell
npm run doctor
```

---

## MCP Tools

### `emit_event`

Ingests a validated telemetry event.

```json
{
  "event": {
    "schema_version": "1.0",
    "event": "phase_end",
    "session_id": "uuid-here",
    "phase": "codegen",
    "agent": "planifest-codegen-agent",
    "tool": "claude-code",
    "model": "claude-sonnet-4-6",
    "mcp_mode": "context",
    "timestamp": "2026-04-13T10:00:00Z",
    "data": {
      "phase_name": "codegen",
      "status": "pass",
      "duration_ms": 4200
    }
  }
}
```

Returns `{ ok: true, id: "..." }` on success, or `{ ok: false, errors: [...] }` on validation failure.

### `query_telemetry`

Runs structured queries. Returns three sections: Markdown table, JSON aggregation, raw event sample.

```
{ "query": { "group_by": "phase" } }
```

See [Query Reference](#query-reference) below.

---

## Event Types

All events share a common envelope. The `data` field is typed per event.

### Envelope Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `schema_version` | `"1.0"` | Yes | Schema version |
| `event` | string enum | Yes | Event type discriminator |
| `session_id` | string (UUID) | Yes | Agent session identifier |
| `initiative_id` | string | No | Feature/initiative from `plan/current/` |
| `phase` | string enum | Yes | Pipeline phase |
| `agent` | string | Yes | Emitting skill name |
| `tool` | string | Yes | Agent tool (e.g. `claude-code`) |
| `model` | string | Yes | Model identifier (e.g. `claude-sonnet-4-6`) |
| `mcp_mode` | string enum | Yes | Active MCP configuration |
| `timestamp` | ISO 8601 | Yes | Event timestamp |
| `model_config` | object | No | Tool-specific model attributes (see below) |
| `data` | object | No | Typed payload (structure depends on `event`) |

**`phase` values:** `orchestrator` `spec` `adr` `codegen` `validate` `security` `docs` `change`

**`mcp_mode` values:** `none` `workspace` `context` `workspace+context`

### `model_config`

Free-form object for tool-specific model configuration. Keys and values are tool-defined. Examples:

```json
{ "model_config": { "effort": "high" } }
```

```json
{ "model_config": { "thinking": true, "budget_tokens": 10000 } }
```

Use this to record whatever knobs your tool exposes (effort level, extended thinking, temperature, etc.) so you can correlate model configuration with performance outcomes.

### Event Payloads

#### `phase_start`

```json
{ "phase_name": "codegen" }
```

#### `phase_end`

```json
{
  "phase_name": "codegen",
  "status": "pass",
  "duration_ms": 4200,
  "content_type": "typescript"
}
```

`content_type` is optional. `status` is `"pass"` or `"fail"`.

#### `spec_gap`

Emitted when the agent encounters an underspecified requirement.

```json
{ "question": "Which auth strategy should be used?", "phase_name": "spec" }
```

#### `validation_failure`

Emitted on each failed validation attempt. Increment `attempt_number` per retry.

```json
{
  "failure_type": "typecheck",
  "phase_name": "validate",
  "attempt_number": 2,
  "action_id": "implement-auth-middleware"
}
```

#### `deviation`

Emitted when implementation deviates from the spec.

```json
{
  "component_id": "auth",
  "description": "Used session tokens instead of JWTs — spec required JWTs.",
  "severity": "high"
}
```

`severity`: `"low"` `"medium"` `"high"`

#### `migration_proposal`

Emitted when a schema migration is written (before human approval).

```json
{
  "component_id": "events",
  "proposal_path": "src/events/docs/migrations/proposed-add-model-config.md",
  "destructive": false
}
```

#### `context_pressure`

Emitted when context window fill % reaches a notable threshold.

```json
{
  "context_fill_pct": 82.5,
  "unused_sources": ["standards/reference/security.md"],
  "trigger": "pre-codegen-check"
}
```

#### `mcp_impact`

Emitted to record the token cost of the current MCP configuration.

```json
{
  "mcp_mode": "context",
  "avg_token_delta": 1200,
  "peak_fill_pct": 74.0
}
```

#### `self_correction`

Emitted when the agent self-corrects without external validation failure.

```json
{
  "phase_name": "codegen",
  "attempt_number": 1,
  "action_id": "implement-auth-middleware",
  "correction_type": "logic_error"
}
```

---

## Query Reference

All queries go through `query_telemetry`. Every response includes:

- **Markdown** — rendered table
- **JSON** — structured aggregation
- **Raw Sample** — up to 5 recent raw events

### Bottleneck Queries (`group_by`)

Aggregates `phase_end` events by a dimension. Ranked slowest first.

```json
{ "query": { "group_by": "phase" } }
```

| `group_by` value | Groups by |
| --- | --- |
| `phase` | Pipeline phase |
| `agent` | Emitting agent/skill |
| `tool` | Agent tool (claude-code, cursor, etc.) |
| `run_id` | Session (= `session_id`) |
| `content_type` | Output content type |

Optional filters:

```json
{
  "query": {
    "group_by": "agent",
    "session_id": "uuid-here",
    "limit": 10
  }
}
```

Returns: `avg_duration_ms`, `p95_duration_ms`, `success_rate_pct`, `total_events`.

### Failure Queries (`mode`)

#### `retry_summary`

Retry instance count and pass/fail rate per session + phase.

```json
{ "query": { "mode": "retry_summary" } }
```

#### `loop_candidates`

Sessions with repeated failures above a threshold (default: 5).

```json
{ "query": { "mode": "loop_candidates", "loop_threshold": 3 } }
```

#### `failure_sequence`

Ordered failure timeline for a specific session.

```json
{ "query": { "mode": "failure_sequence", "session_id": "uuid-here" } }
```

#### `failure_cluster`

Clusters failures by type and phase to reveal systemic patterns.

```json
{ "query": { "mode": "failure_cluster" } }
```

### Token Efficiency Queries (`mode`)

#### `context_pressure`

Average and peak context fill % per phase, ranked highest first.

```json
{ "query": { "mode": "context_pressure" } }
```

#### `mcp_impact`

Average token delta and peak fill % by MCP configuration mode.

```json
{ "query": { "mode": "mcp_impact" } }
```

#### `request_volume`

Event counts by type and phase.

```json
{ "query": { "mode": "request_volume" } }
```

#### `trend`

Context pressure trend over time (most recent N events, default 30).

```json
{ "query": { "mode": "trend", "limit": 60 } }
```

#### `drill_down`

All context pressure and MCP impact events for a specific session.

```json
{ "query": { "mode": "drill_down", "session_id": "uuid-here" } }
```

---

## Setup Reference

### Claude Code

`setup.ps1 -Tool claudecode` writes to:

- `~/.claude/settings.json` — Claude Code CLI
- `%APPDATA%\Claude\claude_desktop_config.json` — Claude Desktop (if installed)

### Cursor

`setup.ps1 -Tool cursor` writes to `.cursor/mcp.json` in the project directory.

### Antigravity (Gemini CLI)

`setup.ps1 -Tool antigravity` writes to `~/.gemini/antigravity/mcp_config.json`.

> Note: Antigravity does not support hooks. MCP server registration only.

### Manual

`setup.ps1 -Tool manual` prints the JSON block to add to any `mcpServers` config yourself.

---

## Development

### Prerequisites

- Node.js >= 18
- PowerShell 5.1+

### Commands

```powershell
npm run typecheck       # tsc --noEmit
npm test                # vitest run
npm run test:watch      # vitest (watch mode)
npm run build           # tsc + esbuild bundle
npm run dev             # tsx src/server.ts (no bundle)
npm run doctor          # verify server registration and DB
npm run benchmark       # load test (tests/benchmark.ts)
```

### Architecture

```
src/
  server.ts             # MCP server entry — emit_event + query_telemetry tools
  cli.ts                # CLI entry — setup / doctor commands
  db/
    index.ts            # openDatabase() — DuckDB connection + migrations
    schema.ts           # CREATE TABLE + ALTER TABLE migrations
    events-repository.ts # writeEvent(), readEvents()
  validation/
    ajv-instance.ts     # AJV 8 + JSON Schema 2020-12 (CJS interop via createRequire)
    validate-event.ts   # validateEvent() against telemetry-event.schema.json
  query/
    bottlenecks.ts      # group_by queries on phase_end events
    failures.ts         # retry_summary / loop_candidates / failure_sequence / failure_cluster
    token-efficiency.ts # context_pressure / mcp_impact / request_volume / trend / drill_down
    format-results.ts   # renderMarkdownTable(), buildQueryResponse()
  types/
    events.ts           # TelemetryEvent TypeScript type
schemas/
  telemetry-event.schema.json   # JSON Schema 2020-12 — source of truth for validation
scripts/
  build.ps1             # Build script
  deploy.ps1            # Global install
  setup.ps1             # Agent tool registration
```

**Key design decisions:**

- DuckDB `@duckdb/node-api` — embedded columnar store, no server process. All queries use named parameters via `prepare().bind({}).runAndReadAll()`. `COUNT(*)` returns BigInt; serialised to Number before JSON output.
- AJV 8 with JSON Schema 2020-12 (`ajv/dist/2020`). CJS interop isolated in `ajv-instance.ts` via `createRequire` to avoid ESM/CJS conflicts under NodeNext module resolution.
- Schema (`telemetry-event.schema.json`) is bundled inline via `import ... with { type: 'json' }` — runtime path resolution breaks inside esbuild bundles.
- stdio transport — no network port, no auth, works with all MCP-compatible tools.

---

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PLANIFEST_TELEMETRY_DB` | `$HOME/.planifest/telemetry.db` | Path to the DuckDB telemetry file |
