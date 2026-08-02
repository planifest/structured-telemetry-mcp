---
title: "Feature Brief - log-viewer-enhancements"
summary: "The business case, scope, and product requirements for the feature."
status: "draft"
version: "0.1.0"
---
# Feature Brief - log-viewer-enhancements

**Feature ID:** 0000017-log-viewer-enhancements

> Follow-on wave to 0000015-telemetry-log-viewer-ui. Wave 1 of a two-wave split (Wave 2 — aggregation/dashboard views — deferred to backlog #00004).

## Business Goal

The 0000015 log viewer ships static browsing only: a developer must manually re-run a query to see new events, retype filter values from memory, and re-sort by re-picking a dropdown option. This feature closes those three interaction gaps so the viewer behaves like a live tailing/inspection tool instead of a one-shot query form, reducing the manual re-query/re-filter friction reported after 0000015 shipped.

## Features

| Feature | User Stories | Priority | Wave |
|---------|-------------|----------|------|
| Live auto-refresh / tail mode | As a developer, I toggle live auto-refresh on the event log, so that new events appear without me manually re-running the query. | should-have | 1 |
| Filter combobox with suggestions | As a developer, I get suggested values as I type into a filter field, so that I can filter accurately without memorizing exact session/event-type/agent strings. | should-have | 1 |
| Sortable table headers | As a developer, I click a column header to sort by that field, so that I don't have to use the separate sort-field dropdown for a task the table itself should support. | should-have | 1 |

## Waves

| Wave | Features Included | Ships When |
|------|-------------------|------------|
| 1 (this run) | Live auto-refresh/tail mode, filter combobox, sortable headers | This pipeline run completes |
| 2 (future, backlog #00004) | Aggregation/dashboard views (bottleneck/failure/token-efficiency charts) | A future pipeline run revisits ADR-018 (static vanilla-JS UI) |

## Target Architecture

The agent implements within these constraints - it does not choose the architecture.

### Components

| Component | Type | New or Existing | Responsibility |
|-----------|------|-----------------|---------------|
| structured-telemetry-mcp | component-pack | existing | Extends the existing `/ui` static page and `server-http.ts` REST layer with auto-refresh polling, filter-value suggestion endpoints, and header-driven sort |

### Data Ownership

| Data Store | Owner Component | Shared With |
|------------|----------------|-------------|
| `events` table (DuckDB) | structured-telemetry-mcp | read by MCP `query_telemetry`, REST `/query`, and the UI (same process) — unchanged from 0000015 |

### Integration Points

| From | To | Method | Contract |
|------|-----|--------|----------|
| UI (`/ui`) | server-http.ts | REST (existing `/query`, extended) | Poll on an interval for auto-refresh; new lightweight endpoint(s) for distinct filter-field values (suggestions) |

## Stack

Inherited as-is from 0000015 — no new dependencies.

| Concern | Decision |
|---------|----------|
| Language | TypeScript (backend, existing) + vanilla JS/HTML/CSS (frontend, existing, no build step) |
| Runtime | Node.js |
| Framework | none (raw `node:http`) |
| Frontend | vanilla JS/DOM, no framework (ADR-018) |
| Database | DuckDB (existing) |
| ORM | none |
| Testing | Vitest |
| IaC | none |
| Cloud | none |
| Compute | local persistent process |
| CI | existing GitHub Actions |
| Build target | local |

## Scope Boundaries

### In Scope
- Live auto-refresh / tail mode: user-toggleable, polls the existing query endpoint on an interval, preserves active filters/sort/scroll position
- Filter combobox: free-text input per filterable field (session_id, initiative_id, event_type, phase, agent, product_id) that suggests existing distinct values as the user types
- Sortable table column headers: clicking a header sorts by that column and toggles direction; stays in two-way sync with the existing sort-field dropdown/direction control (either control updates the other)

### Out of Scope
- Aggregation/dashboard views (bottleneck/failure-rate/token-efficiency charts) — deferred, backlog #00004
- Any change to ADR-018 (static vanilla-JS, no framework) — this wave stays inside that constraint
- Backfilling `product_id` on historical rows or framework-side `product_id` emission (backlog #00002) — suggestions for `product_id` will surface "unknown" until that lands

### Deferred
- Aggregation/dashboard views — blocked until a future pipeline run revisits ADR-018 and this feature's Wave 1 ships (backlog #00004)

## Non-Functional Requirements

| NFR | Target | Measurement |
|-----|--------|-------------|
| Latency | p95 < 300ms per poll/query (inherited from 0000015) | Same measurement approach as 0000015 |
| Availability | best-effort, no SLO (local single-developer tool) | n/a |
| Throughput | not applicable (single local developer's data volume) | n/a |
| Security | unchanged — no auth, server bound to 127.0.0.1 only | Unchanged existing posture |

## Constraints and Assumptions

### Constraints
- No build step/bundler/new frontend dependency (ADR-018 still applies)
- No architecture change — extends the existing `server-http.ts` process and `/ui` static page only
- Auto-refresh must not silently discard a user's in-progress filter edit or scroll position

### Assumptions
- Polling (not WebSocket/SSE push) is sufficient for "live" auto-refresh at local single-developer data volumes — impact if wrong: revisit push-based approach if poll latency/load becomes noticeable
- Distinct filter-value suggestions can be served from the existing `events` table with a lightweight query (e.g. `SELECT DISTINCT`) without a new index — impact if wrong: may need an index or a cached/precomputed values list if suggestion queries are slow at scale

## Scenario Paths

**Happy path:** (to be captured via Scope Lock Challenge)

> {{happy-path}}

**First-run path:** (to be captured via Scope Lock Challenge)

> {{first-run-path}}

**Error / sad path:** (to be captured via Scope Lock Challenge)

> {{error-sad-path}}

**Cross-session continuity:** (to be captured via Scope Lock Challenge)

> {{cross-session-continuity}}

## Acceptance Criteria

- [ ] Auto-refresh toggle exists in the UI; when on, the event table re-queries on an interval and merges new rows without losing active filters, sort, or scroll position
- [ ] Auto-refresh toggle state does not persist across page reload (defaults off) unless explicitly specified otherwise
- [ ] Each filterable field (session_id, initiative_id, event_type, phase, agent, product_id) offers suggested values sourced from existing distinct data as the user types
- [ ] Clicking a sortable column header sorts the table by that column and toggles ascending/descending on repeated clicks
- [ ] The sort-field dropdown/direction control and the column headers stay in sync: changing one updates the other's displayed state
- [ ] No new frontend build step or dependency is introduced
