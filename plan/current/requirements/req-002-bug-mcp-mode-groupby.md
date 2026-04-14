---
title: "Requirement: req-002 - BUG-001 mcp_mode group_by returns HTTP 400"
summary: "Add mcp_mode to BottleneckGroupBy and resolveGroupColumn so grouping by mcp_mode succeeds."
status: "active"
version: "0.1.0"
---
# Requirement: req-002 - BUG-001 mcp_mode group_by

**Skill:** spec-agent
**Feature:** 0000008c-mcp-fixes-and-enhancements
**Source:** Feature Brief BUG-001; docs/0008c §2 BUG-001
**Priority:** must-have

---

## Context

`BottleneckGroupBy` in `src/query/bottlenecks.ts` is typed as `'phase' | 'agent' | 'tool' | 'run_id' | 'content_type'`. The `resolveGroupColumn()` function is an exhaustive switch — an unrecognised value falls through and returns `undefined`, producing invalid SQL rejected with HTTP 400.

`mcp_mode` is a first-class `VARCHAR NOT NULL` column in the `events` table. Being unable to group bottleneck data by `mcp_mode` prevents the primary use case of comparing phase durations across MCP configurations.

---

## Functional Requirements

- `BottleneckGroupBy` MUST include `'mcp_mode'` as a valid union member.
- `resolveGroupColumn()` MUST handle `case 'mcp_mode': return 'mcp_mode'` without falling through.
- The TypeScript exhaustive check on the switch MUST be satisfied — no implicit `undefined` return path.
- `dispatchQuery` in `src/server-factory.ts` routes any query with a `group_by` field to `qs.bottlenecks()` — no change to dispatch logic required.

---

## Acceptance Criteria

- [ ] `query_telemetry` with `{ group_by: "mcp_mode" }` returns HTTP 200 with a valid `QueryResponse`
- [ ] With seeded data containing multiple distinct `mcp_mode` values, result rows use `mcp_mode` values as `group_key`
- [ ] `query_telemetry` with `{ group_by: "mcp_mode", initiative_id: "<id>" }` returns scoped results (requires FEA-003)
- [ ] Regression: all existing `group_by` values (`phase`, `agent`, `tool`, `run_id`, `content_type`) continue to return correct results

---

## Dependencies

- `src/query/bottlenecks.ts` — `BottleneckGroupBy` type and `resolveGroupColumn()`
- `tests/unit/server-factory.test.ts` — add dispatch test for `group_by: "mcp_mode"`
- `tests/integration/query-telemetry.test.ts` — add integration test with seeded `mcp_mode` data
