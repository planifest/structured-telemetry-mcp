# Migration Proposal: Add `product_id` to Event Envelope

**Status:** Proposed — awaiting human approval
**Date:** 2026-08-01
**Requested by:** Martin Mayer
**Feature:** 0000015-telemetry-log-viewer-ui

---

## Motivation

The telemetry backend is a single shared store (`$HOME/.planifest/telemetry.db`) used by every project that registers this MCP server. Nothing on the event envelope currently identifies which repo/project emitted a given event. The new log-viewer UI (0000015) needs to distinguish events across projects, so a new field is required.

See ADR-017 (`plan/current/adr/ADR-017-product-id-additive-no-backfill.md`) for the full decision record, including why no backfill of existing rows is attempted (other projects besides this repo have historically used this shared backend — there is no reliable signal to reconstruct which repo produced a pre-existing row).

---

## Proposed Changes

### 1. JSON Schema (`schemas/telemetry-event.schema.json`)

Add optional `product_id` property to the envelope:

```json
"product_id": {
  "type": "string",
  "description": "Identifies the emitting repo/project — the git repo root path (git rev-parse --show-toplevel), falling back to the raw cwd if not inside a git repo. Optional; NULL/absent displays as \"unknown\"."
}
```

- Optional (not added to `required`)
- Plain string — no format/pattern constraint, since values are filesystem paths of varying shape across OSes

### 2. DuckDB table (`events`)

Add nullable column:

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS product_id VARCHAR
```

- Nullable — existing rows unaffected, permanently display as "unknown" (no backfill, ADR-017)

### 3. TypeScript types (`src/types/events.ts`)

Add to `TelemetryEvent`:

```typescript
readonly product_id?: string;
```

And to `StoredEvent` (inherits from `TelemetryEvent`, no separate change needed).

### 4. Events repository (`src/db/duckdb-event-repository.ts`)

Include `product_id` in the `INSERT`/`RETURNING` statement in `write()`, and in the `SELECT`/row-mapping in `findById()`/`rowToStoredEvent()` — pass `NULL` when absent, same pattern as `initiative_id`.

### 5. DB schema init (`src/db/schema.ts`)

- Add `product_id VARCHAR` column to `CREATE_EVENTS_TABLE` (fresh installs)
- Add `MIGRATE_ADD_PRODUCT_ID = ALTER TABLE events ADD COLUMN IF NOT EXISTS product_id VARCHAR` (existing installs)
- Wire the new migration constant into `src/db/index.ts`'s `openDatabase()`, alongside the existing `MIGRATE_ADD_MODEL_CONFIG` run

> Note: `ALTER TABLE ... IF NOT EXISTS` handles existing databases; the `CREATE TABLE` DDL handles fresh installs — same dual-path pattern as the prior `model_config` migration.

---

## Impact Assessment

| Area | Impact | Notes |
|---|---|---|
| Existing stored events | None | Column is nullable; old rows get NULL, display as "unknown" (permanent, by design — ADR-017) |
| Validation | Additive | New optional field; all existing valid events remain valid |
| Query modules | Additive | `event_log` gains a `product_id` filter (req-003); no existing query filters on it today |
| Performance | Negligible | One nullable VARCHAR column; no index required initially (filter selectivity not yet known) |
| Breaking changes | None | |

---

## Not In Scope

- Backfilling historical events — no source of truth available (ADR-017); other projects besides this repo have used the shared DB historically
- Populating `product_id` in `planifest-framework`'s own emission hooks — a separate product's responsibility, tracked at `plan/backlog/00002-framework-product-id-emission/entry.md` (ADR-019), not this migration
- Indexing `product_id` (deferred until query/filter patterns at realistic data volumes are established)

---

## Risks

- `product_id` values are absolute filesystem paths, which can reveal local usernames/directory structure. Accepted given the existing no-auth, 127.0.0.1-only posture (risk-register.md R-005); would need re-evaluation if that posture ever changes.
