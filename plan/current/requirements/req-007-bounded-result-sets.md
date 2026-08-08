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

- Both modes take an explicit `LIMIT` with a documented default, consistent with the `event_log` / ADR-016 precedent.
- Both responses gain two additive fields:
  - `truncated: boolean` — whether the cap was hit
  - `total_count: number` — the full match count, so a caller can tell a capped result from a complete one
- `total_count` is obtained without materialising the rows — a `COUNT(*)` over the same predicate, not `rows.length`.
- The fields are additive. Existing successful response shapes are otherwise unchanged, so no caller breaks.
- The cap is overridable per request through the same validated `limit` field governed by req-005, subject to the same `MAX_LIMIT` ceiling.

## Acceptance Criteria

- [ ] `failure_sequence` against a session with more rows than the cap returns exactly the cap, with `truncated: true`
- [ ] `total_count` on that response reports the true total, greater than the number of rows returned
- [ ] `failure_sequence` against a small session returns all rows with `truncated: false` and `total_count` equal to the row count
- [ ] `drill_down` behaves identically on both of the above
- [ ] `total_count` is computed by a count query, not by counting materialised rows — asserted by test or by inspection at review
- [ ] An explicit in-range `limit` on either mode is honoured
- [ ] An out-of-range `limit` is rejected by req-005's gate before reaching either mode
- [ ] Existing consumers of both modes still parse their responses — the new fields are additive only

## Dependencies

- req-005 validates the `limit` these modes now accept.
- req-008 caps the MCP-side serialisation of these same responses; the two are complementary and neither substitutes for the other.
- ADR-016 is the bounding precedent to follow.

## Notes

Backlog 00014's third suggested action — replacing the full `data` payload per row with a projection — is **deferred**, not adopted here. It is recorded in `scope.md` as blocked on evidence that the capped payload is still too large in practice.
