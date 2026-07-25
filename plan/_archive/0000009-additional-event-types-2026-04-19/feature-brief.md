---
feature_id: "0000009-ship-phase-enum"
title: "Schema extension: 'ship' phase + 7 new event types"
status: "confirmed"
date: "2026-04-18"
---

# Feature Brief — 0000009-ship-phase-enum

## Problem Statement

Two gaps in the telemetry schema require fixing before the ship-agent ships:

1. `"ship"` is absent from the `phase` enum — ship-agent telemetry will silently fail on emit.
2. Seven categories of agent activity have no dedicated event type, forcing agents to either omit telemetry or misuse semantically incorrect types (e.g. stuffing a test failure into `validation_failure`).

## Target User

Framework agents (ship-agent, orchestrator, validate-agent, codegen-agent) emitting telemetry to the structured-telemetry-mcp daemon. Operators querying telemetry for pipeline analytics.

## User Stories

1. As the ship-agent, I emit `phase_start` / `phase_end` with `"phase": "ship"` and the server accepts them.
2. As any agent, I emit `context_reset` when a session compaction occurs so context burn is observable.
3. As any agent, I emit `approval_requested` when I pause for human sign-off so approval friction is measurable.
4. As the orchestrator, I emit `fast_path_engaged` when routing to fast path so pipeline complexity is visible.
5. As the validate-agent, I emit `test_failure` with the failing test name for granular failure attribution.
6. As the validate-agent, I emit `performance_regression` with structured metric data when an NFR target is breached.
7. As any agent, I emit `dependency_blocked` when I cannot proceed due to an unmet upstream dependency.
8. As any agent, I emit `schema_migration_applied` after executing a migration, completing the proposal→applied lifecycle.
9. As an operator, `"phase": "change"` continues to be accepted — no regression.

## Acceptance Criteria

- All 7 new event types accepted by `/emit` with valid payloads.
- All 7 new event types rejected with structured errors on invalid/missing required fields.
- `"phase": "ship"` accepted; `"phase": "change"` still accepted.
- TypeScript types compile cleanly for all new interfaces.
- Unit test coverage for every new event type (valid + invalid).
- Build and deploy completed before ship-agent is merged in the framework repo.

## Scope

**In:**
- Add `"ship"` to the `phase` enum in schema + TS types (REQ-021)
- Add 7 new event types to schema, TS types, and `validate-event.ts`: `context_reset`, `approval_requested`, `fast_path_engaged`, `test_failure`, `performance_regression`, `dependency_blocked`, `schema_migration_applied` (REQ-022–028)
- Unit test coverage for all new types

**Out:**
- No query layer changes (new event types are automatically queryable via `event_log`)
- CI guard for deploy order lives in the framework repo (ship-agent PR), not here

**Deferred:** Nothing

## Stack

No changes. Existing: TypeScript / Node.js / DuckDB / esbuild / Vitest / GitHub Actions.

## Adoption Mode

Retrofit (additive schema extension to existing component). All changes are purely additive — no existing enums, `$defs`, or `required` arrays are modified.

## Risks

- R-001: Deploy order — MCP must be deployed before ship-agent merges. If violated, ship-agent emits silently fail (exit 0, ADR-005). Mitigation: deploy immediately after merge, coordinate with framework team.

## Dependencies

- Upstream: none
- Downstream: planifest-ship-agent (framework repo) — blocked until this is deployed
