---
title: "Requirement: req-004 - FEA-001 event_log Query Mode"
summary: "Add mode: event_log to return the full raw event stream for a session or initiative."
status: "active"
version: "0.1.0"
---
# Requirement: req-004 - FEA-001 event_log Query Mode

**Skill:** spec-agent
**Feature:** 0000008c-mcp-fixes-and-enhancements
**Source:** Feature Brief FEA-001; docs/0008c §3.1
**Priority:** should-have

---

## Context

No existing query mode returns the complete event stream. `failure_sequence` is the closest — it returns a filtered timeline for a single session. There is no way for an agent or human to audit all events for a session or initiative without directly querying DuckDB.

`event_log` fills this gap: a raw, ordered, full-payload event stream scoped to a session or initiative.

---

## Functional Requirements

- A new query mode `"event_log"` MUST be added to the query dispatch.
- `event_log` MUST accept `session_id` (string) and/or `initiative_id` (string) as scope parameters.
- At least one of `session_id` or `initiative_id` MUST be provided. If neither is present, the query MUST throw `Error('event_log requires session_id or initiative_id')`.
- If both `session_id` and `initiative_id` are provided, the query applies AND logic (returns only rows matching both).
- Results MUST be ordered by `timestamp` ascending.
- Results MUST include the full `data` JSON payload for each event — no filtering of payload fields.
- `limit` parameter (integer) is supported. If omitted, defaults to 100 rows.
- Results MUST be returned in the standard `QueryResponse` format (table with headers and rows).
- `event_log` MUST be dispatched as a new distinct query branch in `dispatchQuery` in `src/server-factory.ts`, before the existing bottleneck/failure/token-efficiency checks.

### Result columns
| Column | Source | Description |
|--------|--------|-------------|
| `timestamp` | `events.timestamp` | Agent-reported event time |
| `event` | `events.event` | Event type discriminator |
| `session_id` | `events.session_id` | Session scope |
| `initiative_id` | `events.initiative_id` | Initiative scope (nullable) |
| `phase` | `events.phase` | Pipeline phase |
| `agent` | `events.agent` | Emitting skill |
| `data` | `events.data` | Full JSON payload |

### Implementation approach
New file: `src/query/event-log.ts`. New interface: `EventLogQuery`. New method on `IQueryService`: `eventLog(query: EventLogQuery): Promise<QueryResponse>`. Implementation on `HttpQueryService` reads from `events` table with WHERE and ORDER BY.

---

## Acceptance Criteria

- [ ] `query_telemetry` with `{ mode: "event_log", session_id: "<uuid>" }` returns all events for that session ordered by `timestamp` ascending
- [ ] `query_telemetry` with `{ mode: "event_log", initiative_id: "<id>" }` returns all events for that initiative ordered by `timestamp` ascending
- [ ] `query_telemetry` with `{ mode: "event_log", session_id: "<uuid>", initiative_id: "<id>" }` returns only events matching both (AND)
- [ ] Results ordered by `timestamp` ascending even when events were inserted out of order
- [ ] Full `data` payload is present on each row (not null, not stripped)
- [ ] `limit` parameter correctly restricts the number of rows returned
- [ ] No matching events returns empty result set (not an error)
- [ ] `query_telemetry` with `{ mode: "event_log" }` (no scope) returns an error, not an empty result set

---

## Open Question

**Q-001:** AND vs OR when both `session_id` and `initiative_id` are provided.
**Resolution:** AND (intersection) — more restrictive, prevents unexpectedly large result sets.

---

## Dependencies

- `src/query/event-log.ts` — new file
- `src/query/query-service.ts` — add `EventLogQuery` interface and `eventLog()` to `IQueryService`
- `src/server-factory.ts` — add `event_log` dispatch branch before existing checks
- `tests/integration/query-telemetry.test.ts` — add 8 new integration test cases
