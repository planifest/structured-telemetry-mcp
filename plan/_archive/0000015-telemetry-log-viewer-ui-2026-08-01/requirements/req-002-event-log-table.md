---
title: "Requirement: req-002 - Event Log Table"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-002 - Event Log Table

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Source:** US-002
**Priority:** should-have

## User Story

As a developer, I view a paginated table of telemetry events (newest first, with a total count), so that I can browse history without hand-writing queries.

## Functional Requirements

- Remove the "at least one scope parameter" requirement currently enforced in two places — `src/query/event-log.ts` (`queryEventLog`) and `src/server-factory.ts` (`dispatchQuery`'s pre-check for `mode: 'event_log'`) — so that an `event_log` query with no filters at all is valid. Every request remains bounded solely by `limit`/`offset`.
- Add an `offset` parameter to `event_log` queries (integer, default `0`).
- Add a `sort` parameter to `event_log` queries: `"asc" | "desc"`, default `"asc"` (preserves existing behavior for any caller not passing it — non-breaking).
- Add a `total_count` field to the `event_log` aggregation response — the count of all rows matching the applied filters, independent of `limit`/`offset` (needed for "page X of Y" UI controls).
- Reject `limit` values above a sane maximum (1000) with a clear error, as an API-misuse guard — not a UX restriction (default page sizes are far below this).
- Expand the `event_log` SQL `SELECT` to return every column on the `events` table (`schema_version`, `tool`, `model`, `mcp_mode`, `model_config`, `inserted_at`, and the new `product_id` from req-001) in addition to the columns already selected — required so req-004's detail view has the complete row, not just the 8 columns currently selected.
- New static route (e.g. `GET /ui`) on the existing `server-http.ts` process serves the browser page. No new process, port, or component.
- UI renders: a table with columns for timestamp, event type, session_id, phase, agent, product_id (from req-001); newest-first by default (`sort: "desc"` requested by the UI); a page-size selector; prev/next controls; a "page X of Y" indicator computed from `total_count`.

## Acceptance Criteria

- [ ] `event_log` query with zero filters and no scope parameter succeeds (previously threw `"event_log requires at least one scope parameter..."`)
- [ ] `event_log` response includes `total_count` reflecting all matching rows, not just the current page
- [ ] `sort: "desc"` returns newest-first; omitting `sort` preserves the existing ascending order (back-compat)
- [ ] `limit` > 1000 is rejected with a clear error naming the maximum
- [ ] The three existing tests asserting the old scope-required error (`tests/unit/server-factory.test.ts:125`, `tests/integration/query-telemetry.test.ts:256`, `tests/regression/query-routing.test.ts:132`) are updated to reflect the new, more permissive contract — not left failing
- [ ] `GET /ui` returns a working HTML page showing the paginated table with the confirmed default view (newest first, page 1, default page size)
- [ ] Table row data includes `product_id`, displaying "unknown" for NULL

## Dependencies

- Depends on req-001 (product_id column must exist for the table to display/filter on it, and for the SELECT expansion to include it)
- Shares `src/query/event-log.ts` and `src/server-factory.ts` with req-003 (Event Filtering) — coordinate changes to the same `EventLogQuery` interface and SQL builder rather than duplicating them
