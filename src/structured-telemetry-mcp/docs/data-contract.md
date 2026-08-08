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
| `event` | VARCHAR | no | — | NOT NULL; one of the 25 event types |
| `session_id` | VARCHAR | no | — | NOT NULL |
| `initiative_id` | VARCHAR | yes | NULL | — |
| `product_id` | VARCHAR | yes | NULL | Added 0000015. Identifies the emitting repo (git root path, fallback cwd). No backfill — NULL is permanent for pre-0000015 rows and for any emitter not yet updated to populate it (ADR-017). |
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

1. Every row has a non-null `event` value matching one of the 25 defined event types.
2. Every row has a non-null `session_id`.
3. `timestamp` is the agent-reported event time; `inserted_at` is the server ingestion time. They may differ.
4. `data` column is nullable to allow forward-compatibility with new event types before their schema is finalised. All current event types have a non-null `data` payload.
5. `schema_version` is stored on every row. Current version: `"1.0"`.
6. `product_id` is never backfilled (0000015, ADR-017). A NULL value is permanent for any row written before the migration or by an emitter not yet updated — not a defect.

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

### `context_reset` _(added 0.3.0)_
```json
{ "phase_name": "string", "reason": "string" }
```

### `approval_requested` _(added 0.3.0)_
```json
{ "phase_name": "string", "subject": "string", "action_id": "string" }
```

### `fast_path_engaged` _(added 0.3.0)_
```json
{ "change_type": "string", "reason": "string" }
```

### `test_failure` _(added 0.3.0)_
```json
{
  "test_name": "string",
  "phase_name": "string",
  "attempt_number": "integer",
  "error_summary": "string (optional)"
}
```

### `performance_regression` _(added 0.3.0)_
```json
{
  "metric": "string",
  "threshold": "number",
  "actual": "number",
  "phase_name": "string"
}
```

### `dependency_blocked` _(added 0.3.0)_
```json
{ "phase_name": "string", "dependency": "string", "reason": "string" }
```

### `schema_migration_applied` _(added 0.3.0)_
```json
{
  "component_id": "string",
  "migration_path": "string",
  "destructive": "boolean"
}
```

### `loop_iteration` _(added 0.10.0)_
```json
{
  "loop_id": "p0_completeness | design_critic | reversal_protocol | verify_by_execution | cross_model_review",
  "iteration": "integer",
  "cap": "integer",
  "decision": "continue | done | escalate",
  "toggle_level": "report-only | on"
}
```

### `phase_reversal_petitioned` _(added 0.10.0)_
```json
{ "report": "string", "filing_phase": "string", "binding_artifact": "string" }
```

### `phase_reversal_granted` _(added 0.10.0)_
```json
{
  "report": "string",
  "classification": "additive | altering",
  "cascade_size": "integer",
  "budget_remaining": "integer"
}
```

### `phase_reversal_denied` _(added 0.10.0)_
```json
{
  "report": "string",
  "classification": "additive | altering",
  "cascade_size": "integer",
  "budget_remaining": "integer"
}
```

---

## Backup Artifacts (0000018)

Not a DuckDB table — a second, file-based copy of the same owned data, still governed by this component's sole-ownership rule (no other component may write to these paths either).

**Location:** Outside `~/.planifest/` by default (exact path confirmed at P2 alongside the backup-ownership ADR — see `risk-register.md` R-001), so a mistaken wipe of `~/.planifest/` cannot take the backups with it.

**Format:** Timestamped `EXPORT DATABASE` directories. Written under a temporary name, restored into scratch and row-count-verified, then promoted (renamed) into the retained set only on success — never promoted, never counted — per the mandatory verify → promote → prune ordering (req-006).

**Retention:** 7 daily + 4 weekly (~1 month), pruned only after promotion and only over already-verified artifacts — a failed or interrupted run can never remove an older good backup.

**Sidecar metadata file:** a small JSON file (path TBC at P2, sibling to the backup directory) recording, for the most recent *verified* backup only:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string (ISO 8601) | When the verified export completed |
| `rowCount` | integer | Row count pinned at export time and confirmed by the scratch-restore verification |
| `artifactPath` | string | Path to the promoted backup directory |

`npm run doctor` (req-007) reads this file to report backup staleness — it never opens `telemetry.db` directly for this purpose, since a second connection while the daemon holds the write lock is confirmed (by reading `src/cli.ts`'s existing `runDoctor()`) to be capable of failing or blocking.

---

## Migration Policy

Schema changes require a migration proposal at `src/structured-telemetry-mcp/docs/migrations/proposed-{desc}.md`. No direct schema modification without human approval.

New event types increment `schema_version`. Existing rows retain their original `schema_version` value and are queried with null-coalescing for fields added in later versions.

**WAL-safety rule (0000018, req-003):** any `ALTER TABLE ADD COLUMN` migration must be followed immediately by a `CHECKPOINT`, before the daemon proceeds to open its HTTP listener. The 2026-08-03 incident's unreplayable-WAL failure was an internal DuckDB limitation in replaying a pending `ALTER TABLE ADD COLUMN` WAL entry (`ReplayAlter`, per `plan/backlog/00023-recover-stranded-wal-events/entry.md`) — not caused by an explicit function-valued `DEFAULT` in this component's own migration SQL (`MIGRATE_ADD_MODEL_CONFIG` and `MIGRATE_ADD_PRODUCT_ID` in `src/db/schema.ts` both have none). Checkpointing immediately after any `ALTER` ensures the entry is flushed into the base file and never needs to be replayed. Apply this rule to every future migration added to this file, not only the two that exist today.
