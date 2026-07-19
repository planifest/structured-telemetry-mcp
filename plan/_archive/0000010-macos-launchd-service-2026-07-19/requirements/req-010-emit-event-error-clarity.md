---
title: "Requirement: req-010 - Clear Rejection Errors for Malformed emit_event Calls"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-010 - Clear Rejection Errors for Malformed emit_event Calls

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000010-macos-launchd-service
**Source:** US-010
**Priority:** must-have

---

## User Story

As a Planifest agent, a malformed call (stringified/undefined/null/array/double-wrapped envelope) fails with a specific, self-diagnosable Zod error instead of ajv's opaque `"(root): must be object"`.

---

## Functional Requirements
- The six reproduction cases from the RCA spec (§2) are covered as explicit test cases with their expected error shape: (A) correct envelope object — passes; (B) stringified envelope — rejected with a clear "expected object, received string" class error; (C) `undefined` — rejected; (D) double-wrapped `{ event: envelope }` — rejected with a shape mismatch error, distinct from case B/C/E/F; (E) `null` — rejected; (F) array-wrapped — rejected.
- Cases B, C, E, F must now produce a clear, actionable error — not just correctly reject.
- The tool argument name is renamed from `event` to `envelope` (see req-012) so the parameter and the envelope's own `event` discriminator field are no longer confusable — directly addressing case D's root confusion.

## Acceptance Criteria
- [ ] `tests/regression/emit-handler.test.ts` has explicit test cases for all six reproduction scenarios (A–F) with asserted error shapes
- [ ] Cases B, C, E, F produce a self-diagnosable error message (not ajv's generic `"(root): must be object"`)
- [ ] Case D produces a distinct, more specific error than cases B/C/E/F (confirms the two failure modes are distinguishable)

## Dependencies
- req-009 (Zod tool schema) — this requirement's error-clarity behaviour is a direct consequence of req-009's implementation.
