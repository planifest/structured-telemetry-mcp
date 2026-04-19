---
title: "Requirement: REQ-022 - context_reset event type"
summary: "New event type for agent session compaction or context-limit hit."
status: "active"
version: "0.1.0"
---
# Requirement: REQ-022 — context_reset event type

**Skill:** change-agent
**Feature:** 0000009-ship-phase-enum
**Priority:** must-have

---

## Context

When an agent hits the context window limit or triggers a compaction, the event is currently invisible in telemetry. There is no way to know which phases are burning the most context, how often agents restart mid-phase, or whether context pressure correlates with failure rates. `context_reset` fills this blind spot.

Distinct from `context_pressure` (which measures fill percentage as a warning signal) — `context_reset` is the actual reset event, emitted once it has happened.

---

## Functional Requirements

- The schema accepts `event: "context_reset"` with a `ContextResetData` payload.
- `ContextResetData` requires:
  - `phase_name` (string, minLength: 1) — phase active at time of reset
  - `reason` (string, minLength: 1) — e.g. `"compaction"`, `"context_limit"`, `"manual"`
- `additionalProperties: false` on `ContextResetData`.
- TypeScript interface `ContextResetData` added to `src/types/events.ts`.
- `EVENT_REQUIRED_DATA_FIELDS` in `validate-event.ts` maps `context_reset` → `['phase_name', 'reason']`.

---

## Acceptance Criteria

- [ ] `POST /emit` with `event: "context_reset"`, `data: { phase_name: "codegen", reason: "compaction" }` returns `ok: true`.
- [ ] Missing `reason` field returns `ok: false` with a validation error.
- [ ] Missing `phase_name` field returns `ok: false` with a validation error.
- [ ] Unit test covers valid and invalid payloads.
