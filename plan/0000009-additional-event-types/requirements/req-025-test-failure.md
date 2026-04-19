---
title: "Requirement: REQ-025 - test_failure event type"
summary: "New event type for a specific named test case failing during the validate phase."
status: "active"
version: "0.1.0"
---
# Requirement: REQ-025 — test_failure event type

**Skill:** change-agent
**Feature:** 0000009-ship-phase-enum
**Priority:** must-have

---

## Context

`validation_failure` covers framework-gate failures (retry limits, action IDs, structured attempt tracking). It does not carry the name of a specific failing test case. The validate-agent runs a test suite; individual test failures are currently unattributable in telemetry — you can see that validation failed but not which test caused it.

`test_failure` provides named test attribution, enabling failure clustering by test name across sessions and features.

---

## Functional Requirements

- The schema accepts `event: "test_failure"` with a `TestFailureData` payload.
- `TestFailureData` requires:
  - `test_name` (string, minLength: 1) — fully qualified test name or description
  - `phase_name` (string, minLength: 1) — phase active when the test ran
  - `attempt_number` (integer, minimum: 1) — which attempt this failure occurred on
- `TestFailureData` optionally accepts:
  - `error_summary` (string) — brief error message or assertion failure text
- `additionalProperties: false` on `TestFailureData`.
- TypeScript interface `TestFailureData` added to `src/types/events.ts`.
- `EVENT_REQUIRED_DATA_FIELDS` maps `test_failure` → `['test_name', 'phase_name', 'attempt_number']`.

---

## Acceptance Criteria

- [ ] `POST /emit` with `event: "test_failure"`, `data: { test_name: "should return 404 for unknown id", phase_name: "validate", attempt_number: 1 }` returns `ok: true`.
- [ ] Optional `error_summary` field accepted when present.
- [ ] Missing any required field returns `ok: false`.
- [ ] Unit test covers valid payload with and without `error_summary`, and invalid payloads.
