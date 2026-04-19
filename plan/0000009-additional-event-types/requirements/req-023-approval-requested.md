---
title: "Requirement: REQ-023 - approval_requested event type"
summary: "New event type for when an agent pauses and requests human sign-off."
status: "active"
version: "0.1.0"
---
# Requirement: REQ-023 — approval_requested event type

**Skill:** change-agent
**Feature:** 0000009-ship-phase-enum
**Priority:** must-have

---

## Context

Agents pause for human approval on destructive operations, schema changes, and other gated actions. Currently these pauses are invisible in telemetry — there is no way to measure human-in-the-loop friction or which action types generate the most approval requests.

Distinct from `spec_gap` (which is a requirements gap during Phase 0 coaching) — `approval_requested` is an in-phase gate where the agent has a confirmed design but cannot proceed without explicit human consent.

---

## Functional Requirements

- The schema accepts `event: "approval_requested"` with an `ApprovalRequestedData` payload.
- `ApprovalRequestedData` requires:
  - `phase_name` (string, minLength: 1) — phase active at time of request
  - `subject` (string, minLength: 1) — what approval is being requested for (e.g. `"destructive migration: drop column users.legacy_token"`)
  - `action_id` (string, minLength: 1) — identifier for the gated action
- `additionalProperties: false` on `ApprovalRequestedData`.
- TypeScript interface `ApprovalRequestedData` added to `src/types/events.ts`.
- `EVENT_REQUIRED_DATA_FIELDS` maps `approval_requested` → `['phase_name', 'subject', 'action_id']`.

---

## Acceptance Criteria

- [ ] `POST /emit` with `event: "approval_requested"`, `data: { phase_name: "codegen", subject: "drop column", action_id: "mig-003" }` returns `ok: true`.
- [ ] Missing any required field returns `ok: false`.
- [ ] Unit test covers valid and invalid payloads.
