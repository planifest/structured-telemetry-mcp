---
title: "Requirement: req-007 - Bounded result sets"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-007 - Bounded result sets

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Source:** US-007
**Priority:** must-have

## User Story

As an operator, I want `failure_sequence` and `drill_down` to cap their result sets and report truncation, so that one query cannot exhaust daemon memory.

## Current defect

Two query modes have no `LIMIT` and materialise every matching row — including the full `data` JSON — into `aggregation.events`:

- `src/query/failures.ts:158-165` (`failure_sequence`)
- `src/query/token-efficiency.ts:211-218` (`drill_down`)

Every other mode is bounded: `event_log` caps at `MAX_LIMIT` (1000), `distinct_values` at 20, and the aggregate modes are bounded by group cardinality. These two are the outliers.

## Functional Requirements

- Both modes take an explicit `LIMIT` defaulting to **1000**, matching `event_log`'s existing ceiling (`src/query/event-log.ts:19`) and the ADR-016 precedent.
- Both responses gain two additive fields:
  - `truncated: boolean` — whether the cap was hit
  - `total_count: number` — the full match count, so a caller can tell a capped result from a complete one
- **Both fields nest inside the `aggregation` object**, which is what surfaces to callers as `json`. This is not a free choice: `src/query/event-log.ts:83-88` already places `total_count` there, and `src/ui/index-html.ts:371` and `:419` read `json.total_count`. Placing them at the top level of the response would break the existing consumer and diverge from the established shape for the same field name.
- `total_count` is obtained without materialising the rows — a `COUNT(*)` over the same predicate, not `rows.length`.
- The fields are additive. Existing successful response shapes are otherwise unchanged, so no caller breaks.
- The cap is overridable per request through the same validated `limit` field governed by req-005. Consistent with `event_log`, a `limit` above the ceiling is **rejected**, not clamped.

## Acceptance Criteria

- [ ] For both `failure_sequence` and `drill_down`: an over-cap session returns exactly 1000 rows with `json.truncated === true` and `json.total_count` reporting the true larger total, while an under-cap session returns every row with `json.truncated === false` and `json.total_count` equal to the row count
- [ ] Both new fields appear **inside `json`**, alongside `event_log`'s existing `total_count`, and `total_count` is produced by a count query rather than by counting materialised rows
- [ ] An in-range explicit `limit` is honoured on both modes; an over-ceiling `limit` is rejected by req-005's gate before either mode runs; and existing consumers still parse both responses unchanged

## Dependencies

- req-005 validates the `limit` these modes now accept.
- req-008 caps the MCP-side serialisation of these same responses; the two are complementary and neither substitutes for the other.
- ADR-016 is the bounding precedent to follow.

## Notes

Backlog 00014's third suggested action — replacing the full `data` payload per row with a projection — is **deferred**, not adopted here. It is recorded in `scope.md` as blocked on evidence that the capped payload is still too large in practice.
