---
title: "Requirement: req-006 - FEA-003 initiative_id Filter on All Query Families"
summary: "Add optional initiative_id filter to bottlenecks, failures, and token-efficiency query families."
status: "active"
version: "0.1.0"
---
# Requirement: req-006 - FEA-003 initiative_id Filter

**Skill:** spec-agent
**Feature:** 0000008c-mcp-fixes-and-enhancements
**Source:** Feature Brief FEA-003; docs/0008c §3.2
**Priority:** should-have

---

## Context

`initiative_id` is a first-class column in the `events` table and the natural scope for multi-initiative workspaces. It is currently not exposed as a filter in any query family. All three existing query families (`bottlenecks`, `failures`, `token-efficiency`) must gain an optional `initiative_id` filter using a consistent WHERE clause pattern.

---

## Functional Requirements

### All three query families

- Each query interface (`BottleneckQuery`, `FailureQuery`, `TokenEfficiencyQuery`) MUST gain an optional readonly `initiative_id?: string` field.
- When `initiative_id` is provided, the WHERE clause MUST append `AND initiative_id = $initiative_id` (parameterised).
- When `initiative_id` is omitted, behaviour is unchanged — no WHERE clause addition.
- `initiative_id` filter MUST be composable with existing filters (`session_id`, `run_id`, `limit`) using AND logic.
- The filter MUST be applied in `buildWhereClause()` (or equivalent) in each query file — not inline in the SQL string.

### Per-file changes

**`src/query/bottlenecks.ts`:**
```typescript
export interface BottleneckQuery {
  readonly group_by: BottleneckGroupBy;
  readonly run_id?: string;
  readonly session_id?: string;
  readonly initiative_id?: string;  // ← add
  readonly limit?: number;
}
// buildWhereClause: add initiative_id clause
```

**`src/query/failures.ts`:**
```typescript
// Add initiative_id?: string to FailureQuery (or whichever interface governs the family)
// buildWhereClause equivalent: add initiative_id clause
```

**`src/query/token-efficiency.ts`:**
```typescript
// Add initiative_id?: string to TokenEfficiencyQuery
// buildWhereClause equivalent: add initiative_id clause
```

---

## Acceptance Criteria

- [ ] `query_telemetry` with `{ group_by: "phase", initiative_id: "<id>" }` returns only events matching that initiative
- [ ] `query_telemetry` with `{ group_by: "phase", initiative_id: "<non-existent-id>" }` returns empty result set (not error)
- [ ] `query_telemetry` with `{ mode: "retry_summary", initiative_id: "<id>" }` returns only events matching that initiative
- [ ] `query_telemetry` with `{ mode: "retry_summary", initiative_id: "<non-existent-id>" }` returns empty result set (not error)
- [ ] `query_telemetry` with `{ mode: "context_pressure", initiative_id: "<id>" }` returns only events matching that initiative
- [ ] `query_telemetry` with `{ mode: "context_pressure", initiative_id: "<non-existent-id>" }` returns empty result set (not error)
- [ ] `initiative_id` filter combined with `session_id` applies AND logic and correctly scopes to the intersection

---

## Dependencies

- `src/query/bottlenecks.ts` — `BottleneckQuery` interface and `buildWhereClause()`
- `src/query/failures.ts` — failure query interface and WHERE clause
- `src/query/token-efficiency.ts` — token efficiency query interface and WHERE clause
- `src/query/query-service.ts` — update interface types if query types are re-exported
- `tests/integration/query-telemetry.test.ts` — 7 new integration test cases with multi-initiative seed data
