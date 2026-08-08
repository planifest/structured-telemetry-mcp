---
title: "Requirement: req-010 - Event-Log Pagination Tiebreaker"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-010 - Event-Log Pagination Tiebreaker

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Source:** US-004
**Priority:** must-have

## User Story

As an engineer reading the event log, I want every page to show a stable, complete slice of the results, so that paging through a log never silently hides events.

## Functional Requirements

- **Finding, confirmed against source:** `src/query/event-log.ts`'s `queryEventLog()` builds `ORDER BY ${sortColumn} ${sortDirection}` (line 62) using only the single user-selected `sortColumn` (resolved from the `sortField` allow-list, `ALLOWED_EVENT_COLUMNS`, per ADR-024). With `limit`/`offset` pagination and no secondary sort key, any two rows sharing the same value for the sorted column (e.g. two events with the identical `timestamp`, or the same `agent` value) have no guaranteed relative order across separate queries — DuckDB is free to return them in a different order on the page-2 query than it did on the page-1 query, which is the measured 26–45% row-drop/duplication defect.
- Append `id` (the events table's UUID primary key, always non-null per `data-contract.md`'s schema invariants) as a second `ORDER BY` term after the user-selected `sortColumn`, using the **same** sort direction as the primary field (`ORDER BY ${sortColumn} ${sortDirection}, id ${sortDirection}`) so the combined order is a strict total order that does not flip between pages.
- `id` is a `gen_random_uuid()`-generated VARCHAR with no inherent chronological meaning — it is used here purely as a uniqueness tiebreaker, not as a user-visible sort criterion. This does not change what `sortField`/`sort` mean to API callers; it only guarantees determinism when the primary field has duplicate values.
- This is additive to the existing `ORDER BY` — no change to `SORTABLE_FIELDS`, `ALLOWED_EVENT_COLUMNS`, or the `sortField` API surface (ADR-024's allow-list is unaffected; `id` is not being added as a selectable `sortField` value).

## Acceptance Criteria

- [ ] Paging through a seeded result set containing duplicate values for every sortable field (`timestamp`, `event`, `session_id`, `phase`, `agent`, `product_id`) returns the exact union of the source set, with zero dropped rows and zero duplicated rows, for each field
- [ ] The above holds for both `sort: 'asc'` and `sort: 'desc'`
- [ ] `total_count` continues to match the actual number of rows returned across a full pagination, for every field/direction combination tested
- [ ] Existing single-page queries (no duplicate sort-key rows in the result) are unaffected — response shape and ordering for the already-covered cases in `tests/e2e/backend/` and existing unit/integration tests remain unchanged
- [ ] A regression test explicitly seeds rows with duplicate sort keys and asserts pagination completeness (per the acceptance criterion wording — "asserting pagination completeness rather than markup")

## Dependencies

- None outside `src/query/event-log.ts` — independent of the other nine requirements, consistent with design.md's Waves note that 00009 "is independent of the other three and may proceed in parallel."
