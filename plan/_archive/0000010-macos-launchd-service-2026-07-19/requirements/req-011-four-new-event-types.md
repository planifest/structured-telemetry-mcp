---
title: "Requirement: req-011 - Four Missing Event Types (loop_iteration, phase_reversal_*)"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-011 - Four Missing Event Types (loop_iteration, phase_reversal_*)

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000010-macos-launchd-service
**Source:** US-011
**Priority:** must-have

---

## User Story

As `planifest-loop-runner`/reversal-protocol code (framework feature 0000016), I can emit `loop_iteration`, `phase_reversal_petitioned`, `phase_reversal_granted`, `phase_reversal_denied` and have them accepted — these four types are live in the framework but missing from this repo's deployed schema.

---

## Functional Requirements
- Add `loop_iteration`, `phase_reversal_petitioned`, `phase_reversal_granted`, `phase_reversal_denied` to the `event` enum in `schemas/telemetry-event.schema.json`.
- Add four `$defs` entries matching the field shapes below exactly (`phase_reversal_granted` and `phase_reversal_denied` may share one `$def` or stay separate — either is acceptable):
  - `LoopIterationData`: `loop_id` (enum: `p0_completeness`, `design_critic`, `reversal_protocol`, `verify_by_execution`, `cross_model_review`), `iteration` (number), `cap` (number), `decision` (enum: `continue`, `done`, `escalate`), `toggle_level` (enum: `report-only`, `on`)
  - `PhaseReversalPetitionedData`: `report` (string), `filing_phase` (string), `binding_artifact` (string)
  - `PhaseReversalGrantedData` / `PhaseReversalDeniedData`: `report` (string), `classification` (enum: `additive`, `altering`), `cascade_size` (number), `budget_remaining` (number)
- Add each to the top-level `data.anyOf` array — this schema uses `anyOf` (not `oneOf`), per the existing April 2026 precedent (`context_reset`/`phase_skip` structural conflict) — do not reintroduce `oneOf`.
- Add all four to `EVENT_REQUIRED_DATA_FIELDS` in `src/validation/validate-event.ts` with the required-field lists above.
- This is additive-only — new enum values and `$defs` — no migration file required, per the existing Schema Migration Policy.
- Do not add `ratchet_blocked` — recommended in the framework's REC-006 but not emitted by any skill today; speculative scope, explicitly out (see `plan/current/scope.md`).

## Acceptance Criteria
- [ ] `tests/regression/enum-validation.test.ts` and `tests/regression/event-types.test.ts` cover all four new types alongside every existing type (accept valid, reject missing required fields, reject unknown extra fields per `additionalProperties: false`)
- [ ] `tests/regression/cross-field-validation.test.ts` has missing-required-field rejection cases for all four new types
- [ ] `tests/integration/emit-event.test.ts` asserts a minimally-valid envelope for all 25 event types (21 existing + 4 new) round-trips through the real MCP tool handler
- [ ] Full existing test suite passes with no regressions; new total test count recorded (baseline: 289 tests as of the April 2026 commit)

## Dependencies
- req-009 (Zod tool schema) — the Zod `event` enum must be extended in the same change or it will itself reject these valid types.
