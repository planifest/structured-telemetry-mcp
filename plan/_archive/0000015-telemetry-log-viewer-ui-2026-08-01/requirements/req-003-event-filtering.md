---
title: "Requirement: req-003 - Event Filtering"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-003 - Event Filtering

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Source:** US-003
**Priority:** should-have

## User Story

As a developer, I filter the event table by session_id, initiative_id, event_type, phase, agent, product_id, and a full timestamp range, so that I can narrow down to relevant events.

## Functional Requirements

- Add `phase`, `agent`, and `product_id` as optional exact-match filters to `event_log` queries, alongside the existing `session_id`, `initiative_id`, `event_type`.
- Add `from` and `to` optional filters to `event_log` queries — full ISO 8601 timestamp precision (not date-only), inclusive range, either or both may be supplied independently.
- All filters combine with AND semantics — supplying multiple filters narrows the result set.
- UI exposes a control for each filter (session_id, initiative_id, event_type, phase, agent, product_id as text/select inputs; from/to as datetime inputs), all optional, individually clearable, plus a single "clear all filters" control.
- Changing any filter resets the current page to 1 (a filter change invalidates the previous page's meaning).
- All active filters, plus the current page number, page size, and sort, are reflected in the URL query string — reloading, bookmarking, or sharing the URL reproduces the exact same view (see Scope Lock — cross-session continuity in `plan/current/build-log.md`).
- A filter combination matching zero rows renders a plain "No matching events" state, reusing the existing `query_telemetry` zero-result scope-hint data (see `src/query/format-results.ts` / the 0000014 zero-result-scope-hint feature) where applicable, rather than a blank table.

## Acceptance Criteria

- [ ] `event_log` accepts `phase`, `agent`, `product_id`, `from`, `to` as optional filters, each independently and in combination with the existing three
- [ ] Combining two or more filters narrows results (AND, not OR)
- [ ] Changing a filter in the UI resets to page 1
- [ ] The full UI state (filters + page + page size + sort) round-trips through the URL query string: setting it via URL params on load reproduces the same view as setting it via the controls
- [ ] A filter combination with zero matches shows a "No matching events" message, not an empty/blank table
- [ ] `from`/`to` accept full timestamp precision, not just a date

## Dependencies

- Depends on req-001 (product_id must exist as a column/field before it can be filtered on)
- Depends on req-002 (offset/limit/sort/total_count groundwork) — this requirement extends the same `EventLogQuery` interface and SQL `WHERE` builder in `src/query/event-log.ts`
