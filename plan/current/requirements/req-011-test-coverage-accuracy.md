---
title: "Requirement: req-011 - Documentation matches what the suite exercises"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-011 - Documentation matches what the suite exercises

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Source:** US-011
**Priority:** must-have

## User Story

As a maintainer, I want `test-coverage.md` to match what the suite exercises, so that the document is not a false assurance.

## Why this is a requirement and not a docs chore

The suite is green and the *counts* in `test-coverage.md` are accurate. The defect is narrower and worse: a security guarantee is asserted that no test provides. A reader — including a future agent planning work against this component — takes the claim at face value and skips the check. That is the failure this whole release exists to correct, so correcting the document is in scope, not a tidy-up.

## Functional Requirements

- Once req-009 and req-010 land, update `src/structured-telemetry-mcp/docs/test-coverage.md` so every security claim names the test that backs it.
- The claim at `:38` — *"non-allow-listed/injection-shaped input rejected"* — is either backed by req-009's tests or reworded to state what is actually covered. It must not survive unchanged and unbacked.
- Import `SORTABLE_FIELDS` and `SUGGESTIBLE_FIELDS` into `tests/unit/ui.test.ts` and assert the rendered template matches them, replacing the hand-restated literal list at `:256` (`['timestamp','event','session_id','phase','agent','product_id']`).
  - This closes a real drift risk, not just a style point: `docs/quirks.md` already records that `index-html.ts` hand-mirrors these constants because ADR-018 leaves no runtime import mechanism. The test restating them a *third* time means a backend allow-list change can pass CI while the frontend and the test both silently disagree with the source.
- Update the test counts to their post-feature values.
- Audit the remaining security claims in the document for the same class of defect and fix any others found. Report them rather than silently expanding scope if the count is large.

## Acceptance Criteria

- [ ] Every security claim in `test-coverage.md` names a specific test file that exercises it
- [ ] The `:38` injection claim is backed by req-009's tests, or reworded to match reality
- [ ] `tests/unit/ui.test.ts` imports `SORTABLE_FIELDS` and `SUGGESTIBLE_FIELDS` rather than restating the literals
- [ ] Changing `SORTABLE_FIELDS` in `src/query/column-allow-list.ts` without updating the UI template makes `ui.test.ts` fail
- [ ] Test counts match the actual post-feature suite
- [ ] No claim remains that the suite does not exercise

## Dependencies

- req-009 and req-010 must land first — this requirement documents them, so it cannot be completed before they exist.
- ADR-018 and `docs/quirks.md` explain why the constants are mirrored rather than imported at runtime; the test-side import does not change that constraint, it just stops the test from being a third independent copy.
