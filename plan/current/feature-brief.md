---
title: "Feature Brief - Structured Telemetry MCP Fixes and Enhancements"
summary: "Bug fixes, schema additions, new query capabilities, and a clean-slate deployment for the structured-telemetry-mcp server (0008c)."
status: "approved"
version: "0.1.0"
---
# Feature Brief - Structured Telemetry MCP Fixes and Enhancements

**Feature ID:** `0000008c-mcp-fixes-and-enhancements`

---

## Business Goal

The deployed 0008a MCP server was found to have three data-loss bugs, five missing event types needed by framework skills, and three missing query capabilities during 0008b integration work. These gaps prevent framework skills from correctly recording and querying telemetry, and silent failures mean agents cannot detect when queries are malformed. This release fixes all known bugs, adds the missing schema coverage, and extends query capability — then clears pre-production data for a clean production baseline.

---

## Features

| Feature | User Stories | Priority | Phase |
|---------|-------------|----------|-------|
| Schema additions (SCH-001–005) | Add `phase_skip`, `security_finding`, `retry_limit_exceeded`, `adr_decision`, `doc_gap` event types | must-have | 1 |
| Bug fixes (BUG-001–003) | Fix `group_by: "mcp_mode"` HTTP 400; fix silent empty results for `failure_sequence` and `drill_down` when `session_id` omitted | must-have | 1 |
| Query enhancements (FEA-001–003) | Add `event_log` mode; add `group_by: "initiative_id"`; add `initiative_id` filter to all query families | should-have | 1 |
| Post-deployment truncation | Human-only scripts (`scripts/DELETE-ALL-PRODUCTION-RECORDS.ps1` / `.sh`) requiring admin/sudo, printing a warning with "ERROR! YOU MUST CONSULT THE HUMAN ON THE LOOP! YOU SHOULD NOT HAVE RUN THIS", and requiring interactive entry of exact phrase "I UNDERSTAND THAT THIS WILL DELETE ALL RECORDS!" before executing DELETE | must-have | 1 |

---

## Phases

Single phase — all 12 items ship together as version `0.2.0`.

| Phase | Features Included | Ships When |
|-------|-------------------|------------|
| 1 | All of the above | CI passes, truncation command verified |

---

## Target Architecture

### Components

| Component | Type | New or Existing | Responsibility |
|-----------|------|-----------------|---------------|
| `structured-telemetry-mcp` | MCP server | existing | Telemetry event storage, schema validation, query service |

### Data Ownership

| Data Store | Owner Component | Shared With |
|------------|----------------|-------------|
| `telemetry.db` (DuckDB) | `structured-telemetry-mcp` | read-only by MCP clients via `query_telemetry` |

### Integration Points

| From | To | Method | Contract |
|------|-----|--------|----------|
| Framework skills | `structured-telemetry-mcp` | HTTP/SSE (MCP protocol) | `emit_event`, `query_telemetry` tools |

---

## Stack

| Concern | Decision |
|---------|----------|
| Language | TypeScript |
| Runtime | Node.js |
| Framework | Express (HTTP/SSE MCP transport) |
| Frontend | none |
| Database | DuckDB (local file) |
| ORM | none (raw SQL) |
| Testing | Vitest |
| IaC | none |
| Cloud | none |
| Compute | local daemon (Windows Service via deploy.ps1) |
| CI | GitHub Actions |

---

## Scope Boundaries

### In Scope
- SCH-001: Add `phase_skip` event type to schema
- SCH-002: Add `security_finding` event type to schema
- SCH-003: Add `retry_limit_exceeded` event type to schema
- SCH-004: Add `adr_decision` event type to schema
- SCH-005: Add `doc_gap` event type to schema
- BUG-001: Add `mcp_mode` to `BottleneckGroupBy` and `resolveGroupColumn()`
- BUG-002: Validate `session_id` presence for `failure_sequence`; throw on missing
- BUG-003: Validate `session_id` presence for `drill_down`; throw on missing
- FEA-001: Add `mode: "event_log"` raw event query (session or initiative scoped)
- FEA-002: Add `group_by: "initiative_id"` to `BottleneckGroupBy`
- FEA-003: Add `initiative_id` filter to all three query families
- POST-001: `scripts/DELETE-ALL-PRODUCTION-RECORDS.ps1` (Windows) and `scripts/DELETE-ALL-PRODUCTION-RECORDS.sh` (Unix) — NOT in package.json bin, NOT accessible via npx; requires admin/sudo; prints prominent warning including "ERROR! YOU MUST CONSULT THE HUMAN ON THE LOOP! YOU SHOULD NOT HAVE RUN THIS"; requires interactive entry of exact phrase "I UNDERSTAND THAT THIS WILL DELETE ALL RECORDS!" to proceed; reports deleted row count on success

### Out of Scope
- 0008b framework doc changes (tracked separately in the framework repo)
- Authentication or access control changes
- DuckDB schema structural changes (all changes are additive to JSON `data` column)
- npm publish / release to registry

### Deferred
- Nothing deferred.

---

## Non-Functional Requirements

| NFR | Target | Measurement |
|-----|--------|-------------|
| Latency | `emit_event` p95 < 100ms | `tests/performance.test.ts` — 1000 iterations, `P95_THRESHOLD_MS = 100`; Windows GH-hosted runners measure ~28ms p95 in practice |
| Availability | Local daemon — no SLO | n/a |
| Backward compatibility | All existing stored events remain valid after schema additions | No migration required (additive only) |

---

## Constraints and Assumptions

### Constraints
- Schema changes must be additive only — no changes to existing `$defs` or `required` arrays of existing event types
- No DB structural migration needed — new event types stored in existing `data` JSON column
- No new npm packages — all changes use the existing dependency set (DuckDB, Express, Vitest, AJV)
- All existing dependencies must be verified against latest stable versions using live registry information before the release build; no pinned version may be outdated at ship time

### Assumptions
- No production users exist — truncation is safe and expected
- All schema additions are additive per the migration policy in `docs/data-contract.md`
- `initiative_id` is already a first-class column in the `events` table (confirmed in 0008a)
- `mcp_mode` is already a first-class column in the `events` table (confirmed in 0008a)

---

## Acceptance Criteria

### Release (SCH + BUG + FEA)
- [ ] `emit_event` accepts all five new event types without validation errors
- [ ] `query_telemetry` with `group_by: "mcp_mode"` returns 200 (not 400)
- [ ] `query_telemetry` with `mode: "failure_sequence"` and no `session_id` returns an error (not empty results)
- [ ] `query_telemetry` with `mode: "drill_down"` and no `session_id` returns an error (not empty results)
- [ ] `query_telemetry` with `mode: "event_log"` returns full event stream for a session or initiative
- [ ] `query_telemetry` with `group_by: "initiative_id"` returns grouped results
- [ ] `query_telemetry` with `initiative_id` filter on any mode scopes results correctly
- [ ] All existing tests pass
- [ ] CI passes on all 6 matrix combinations

---

## Test Specification (~54 new tests)

### SCH-001 `phase_skip` (4 tests)
- [ ] Valid payload `{ phase_name, reason }` passes validation
- [ ] Missing `phase_name` rejected
- [ ] Missing `reason` rejected
- [ ] Additional property rejected (`additionalProperties: false`)

### SCH-002 `security_finding` (6 tests)
- [ ] Valid payload `{ component_id, title, severity }` passes validation
- [ ] Missing `component_id` rejected
- [ ] Missing `title` rejected
- [ ] Missing `severity` rejected
- [ ] Invalid `severity` value (not in enum) rejected
- [ ] Optional `cwe` field accepted when present; absent is valid

### SCH-003 `retry_limit_exceeded` (5 tests)
- [ ] Valid payload `{ phase_name, action_id, attempt_count }` passes validation
- [ ] Missing `phase_name` rejected
- [ ] Missing `action_id` rejected
- [ ] Missing `attempt_count` rejected
- [ ] `attempt_count` below minimum (< 1) rejected

### SCH-004 `adr_decision` (4 tests)
- [ ] Valid payload `{ adr_id, title, chosen_option }` passes validation
- [ ] Missing `adr_id` rejected
- [ ] Missing `title` rejected
- [ ] Missing `chosen_option` rejected

### SCH-005 `doc_gap` (3 tests)
- [ ] Valid payload `{ component_id, description }` passes validation
- [ ] Missing `component_id` rejected
- [ ] Missing `description` rejected

### BUG-001 `mcp_mode` group_by (4 tests)
- [ ] `group_by: "mcp_mode"` returns HTTP 200 with grouped results
- [ ] `group_by: "mcp_mode"` with seeded data returns correct group keys
- [ ] `group_by: "mcp_mode"` combined with `initiative_id` filter returns scoped groups
- [ ] Regression: all existing `group_by` values (`phase`, `agent`, `tool`, `run_id`, `content_type`) still return 200

### BUG-002 `failure_sequence` session_id validation (3 tests)
- [ ] `mode: "failure_sequence"` with no `session_id` throws error (not empty array)
- [ ] `mode: "failure_sequence"` with `session_id: ""` throws error (not empty array)
- [ ] `mode: "failure_sequence"` with valid `session_id` returns results correctly

### BUG-003 `drill_down` session_id validation (3 tests)
- [ ] `mode: "drill_down"` with no `session_id` throws error (not empty array)
- [ ] `mode: "drill_down"` with `session_id: ""` throws error (not empty array)
- [ ] `mode: "drill_down"` with valid `session_id` returns results correctly

### FEA-001 `event_log` mode (7 tests)
- [ ] `mode: "event_log"` scoped by `session_id` returns all events for that session
- [ ] `mode: "event_log"` scoped by `initiative_id` returns all events for that initiative
- [ ] Results are ordered by `timestamp` ascending
- [ ] `limit` parameter is respected
- [ ] Full `data` payload is included in each row (not filtered)
- [ ] No matching events returns empty array (not error)
- [ ] Neither `session_id` nor `initiative_id` provided returns error or full log (document which)

### FEA-002 `group_by: "initiative_id"` (3 tests)
- [ ] `group_by: "initiative_id"` returns one row per distinct initiative
- [ ] Multiple initiatives in data produce correct per-initiative aggregates
- [ ] `limit` parameter correctly restricts the number of groups returned

### FEA-003 `initiative_id` filter across query families (7 tests)
- [ ] `bottlenecks` with `initiative_id` filter returns only matching events
- [ ] `bottlenecks` with `initiative_id` matching no records returns empty (not error)
- [ ] `failures` with `initiative_id` filter returns only matching events
- [ ] `failures` with `initiative_id` matching no records returns empty (not error)
- [ ] `token-efficiency` with `initiative_id` filter returns only matching events
- [ ] `token-efficiency` with `initiative_id` matching no records returns empty (not error)
- [ ] `initiative_id` filter combined with `session_id` correctly scopes to intersection

### Regression (5 tests)
- [ ] Existing `phase_start` / `phase_end` / `tool_call` / `self_correction` / `deviation` event types still validated and stored correctly
- [ ] Existing `bottlenecks`, `failures`, `token-efficiency` query modes return same results as pre-patch with identical seed data

---

### Post-deployment script (POST-001)
- [ ] Script exits immediately if not running as admin/sudo, printing a clear message explaining why (e.g. "This script must be run as Administrator / with sudo. Exiting.")
- [ ] Script prints warning containing "ERROR! YOU MUST CONSULT THE HUMAN ON THE LOOP! YOU SHOULD NOT HAVE RUN THIS" before prompting
- [ ] Script aborts unless the user types exactly "I UNDERSTAND THAT THIS WILL DELETE ALL RECORDS!" at the interactive prompt
- [ ] On confirmation, script deletes all rows and prints the deleted row count
