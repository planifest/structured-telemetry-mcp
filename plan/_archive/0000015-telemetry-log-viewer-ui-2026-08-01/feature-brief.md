---
title: "Feature Brief - telemetry-log-viewer-ui"
summary: "The business case, scope, and product requirements for the feature."
status: "approved"
version: "0.1.0"
---
# Feature Brief - telemetry-log-viewer-ui

**Feature ID:** 0000015-telemetry-log-viewer-ui

## Business Goal

Developers debugging pipeline runs (retries, context pressure, failures) currently have to hand-write JSON queries via `curl` or an MCP tool call to inspect telemetry — there is no browsable view, so casual inspection ("what happened in session X yesterday") is needlessly slow. This feature adds a browser-based, read-only viewer for the events already stored by `structured-telemetry-mcp`, with filtering and paging, for a single local developer (no auth, no multi-user access).

## Features

| Feature | User Stories | Priority | Wave |
|---------|-------------|----------|------|
| product_id Tagging | As a developer, I see which repo/project emitted each event, so that I can distinguish events across the multiple projects sharing one telemetry DB. | should-have | 1 |
| Event Log Table | As a developer, I view a paginated table of telemetry events (newest first, with a total count), so that I can browse history without hand-writing queries. | should-have | 1 |
| Event Filtering | As a developer, I filter the event table by session_id, initiative_id, event_type, phase, agent, product_id, and a full timestamp range, so that I can narrow down to relevant events. | should-have | 1 |
| Event Detail View | As a developer, I click a row to see the event's full JSON (envelope + typed data payload), so that I can inspect fields not shown in the table. | should-have | 1 |

Build order within wave 1: product_id Tagging first (the other three features filter/display on it), then Event Log Table, then Event Filtering, then Event Detail View.

## Waves

Single wave — all four features ship together in one pipeline run.

| Wave | Features Included | Ships When |
|------|-------------------|------------|
| 1 | product_id Tagging, Event Log Table, Event Filtering, Event Detail View | All four validated, secured, documented |

## Target Architecture

### Components

| Component | Type | New or Existing | Responsibility |
|-----------|------|-----------------|---------------|
| structured-telemetry-mcp | service | existing | Adds: `product_id` schema field + DB column, expanded `event_log` query (offset pagination, total_count, sort, new filters), static UI served over HTTP. No new component created — the UI is static assets served by the existing `server-http.ts` process. |

### Data Ownership

| Data Store | Owner Component | Shared With |
|------------|----------------|-------------|
| `events` table (DuckDB, incl. new `product_id` column) | structured-telemetry-mcp | Read via MCP `query_telemetry`, REST `/query`, and the new UI (all same-process reads) |

### Integration Points

| From | To | Method | Contract |
|------|-----|--------|----------|
| Browser UI (static JS) | structured-telemetry-mcp backend | REST (fetch) | `POST /query` with `mode: "event_log"`, extended with `offset`, `sort`, `phase`, `agent`, `product_id`, `from`/`to` params |

**Cross-product dependency (not built in this feature):** `planifest-framework`'s own telemetry emission hooks (`planifest-framework/hooks/telemetry/*.mjs`) need to start populating `product_id` (derived from `git rev-parse --show-toplevel`, fallback `cwd`) on every event they emit. That is the framework product's own responsibility on its own timeline — filed as `plan/backlog/00002-framework-product-id-emission` in this repo for visibility, not implemented here.

## Stack

| Concern | Decision |
|---------|----------|
| Language | TypeScript (backend, existing) + vanilla JavaScript (frontend, new) |
| Runtime | Node.js (existing) |
| Framework | None — raw `node:http`, matching the existing `server-http.ts` pattern; new static/UI routes added directly to it |
| Frontend | Plain HTML/CSS/vanilla JS (ES modules), no build step, no new dependency |
| Database | DuckDB (existing) |
| ORM | None — raw SQL via prepared statements (existing pattern) |
| Testing | Vitest (existing) |
| IaC | None |
| Cloud | None (local-only, bound to 127.0.0.1) |
| Compute | Local persistent Node process (existing `server-http.bundle.mjs`, managed by the existing service scripts) |
| CI | Existing project CI (unchanged) |
| Build target | local |

## Scope Boundaries

### In Scope
- `product_id` field on the event envelope schema (additive, optional) + DuckDB column + migration proposal
- `event_log` query: offset-based pagination with `total_count`, `sort` param (default ASC unchanged for back-compat), new filters (`phase`, `agent`, `product_id`, `from`/`to` timestamp range) alongside existing (`session_id`, `initiative_id`, `event_type`)
- Static browser UI (served by the existing backend) with: paginated event table (newest-first default), all filters above, row-click detail view showing full JSON
- URL-query-string-based UI state (filters/page/sort) for shareable/refresh-safe views
- Empty-state and backend-unreachable-banner handling

### Deferred
*(Nothing in this feature's problem space is permanently excluded — these are simply not being built now.)*
- Aggregation/dashboard views in the UI (bottleneck/failure/token-efficiency charts) — remain MCP/REST-only for now; could be a future wave on top of this UI's shell
- Authentication / multi-user access — revisit if this ever needs to run for more than one person
- Editing or deleting events from the UI — revisit only with a specific need; today the viewer is read-only
- Live auto-refresh / tail mode — revisit if manual refresh proves too slow in practice
- Backfilling `product_id` on historical rows — not feasible; other projects besides this repo have also emitted to the shared DB historically, so there's no reliable signal to backfill from. Existing rows permanently display `product_id` as "unknown"
- `planifest-framework`'s own emitters populating `product_id` — cross-product dependency, filed to backlog, not this feature's pipeline

## Non-Functional Requirements

| NFR | Target | Measurement |
|-----|--------|-------------|
| Latency | p95 < 300ms per page load/query | Manual timing during P4 validation against local DuckDB with representative data volume |
| Availability | Best-effort, matches existing backend (no SLO — local single-developer tool) | N/A |
| Security | No auth; server remains bound to 127.0.0.1 only (existing posture, unchanged) | Code review at P5 confirms no new network exposure |
| Data privacy | UI makes no external network calls — telemetry can contain free-text agent-authored fields (e.g. `question`, `description`, `reason`) that must never leave the local machine | Code review at P5 confirms zero third-party/external fetch calls in UI code |

## Constraints and Assumptions

### Constraints
- Must not introduce a build step/bundler/new frontend dependency (plain JS, no framework) per the confirmed stack decision
- Must not modify `planifest-framework/hooks/telemetry/*.mjs` (currently mid an unrelated framework-product WIP) — `product_id` population there is out of scope
- Schema changes are additive only; any DB column addition requires a migration proposal document and explicit human approval before being applied (framework Hard Limit)

### Assumptions
- The existing `server-http.ts` process (bound to 127.0.0.1:3741) is the right place to serve the UI's static assets — impact if wrong: UI would need its own process/port, adding deployment complexity
- Event volumes on a single local developer's machine are small enough that DuckDB offset pagination performs well without needing cursor-based pagination — impact if wrong: revisit pagination strategy if p95 latency target is missed at realistic data volumes

## Scenario Paths

**Happy path:** Human opens `http://127.0.0.1:3741/ui` in a browser → sees the most recent events (newest first, page 1, default page size) with `product_id`/`session_id`/`phase`/`agent` columns → applies a filter (e.g. `session_id`) and/or changes page → table updates → clicks a row → sees full JSON detail.

**First-run path:** Zero events in the database → UI shows an empty-state message ("No events yet"), not an error. If the backend hasn't been rebuilt/restarted with the `product_id` migration yet, the UI's `product_id` filter/column simply shows "unknown" for all rows rather than erroring — consistent with how existing untagged historical rows are handled permanently.

**Error / sad path:** Backend unreachable (health check fails) → UI shows a clear banner ("Can't reach telemetry backend at :3741 — is the service running?") instead of a blank/broken page. A query that errors server-side surfaces the error message inline. A filter combination that matches zero rows shows a plain "No matching events" state (reusing the existing zero-result scope-hint data from `query_telemetry` where applicable), not a blank table.

**Cross-session continuity:** All UI state (filters, page number, page size, sort) lives in the URL query string, not just in-memory JS state. Refreshing, bookmarking, or sharing a link reproduces the exact same view. No server-side session state is needed — fits the stateless, no-auth, single-user posture.

## Acceptance Criteria

- [ ] `product_id` is a valid optional field on the telemetry event schema; events with and without it both validate and store correctly
- [ ] `event_log` queries accept `offset`, `sort` (`asc`|`desc`, default `asc`), `phase`, `agent`, `product_id`, `from`, `to` in addition to existing filters, and return a `total_count`
- [ ] No scope filter is required to run an `event_log` query — every request is bounded solely by its `limit`/`offset` (ADR-010 requirement removed); a limit above a sane maximum (e.g. 1000) is rejected as an API-misuse guard
- [ ] `GET /ui` (or equivalent route) serves a working browser page with a paginated, newest-first event table, all confirmed filters, and a row-click detail view showing full raw JSON
- [ ] Filters, page number, page size, and sort persist in the URL query string and restore correctly on reload
- [ ] Backend-unreachable and zero-event states render clear, non-error UI states rather than blank/broken pages
- [ ] UI code makes zero external (non-127.0.0.1) network calls
- [ ] A migration proposal document exists for the `product_id` DB column and is approved by the human before being applied
