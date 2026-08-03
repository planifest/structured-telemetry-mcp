---
title: "ADR 024: Shared Column Allow-List for Dynamic SQL Identifiers"
summary: "One shared, exported column allow-list module is the single defense against SQL-injection-via-identifier for both the new sortField and distinct_values field params."
status: "accepted"
version: "0.1.0"
---
# ADR-024 - Shared Column Allow-List for Dynamic SQL Identifiers

**Skill:** [adr-agent](../skills/planifest-adr-agent/SKILL.md)
**Feature:** 0000017-log-viewer-enhancements
**Component:** structured-telemetry-mcp
**Date:** 2026-08-02

## Context

Two requirements in this feature introduce client-controlled values that must be interpolated into SQL as **column identifiers**, not bound values: req-003's new `sortField` (for `ORDER BY {field}`) and req-002's new `field` param on the `distinct_values` query mode (for `SELECT DISTINCT {field}`). DuckDB, like most SQL engines, has no parameterized-identifier binding — the existing `$session_id`-style named params in `buildWhereClause` (`src/query/event-log.ts:104-142`) only bind **values**, never column names. Any un-validated client string reaching either `ORDER BY` or `SELECT DISTINCT` position is a SQL-injection-via-identifier vector.

Both spec-agent subagents that drafted req-002 and req-003 independently proposed an allow-list defense (correctly), but proposed two different concrete shapes: req-002 proposed `FILTER_FIELD_COLUMNS` in a new `src/query/filterable-fields.ts` (mapping UI field names like `event_type` → column `event`), and req-003 proposed `SORTABLE_FIELDS` exported directly from `src/query/event-log.ts` (a plain array of real column names). Both flagged this divergence explicitly as a coordination point for whoever implements both (`plan/current/risk-register.md` R-001, R-002). This ADR resolves it before codegen begins.

## Decision

**One shared module, `src/query/column-allow-list.ts`, is the single source of truth for both use cases:**

```ts
export const ALLOWED_EVENT_COLUMNS = {
  timestamp: 'timestamp',
  event: 'event',
  session_id: 'session_id',
  initiative_id: 'initiative_id',
  phase: 'phase',
  agent: 'agent',
  product_id: 'product_id',
} as const;

export type AllowedEventColumnKey = keyof typeof ALLOWED_EVENT_COLUMNS;

export const SORTABLE_FIELDS: readonly AllowedEventColumnKey[] =
  ['timestamp', 'event', 'session_id', 'phase', 'agent', 'product_id'];

export const SUGGESTIBLE_FIELDS: readonly AllowedEventColumnKey[] =
  ['session_id', 'initiative_id', 'event', 'phase', 'agent', 'product_id'];
```

- `ALLOWED_EVENT_COLUMNS` is the base map (key → real DuckDB column name; identity for every entry except `event`, which the UI/query layer calls `event_type` in filter contexts but is stored as column `event` — req-002's original mapping insight is preserved).
- `SORTABLE_FIELDS` and `SUGGESTIBLE_FIELDS` are two named subsets of the same base map's keys, not two independently hand-written literal lists — they differ by one column each (`timestamp` is sortable but not filterable/suggestible; `initiative_id` is filterable but not currently a table column shown, so not sortable) but both resolve through the one map, so a future column rename only needs to change in one place.
- Both `queryEventLog`'s new `sortField` handling (req-003) and the new `queryDistinctValues` (req-002) validate their client-supplied field name against their respective exported subset array, then resolve the real column name via `ALLOWED_EVENT_COLUMNS[field]` — **never** interpolating the client-supplied string itself into SQL.
- An unrecognized field name is rejected with a thrown `Error` naming the valid values, mirroring the existing `Invalid group_by` (`src/server-factory.ts:110-115`) and `limit > MAX_LIMIT` (`src/query/event-log.ts:37-39`) error patterns — never silently ignored, never a 500.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Two independent allow-lists (req-002's `FILTER_FIELD_COLUMNS`, req-003's `SORTABLE_FIELDS`), each self-contained | Zero coordination needed between the two requirement implementations; can be built fully in parallel | Two hand-maintained sources of truth for "which events columns are safe to interpolate" — a future column rename or new column risks updating one and not the other, silently reintroducing drift | Rejected — this is exactly the class of bug an allow-list is meant to prevent; having two undermines the pattern's own guarantee |
| A single flat array shared identically by both (no field-name-to-column mapping, no subsetting) | Simplest possible shape | Loses req-002's correct insight that the UI's `event_type` filter name and the `event` column name differ; forcing sort and suggestion fields to be identical sets is also incorrect (`timestamp` is not a meaningful filter-suggestion field; `initiative_id` is filterable but adding it to sortable columns wasn't requested) | Rejected — a single undifferentiated list is either wrong for one use case or requires unused entries in the other |
| Runtime allow-list built from `information_schema` (introspect the table's real columns instead of hardcoding) | Never goes stale if the schema changes | Would allow sorting/suggesting on columns never intended to be exposed this way (e.g. `data`, `model_config` — large JSON blobs, or `id`) without a deliberate decision each time; hardcoding is the actual security boundary, not a maintenance shortcut | Rejected — the allow-list's purpose is to be a deliberate, reviewed exposure surface, not a mirror of the schema |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | New file `src/query/column-allow-list.ts`; `src/query/event-log.ts` (sortField validation, req-003) and a new `src/query/distinct-values.ts` (field validation, req-002) both import from it instead of defining their own list |

## Consequences

**Positive:**
- Exactly one place to review, test, and update when the set of sortable/suggestible columns changes
- Both new SQL-injection-via-identifier defenses (sort, suggestions) share one regression test target instead of two
- Resolves the coordination gap both requirement docs explicitly flagged, before codegen has to guess

**Negative:**
- Introduces a new shared module dependency between req-002 and req-003's implementations — they can no longer be coded in full isolation from each other (already true in practice per risk-register.md R-002, which flags both requirements touching the same `index-html.ts` state functions)

**Risks:**
- If a future feature needs a genuinely different subset (e.g. a column sortable but never meant to be filter-suggestible), the shared base map must still express it correctly — mitigated by the map already supporting per-use-case subset arrays rather than one undifferentiated list

## Related ADRs

- ADR-016 (0000015) - established `limit`/`offset` bounding and the existing `Invalid group_by`-style clear-error pattern this ADR's validation follows

## Supersedes

- None

## Superseded By

- None
