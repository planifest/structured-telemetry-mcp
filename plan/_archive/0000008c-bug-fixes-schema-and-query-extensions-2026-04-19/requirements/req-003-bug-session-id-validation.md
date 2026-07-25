---
title: "Requirement: req-003 - BUG-002 & BUG-003 Silent Empty Results on Missing session_id"
summary: "failure_sequence and drill_down must throw on missing session_id rather than silently returning empty results."
status: "active"
version: "0.1.0"
---
# Requirement: req-003 - BUG-002 & BUG-003 session_id Validation

**Skill:** spec-agent
**Feature:** 0000008c-mcp-fixes-and-enhancements
**Source:** Feature Brief BUG-002, BUG-003; docs/0008c §2 BUG-002, BUG-003
**Priority:** must-have

---

## Context

**BUG-002 (`failure_sequence`):** `src/query/failures.ts` dispatches `failure_sequence` as:
```typescript
case 'failure_sequence': return queryFailureSequence(db, query.session_id ?? '');
```
When `session_id` is omitted, it falls back to `''`. SQL `WHERE session_id = ''` returns zero rows silently. The caller cannot distinguish a genuinely empty session from a malformed query.

**BUG-003 (`drill_down`):** `src/query/token-efficiency.ts` has the same pattern for `drill_down`. Same silent failure mode.

Both are classified as data-loss bugs: an agent calling these modes without a `session_id` receives a false "no data" signal.

---

## Functional Requirements

- `failure_sequence` dispatch MUST validate that `session_id` is present and non-empty before calling `queryFailureSequence`.
- `failure_sequence` MUST throw `Error('failure_sequence requires session_id')` if `session_id` is absent or empty string.
- `drill_down` dispatch MUST validate that `session_id` is present and non-empty before calling `queryDrillDown`.
- `drill_down` MUST throw `Error('drill_down requires session_id')` if `session_id` is absent or empty string.
- Both errors MUST propagate through `dispatchQuery` to the MCP tool handler, which returns them as an error response to the caller.
- The fallback `?? ''` pattern MUST be removed from both dispatch sites.

---

## Acceptance Criteria

- [ ] `query_telemetry` with `{ mode: "failure_sequence" }` (no `session_id`) returns an error response, not an empty result set
- [ ] `query_telemetry` with `{ mode: "failure_sequence", session_id: "" }` returns an error response, not an empty result set
- [ ] `query_telemetry` with `{ mode: "failure_sequence", session_id: "<valid-uuid>" }` returns correct results (regression)
- [ ] `query_telemetry` with `{ mode: "drill_down" }` (no `session_id`) returns an error response, not an empty result set
- [ ] `query_telemetry` with `{ mode: "drill_down", session_id: "" }` returns an error response, not an empty result set
- [ ] `query_telemetry` with `{ mode: "drill_down", session_id: "<valid-uuid>" }` returns correct results (regression)

---

## Dependencies

- `src/query/failures.ts` — `failure_sequence` dispatch case
- `src/query/token-efficiency.ts` — `drill_down` dispatch case
- `tests/unit/server-factory.test.ts` — add unit tests for both error cases via mock `IQueryService`
- `tests/integration/query-telemetry.test.ts` — add integration tests confirming error response (not empty array)
