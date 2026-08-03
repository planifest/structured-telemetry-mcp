# Changelog — 0000017-log-viewer-enhancements — 03 Aug 2026

**Feature:** Log Viewer Enhancements
**Pipeline run:** P0–P9 complete, no phases skipped
**PR:** pending — updated after PR is raised in Step 10

## What Was Built

A follow-on wave to 0000015's log viewer, closing three interaction gaps left by that static, one-shot browsing experience:

- **Live auto-refresh / tail mode** — a toggle on the event log that polls the existing `/query` endpoint every 5 seconds, merging new events into the table without losing active filters, sort, or scroll position. State persists via a `autoRefresh` URL param (default off). A poll failure keeps the last successful results visible, shows a quiet non-blocking indicator, and keeps retrying — it never silently disables itself.
- **Filter-value suggestions** — each of the 6 filterable fields (session_id, initiative_id, event_type, phase, agent, product_id) now offers a `<datalist>`-backed combobox of existing distinct values, sourced from a new `distinct_values` query mode (up to 20 results, optional prefix match).
- **Sortable table headers** — clicking any column header sorts by that column, toggling direction on repeat clicks. This required a genuine backend change: `event_log`'s sort was previously hardcoded to `ORDER BY timestamp` (direction was configurable, the column was not) — a P1 spec gap caught before codegen began. A new allow-listed `sortField` param makes real per-column sort possible. Column headers, the sort-field/direction dropdown, and the URL query params stay three-way synced.

Both new backend inputs that resolve to a SQL column identifier (`sortField`, `distinct_values`' `field`) validate against one shared allow-list module (`src/query/column-allow-list.ts`) before any SQL is built — DuckDB has no parameterized-identifier binding, so this is the sole defense against SQL-injection-via-identifier for either.

## Artifacts Produced

Feature Brief, confirmed design, discovery pass, execution plan, scope, risk register (4 risks + 2 assumptions), domain glossary, operational model, SLO definitions, cost model, 3 requirements, 4 ADRs (ADR-024–027), security report (Low risk, 0 critical/high findings), 5 living-doc updates, 5 per-component doc updates, recommendations (4 items), iteration log. 2 new backlog entries filed for orchestrator-UX friction found during this session (#00005, #00007), plus 1 for a related-but-out-of-scope UI feature (#00006).

## Decisions

- **ADR-024:** One shared, exported column allow-list is the single SQL-injection-via-identifier defense for both `sortField` and `distinct_values`' `field`.
- **ADR-025:** `event_log` gains a real per-column `sortField` (allow-listed, defaults to `timestamp`, fully backward-compatible).
- **ADR-026:** `distinct_values` is a new `mode` on the existing `POST /query` dispatch, not a new REST route.
- **ADR-027:** Auto-refresh is client-side interval polling (5s) — no WebSocket/SSE/push mechanism.

## Skipped Phases

None.
