---
title: "Requirement: req-005 - FEA-002 group_by initiative_id"
summary: "Add initiative_id as a valid BottleneckGroupBy value alongside the mcp_mode fix."
status: "active"
version: "0.1.0"
---
# Requirement: req-005 - FEA-002 group_by initiative_id

**Skill:** spec-agent
**Feature:** 0000008c-mcp-fixes-and-enhancements
**Source:** Feature Brief FEA-002; docs/0008c §3.3
**Priority:** should-have

---

## Context

`initiative_id` is a first-class nullable `VARCHAR` column in the `events` table. It is not in `BottleneckGroupBy`. Grouping bottleneck data by initiative allows comparison of phase performance across multiple concurrent initiatives — a natural operational query for multi-initiative workspaces.

This change is implemented alongside BUG-001 (both touch `BottleneckGroupBy` and `resolveGroupColumn`).

---

## Functional Requirements

- `BottleneckGroupBy` MUST include `'initiative_id'` as a valid union member.
- `resolveGroupColumn()` MUST handle `case 'initiative_id': return 'initiative_id'`.
- Because `initiative_id` is nullable, rows with `NULL initiative_id` MUST be grouped under a `NULL` or `"unknown"` key — implementation MUST use `COALESCE(initiative_id, 'unknown')` as the group column expression to avoid null group keys in the result.
- The TypeScript exhaustive check on the switch MUST remain satisfied after both BUG-001 and FEA-002 additions.

---

## Acceptance Criteria

- [ ] `query_telemetry` with `{ group_by: "initiative_id" }` returns one row per distinct `initiative_id` value
- [ ] With events from multiple initiatives in seeded data, each initiative appears as a separate `group_key` row with correct aggregated metrics
- [ ] Events with `NULL initiative_id` appear under `group_key: "unknown"` (not dropped, not errored)
- [ ] `limit` parameter correctly restricts the number of initiative groups returned

---

## Dependencies

- `src/query/bottlenecks.ts` — `BottleneckGroupBy` type, `resolveGroupColumn()` (same edit as BUG-001)
- `tests/integration/query-telemetry.test.ts` — add 3 integration test cases with multi-initiative seed data
