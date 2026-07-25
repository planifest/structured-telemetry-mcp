---
title: "Requirement: REQ-027 - dependency_blocked event type"
summary: "New event type for when an agent cannot proceed because an upstream dependency is not ready."
status: "active"
version: "0.1.0"
---
# Requirement: REQ-027 — dependency_blocked event type

**Skill:** change-agent
**Feature:** 0000009-ship-phase-enum
**Priority:** must-have

---

## Context

Agents sometimes cannot proceed because an upstream dependency is not ready — a human task is incomplete, an external service is unavailable, or a parallel pipeline phase has not yet produced its output. These blocks are currently invisible in telemetry. `dependency_blocked` makes them observable, enabling measurement of pipeline wait times and identification of chronic bottlenecks.

---

## Functional Requirements

- The schema accepts `event: "dependency_blocked"` with a `DependencyBlockedData` payload.
- `DependencyBlockedData` requires:
  - `phase_name` (string, minLength: 1) — phase that is blocked
  - `dependency` (string, minLength: 1) — name or description of the unmet dependency (e.g. `"human: approve migration proposal"`, `"upstream: auth-service API spec"`)
  - `reason` (string, minLength: 1) — why the agent cannot proceed without it
- `additionalProperties: false` on `DependencyBlockedData`.
- TypeScript interface `DependencyBlockedData` added to `src/types/events.ts`.
- `EVENT_REQUIRED_DATA_FIELDS` maps `dependency_blocked` → `['phase_name', 'dependency', 'reason']`.

---

## Acceptance Criteria

- [ ] `POST /emit` with `event: "dependency_blocked"`, `data: { phase_name: "codegen", dependency: "human: approve migration proposal", reason: "destructive operation requires explicit consent" }` returns `ok: true`.
- [ ] Missing any required field returns `ok: false`.
- [ ] Unit test covers valid and invalid payloads.
