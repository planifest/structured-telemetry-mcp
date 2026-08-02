---
title: "ADR 026: distinct_values Is a New Mode on the Existing POST /query Dispatch, Not a New REST Route"
summary: "Filter-suggestion lookups are served via a new mode: 'distinct_values' branch in dispatchQuery, reusing POST /query rather than adding a dedicated GET /distinct-values route."
status: "accepted"
version: "0.1.0"
---
# ADR-026 - distinct_values as a Query Mode, Not a New Route

**Skill:** [adr-agent](../skills/planifest-adr-agent/SKILL.md)
**Feature:** 0000017-log-viewer-enhancements
**Component:** structured-telemetry-mcp
**Date:** 2026-08-02

## Context

req-002 (filter combobox with suggestions) needs a backend lookup returning distinct values for an allow-listed field, to populate suggestion `<datalist>`s. Two API-surface shapes were viable: extend the existing `mode`-keyed `POST /query` dispatch (`dispatchQuery`, `src/server-factory.ts:77-120`, which already routes `event_log`, bottleneck, failure, and token-efficiency query families by `mode`/`group_by`) with a new `mode: 'distinct_values'` branch, or add a dedicated new REST route (e.g. `GET /distinct-values?field=X`) on `server-http.ts` alongside the existing `/health`, `/ui`, `/emit`, `/query` routes.

This is an API-surface decision affecting how every future query family gets added to this server, so it warrants an ADR (constrains future work, per the ADR criteria table).

## Decision

Add `distinct_values` as a fifth query family reached through the existing `POST /query` → `dispatchQuery` mechanism, exactly like `event_log`, bottlenecks, failures, and token-efficiency already are. `IQueryService` (`src/query/query-service.ts:16-21`) gains a `distinctValues(query)` method, implemented by `DuckDbQueryService` with the same one-line delegation pattern as `eventLog()`. No new HTTP route, no change to `server-http.ts`'s routing table.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| New dedicated route `GET /distinct-values?field=X` | Arguably more RESTful/cacheable as a `GET`; a smaller, more obviously side-effect-free request shape | Requires new routing logic in `server-http.ts` (currently four hardcoded route checks); breaks the established one-endpoint-many-modes pattern every other query family uses; the frontend would need a second fetch helper alongside the existing `loadEvents()`/`fetch('/query', ...)` pattern | Rejected — inconsistent with the existing architecture for zero real benefit; this server has no HTTP caching layer to exploit `GET`'s cacheability, and `POST /query` already handles arbitrarily-shaped read-only queries (bottlenecks/failures/token-efficiency are all reads too, despite using `POST`) |
| Fold suggestions into the existing `event_log` mode itself (e.g. `event_log` with a `distinctValuesFor` param) | No new mode, minimal `dispatchQuery` change | Conflates two structurally different queries (paginated raw rows vs. a distinct-value list) into one response shape, forcing awkward branching inside `queryEventLog` and an ambiguous response contract (is `total_count` still meaningful? are `events` present?) | Rejected — a new mode keeps `event_log`'s contract clean and matches how every other query family already gets its own mode |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | `src/server-factory.ts` (`dispatchQuery` gains a new branch, checked alongside the existing `event_log` branch); new `src/query/distinct-values.ts`; `src/query/query-service.ts` (`IQueryService` interface + `DuckDbQueryService` gain `distinctValues`); no `server-http.ts` route changes |

## Consequences

**Positive:**
- Zero new HTTP routing surface to secure/test/document — the existing `POST /query` handler, error handling, and `dispatchQuery` try/catch already cover it
- Frontend reuses the existing `fetch('/query', ...)` pattern (`loadEvents()`) rather than introducing a second request helper
- Consistent, predictable place for any future query family to land

**Negative:**
- `dispatchQuery`'s branching grows by one more `if` — acceptable at 5 branches, would warrant revisiting (e.g. a lookup table) if many more query families are added later

**Risks:**
- None beyond ADR-024's identifier-allow-list risk, already covered there

## Related ADRs

- ADR-010 (0000008c) - established `event_log` as a `mode`-keyed query family within the same `dispatchQuery` mechanism this ADR extends
- ADR-024 (0000017) - the shared allow-list `distinctValues`'s `field` param validates against

## Supersedes

- None

## Superseded By

- None
