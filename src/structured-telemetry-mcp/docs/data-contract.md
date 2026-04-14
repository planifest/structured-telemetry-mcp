# Data Contract - structured-telemetry-mcp

**Owner:** structured-telemetry-mcp
**Schema version:** 1.0
**Store:** DuckDB — `~/.planifest/telemetry.db` (configurable via `PLANIFEST_TELEMETRY_DB`)
**Migration path:** `src/structured-telemetry-mcp/docs/migrations/`

---

## Ownership Rule

This component is the sole writer to the `telemetry.db` DuckDB file. No other component may write to this store. Other components may read via the `query_telemetry` MCP tool only — never by opening the DuckDB file directly.

---

## Tables

### `events`

The single table that stores all telemetry events. One row per event.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | VARCHAR | no | `gen_random_uuid()` | PK |
| `schema_version` | VARCHAR | no | — | NOT NULL |
| `event` | VARCHAR | no | — | NOT NULL; one of the 14 event types |
| `session_id` | VARCHAR | no | — | NOT NULL |
| `initiative_id` | VARCHAR | yes | NULL | — |
| `phase` | VARCHAR | no | — | NOT NULL |
| `agent` | VARCHAR | no | — | NOT NULL |
| `tool` | VARCHAR | no | — | NOT NULL |
| `model` | VARCHAR | no | — | NOT NULL |
| `mcp_mode` | VARCHAR | no | — | NOT NULL; one of: none, workspace, context, workspace+context |
| `timestamp` | TIMESTAMPTZ | no | — | NOT NULL |
| `model_config` | JSON | yes | NULL | Tool-specific model configuration (e.g. effort, thinking). Keys are tool-defined. |
| `data` | JSON | yes | NULL | Typed payload; structure varies by event type |
| `inserted_at` | TIMESTAMPTZ | no | `now()` | Server-assigned ingestion time |

**Indexes:**
- `idx_events_session_id` — on `session_id` (used by failure sequence queries)
- `idx_events_event_timestamp` — on `(event, timestamp)` (used by all aggregation queries)
- `idx_events_phase_session` — on `(phase, session_id)` (used by retry/loop queries)

**Partitioning:** None in v1. DuckDB handles temporal scans efficiently without partitioning up to ~50M rows.

---

## Schema Invariants

1. Every row has a non-null `event` value matching one of the 14 defined event types.
2. Every row has a non-null `session_id`.
3. `timestamp` is the agent-reported event time; `inserted_at` is the server ingestion time. They may differ.
4. `data` column is nullable to allow forward-compatibility with new event types before their schema is finalised. All current event types have a non-null `data` payload.
5. `schema_version` is stored on every row. Current version: `"1.0"`.

---

## Data Sub-Schemas (by event type)

### `phase_start`
```json
{ "phase_name": "string" }
```

### `phase_end`
```json
{
  "phase_name": "string",
  "status": "pass | fail",
  "duration_ms": "number",
  "content_type": "string (optional) — e.g. docs, code, config, schema, test"
}
```

### `spec_gap`
```json
{ "question": "string", "phase_name": "string" }
```

### `validation_failure`
```json
{
  "failure_type": "string",
  "phase_name": "string",
  "attempt_number": "integer",
  "action_id": "string"
}
```

### `deviation`
```json
{
  "component_id": "string",
  "description": "string",
  "severity": "low | medium | high"
}
```

### `migration_proposal`
```json
{
  "component_id": "string",
  "proposal_path": "string",
  "destructive": "boolean"
}
```

### `context_pressure`
```json
{
  "context_fill_pct": "number (0–100)",
  "unused_sources": "string[]",
  "trigger": "string"
}
```

### `mcp_impact`
```json
{
  "mcp_mode": "none | workspace | context | workspace+context",
  "avg_token_delta": "number",
  "peak_fill_pct": "number (0–100)"
}
```

### `self_correction`
```json
{
  "phase_name": "string",
  "attempt_number": "integer",
  "action_id": "string",
  "correction_type": "string"
}
```

### `phase_skip` _(added 0.2.0)_
```json
{ "phase_name": "string", "reason": "string" }
```

### `security_finding` _(added 0.2.0)_
```json
{
  "component_id": "string",
  "title": "string",
  "severity": "low | medium | high | critical",
  "cwe": "string (optional)"
}
```

### `retry_limit_exceeded` _(added 0.2.0)_
```json
{
  "phase_name": "string",
  "action_id": "string",
  "attempt_count": "integer"
}
```

### `adr_decision` _(added 0.2.0)_
```json
{
  "adr_id": "string",
  "title": "string",
  "chosen_option": "string"
}
```

### `doc_gap` _(added 0.2.0)_
```json
{ "component_id": "string", "description": "string" }
```

---

## Migration Policy

Schema changes require a migration proposal at `src/structured-telemetry-mcp/docs/migrations/proposed-{desc}.md`. No direct schema modification without human approval.

New event types increment `schema_version`. Existing rows retain their original `schema_version` value and are queried with null-coalescing for fields added in later versions.
