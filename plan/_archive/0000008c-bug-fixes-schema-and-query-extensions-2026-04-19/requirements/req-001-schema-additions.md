---
title: "Requirement: req-001 - Schema Additions (SCH-001–005)"
summary: "Add five new event types to the telemetry event schema."
status: "active"
version: "0.1.0"
---
# Requirement: req-001 - Schema Additions

**Skill:** spec-agent
**Feature:** 0000008c-mcp-fixes-and-enhancements
**Source:** Feature Brief SCH-001–005; docs/0008c--feature--structured-telemetry-mcp-changes.md §1
**Priority:** must-have

---

## Context

The current schema (`schemas/telemetry-event.schema.json`) defines 9 event types. Five event types required by framework skills are absent. Skills currently force these events into semantically incorrect types (e.g. `security_finding` forced into `deviation`). Each addition requires: (1) new value in the `event` enum, (2) new `$defs` entry, (3) new `$ref` in `data.oneOf`.

All additions are purely additive — no existing `$defs`, `required` arrays, or `oneOf` entries are modified.

---

## Functional Requirements

### SCH-001 — `phase_skip`
- The schema MUST accept `event: "phase_skip"` with `data: { phase_name, reason }`.
- `phase_name` and `reason` are both required strings with `minLength: 1`.
- `additionalProperties: false` on `PhaseSkipData`.
- Emitted by: `planifest-orchestrator` when a pipeline phase is bypassed.

### SCH-002 — `security_finding`
- The schema MUST accept `event: "security_finding"` with `data: { component_id, title, severity, cwe? }`.
- `component_id`, `title`, `severity` are required. `cwe` is optional.
- `severity` MUST be one of `"low" | "medium" | "high" | "critical"`.
- `additionalProperties: false` on `SecurityFindingData`.
- Emitted by: `planifest-security-agent`.

### SCH-003 — `retry_limit_exceeded`
- The schema MUST accept `event: "retry_limit_exceeded"` with `data: { phase_name, action_id, attempt_count }`.
- All three fields required. `attempt_count` is an integer with `minimum: 1`.
- `additionalProperties: false` on `RetryLimitExceededData`.
- Emitted by: `planifest-validate-agent` (and potentially others) at the 5-attempt escalation ceiling.

### SCH-004 — `adr_decision`
- The schema MUST accept `event: "adr_decision"` with `data: { adr_id, title, chosen_option }`.
- All three fields required strings with `minLength: 1`.
- `additionalProperties: false` on `AdrDecisionData`.
- Emitted by: `planifest-adr-agent` after an ADR is written.

### SCH-005 — `doc_gap`
- The schema MUST accept `event: "doc_gap"` with `data: { component_id, description }`.
- Both fields required strings with `minLength: 1`.
- `additionalProperties: false` on `DocGapData`.
- Emitted by: `planifest-docs-agent` when documentation is missing or incomplete.

---

## Acceptance Criteria

- [ ] `emit_event` with `event: "phase_skip"` and valid `data` returns success
- [ ] `emit_event` with `event: "phase_skip"` and missing `phase_name` returns validation error
- [ ] `emit_event` with `event: "phase_skip"` and missing `reason` returns validation error
- [ ] `emit_event` with `event: "phase_skip"` and extra property returns validation error
- [ ] `emit_event` with `event: "security_finding"` and valid `data` (with `cwe`) returns success
- [ ] `emit_event` with `event: "security_finding"` and valid `data` (without `cwe`) returns success
- [ ] `emit_event` with `event: "security_finding"` and missing `component_id` returns validation error
- [ ] `emit_event` with `event: "security_finding"` and missing `title` returns validation error
- [ ] `emit_event` with `event: "security_finding"` and missing `severity` returns validation error
- [ ] `emit_event` with `event: "security_finding"` and `severity: "critical"` returns success (new enum value)
- [ ] `emit_event` with `event: "security_finding"` and `severity: "invalid"` returns validation error
- [ ] `emit_event` with `event: "retry_limit_exceeded"` and valid `data` returns success
- [ ] `emit_event` with `event: "retry_limit_exceeded"` and missing `phase_name` returns validation error
- [ ] `emit_event` with `event: "retry_limit_exceeded"` and missing `action_id` returns validation error
- [ ] `emit_event` with `event: "retry_limit_exceeded"` and missing `attempt_count` returns validation error
- [ ] `emit_event` with `event: "retry_limit_exceeded"` and `attempt_count: 0` returns validation error
- [ ] `emit_event` with `event: "adr_decision"` and valid `data` returns success
- [ ] `emit_event` with `event: "adr_decision"` and missing `adr_id` returns validation error
- [ ] `emit_event` with `event: "adr_decision"` and missing `title` returns validation error
- [ ] `emit_event` with `event: "adr_decision"` and missing `chosen_option` returns validation error
- [ ] `emit_event` with `event: "doc_gap"` and valid `data` returns success
- [ ] `emit_event` with `event: "doc_gap"` and missing `component_id` returns validation error
- [ ] `emit_event` with `event: "doc_gap"` and missing `description` returns validation error

---

## Dependencies

- `schemas/telemetry-event.schema.json` — target file
- `src/validation/validate-event.ts` — reads the schema; verify AJV recompilation picks up additions
- `src/types/events.ts` — TypeScript union type for `TelemetryEvent` must be updated to include the 5 new event type discriminants
- `tests/unit/validation.test.ts` — add test cases for all 23 criteria above
