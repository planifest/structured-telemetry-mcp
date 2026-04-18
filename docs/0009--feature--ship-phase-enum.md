# Feature: 0000009 — Ship Phase Enum + 7 New Event Types

**Version:** 0.3.0
**Date:** 2026-04-18
**Branch:** feat/additional-event-types

---

## What Changed

### Phase enum extended (REQ-021)

`"ship"` added to the `phase` enum in `schemas/telemetry-event.schema.json` and the `Phase` union type in `src/types/events.ts`. Required before `planifest-ship-agent` (Phase 7) can be merged in the framework repo — the ship-agent emits `phase_start` / `phase_end` with `"phase": "ship"`.

`"change"` retained — no regression for change-agent telemetry.

### 7 new event types (REQ-022–028)

| Event type | Required data fields | Optional | Emitted by |
|---|---|---|---|
| `context_reset` | `phase_name`, `reason` | — | Any agent on session compaction or context-limit hit |
| `approval_requested` | `phase_name`, `subject`, `action_id` | — | Any agent pausing for human sign-off |
| `fast_path_engaged` | `change_type`, `reason` | — | Orchestrator when routing to fast path |
| `test_failure` | `test_name`, `phase_name`, `attempt_number` | `error_summary` | Validate-agent on named test case failure |
| `performance_regression` | `metric`, `threshold`, `actual`, `phase_name` | — | Validate-agent when NFR target is breached |
| `dependency_blocked` | `phase_name`, `dependency`, `reason` | — | Any agent blocked on upstream dependency |
| `schema_migration_applied` | `component_id`, `migration_path`, `destructive` | — | Any agent after executing an approved migration |

### Schema: `oneOf` → `anyOf` (tech debt resolution)

`data.oneOf` changed to `data.anyOf`. `ContextResetData` and `PhaseSkipData` share an identical structure (`{ phase_name, reason }`), making `oneOf` (exactly one branch must match) incorrect. `anyOf` is semantically correct here — event type discrimination is handled by cross-field validation in `src/validation/validate-event.ts` (`EVENT_REQUIRED_DATA_FIELDS` map), not by the JSON Schema `data` branch. See component.yml tech debt entry.

---

## Files Changed

| File | Change |
|---|---|
| `schemas/telemetry-event.schema.json` | `"ship"` → phase enum; 7 new event enum values; 7 new `$defs`; `oneOf` → `anyOf` |
| `src/types/events.ts` | `'ship'` → `Phase`; 7 new interfaces; 7 entries added to `EventData` union |
| `src/validation/validate-event.ts` | 7 new entries in `EVENT_REQUIRED_DATA_FIELDS` |
| `tests/unit/validation.test.ts` | REQ-021–028 test cases (valid + invalid) |
| `tests/unit/server-factory.test.ts` | `context_reset` through handler pipeline |
| `tests/integration/emit-event.test.ts` | All 21 event types in storage test |
| `src/structured-telemetry-mcp/component.yml` | `0.2.0` → `0.3.0`; counts updated |
| `tests/regression/` | 6 focused regression files, 78 tests |

---

## Full Event Type Reference (22 types as of 0.3.0)

| Event type | Required data fields |
|---|---|
| `phase_start` | `phase_name` |
| `phase_end` | `phase_name`, `status`, `duration_ms` |
| `spec_gap` | `question`, `phase_name` |
| `validation_failure` | `failure_type`, `phase_name`, `attempt_number`, `action_id` |
| `deviation` | `component_id`, `description`, `severity` |
| `migration_proposal` | `component_id`, `proposal_path`, `destructive` |
| `context_pressure` | `context_fill_pct`, `unused_sources`, `trigger` |
| `mcp_impact` | `mcp_mode`, `avg_token_delta`, `peak_fill_pct` |
| `self_correction` | `phase_name`, `attempt_number`, `action_id`, `correction_type` |
| `phase_skip` | `phase_name`, `reason` |
| `security_finding` | `component_id`, `title`, `severity` |
| `retry_limit_exceeded` | `phase_name`, `action_id`, `attempt_count` |
| `adr_decision` | `adr_id`, `title`, `chosen_option` |
| `doc_gap` | `component_id`, `description` |
| `context_reset` | `phase_name`, `reason` |
| `approval_requested` | `phase_name`, `subject`, `action_id` |
| `fast_path_engaged` | `change_type`, `reason` |
| `test_failure` | `test_name`, `phase_name`, `attempt_number` |
| `performance_regression` | `metric`, `threshold`, `actual`, `phase_name` |
| `dependency_blocked` | `phase_name`, `dependency`, `reason` |
| `schema_migration_applied` | `component_id`, `migration_path`, `destructive` |

Phase enum (9 values): `orchestrator`, `spec`, `adr`, `codegen`, `validate`, `security`, `docs`, `change`, `ship`
