# Migration Proposal: Add `model_config` to Event Envelope

**Status:** Proposed — awaiting human approval  
**Date:** 2026-04-13  
**Requested by:** Martin Mayer  
**Feature:** 0000008-structured-telemetry-mcp-server

---

## Motivation

Agent tools expose model configuration beyond the model name — Claude Code's "Effort" setting (Low / Medium / High) being the first known example. These attributes affect token usage, latency, and output quality and are therefore directly relevant to the token efficiency and bottleneck queries.

The full set of attributes varies by tool and is not yet known, so a fixed enum is premature. A free-form `model_config` object captures known attributes (e.g. `effort`) today and accommodates future attributes (e.g. `thinking`, `temperature`) without requiring further schema migrations.

---

## Proposed Changes

### 1. JSON Schema (`schemas/telemetry-event.schema.json`)

Add optional `model_config` property to the envelope:

```json
"model_config": {
  "type": "object",
  "description": "Tool-specific model configuration attributes (e.g. effort, thinking). Keys and values are tool-defined.",
  "additionalProperties": true
}
```

- Optional (not added to `required`)
- No `additionalProperties: false` constraint — values are tool-defined and evolve independently

### 2. DuckDB table (`events`)

Add nullable JSON column:

```sql
ALTER TABLE events ADD COLUMN model_config JSON;
```

- Nullable — existing rows unaffected
- Stored as JSON, queryable via `model_config->>'effort'` etc.

### 3. TypeScript types (`src/types/events.ts`)

Add to `TelemetryEventBase`:

```typescript
readonly model_config?: Record<string, unknown>;
```

### 4. Events repository (`src/db/events-repository.ts`)

Include `model_config` in `INSERT` and `RETURNING` — pass `NULL` when absent.

### 5. DB schema init (`src/db/schema.ts`)

Add `model_config JSON` column to `CREATE TABLE IF NOT EXISTS events`.

> Note: `ALTER TABLE` handles existing databases; the `CREATE TABLE` DDL handles fresh installs.

---

## Impact Assessment

| Area | Impact | Notes |
|---|---|---|
| Existing stored events | None | Column is nullable; old rows get NULL |
| Validation | Additive | New optional field; all existing valid events remain valid |
| Query modules | Low | No existing queries filter on `model_config`; can be added in follow-up |
| Performance | Negligible | One nullable JSON column; no index required initially |
| Breaking changes | None | |

---

## Not In Scope

- Indexing `model_config` sub-keys (deferred until query patterns are established)
- Validating known keys like `effort` against an enum (premature — tool options not fully known)
- Backfilling historical events (no source of truth available)

---

## Risks

- `additionalProperties: true` means any object is valid for `model_config`. Accepted — constraint can be tightened once the full attribute set is known across tools.
