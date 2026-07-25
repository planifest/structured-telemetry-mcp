---
title: "Requirement: REQ-021 - phase enum gains 'ship'"
summary: "Add 'ship' to the phase enum in schema and TypeScript types, coordinated with ship-agent deployment."
status: "active"
version: "0.1.0"
---
# Requirement: REQ-021 — phase enum gains 'ship'

**Skill:** change-agent
**Feature:** 0000009-ship-phase-enum
**Source:** plan/current/from-framework/req-021-mcp-ship-enum.md
**Priority:** must-have

---

## Context

The `planifest-ship-agent` (Phase 7) emits `phase_start` and `phase_end` events with `"phase": "ship"`. The current `phase` enum in `schemas/telemetry-event.schema.json` contains 8 values (`orchestrator`, `spec`, `adr`, `codegen`, `validate`, `security`, `docs`, `change`) — `"ship"` is absent. The TypeScript `Phase` union in `src/types/events.ts` mirrors this gap.

No new event types are introduced. Ship-agent reuses the existing `phase_start` / `phase_end` event types with the new phase value.

---

## Functional Requirements

- `"ship"` is added to the `phase` enum in `schemas/telemetry-event.schema.json`.
- `"change"` is retained — no regression for change-agent telemetry.
- `'ship'` is added to the `Phase` union type in `src/types/events.ts`.
- The JSON Schema `schema_version` remains `"1.0"` — this is an additive, non-breaking change.
- The MCP server update is deployed before `planifest-ship-agent/SKILL.md` is merged in the framework repo.
- **Functional impact if deploy order is violated:** ship-agent hook scripts exit 0 on schema rejection — telemetry gap only, ship-agent execution is never blocked (ADR-005).

---

## Acceptance Criteria

- [ ] `POST /emit` with `{ "phase": "ship", "event": "phase_start", ... }` returns `{ "ok": true }`.
- [ ] `POST /emit` with `{ "phase": "change", ... }` continues to return `{ "ok": true }` (regression).
- [ ] `validateEvent` unit test accepts a valid event with `phase: "ship"`.
- [ ] `validateEvent` unit test confirms `phase: "change"` still passes.
- [ ] TypeScript compiles without error after `Phase` type addition.

---

## Implementation

### `schemas/telemetry-event.schema.json`

In the `phase` property `enum` array, add `"ship"` after `"change"`:

```json
"enum": [
  "orchestrator", "spec", "adr", "codegen",
  "validate", "security", "docs", "change", "ship"
]
```

### `src/types/events.ts`

In the `Phase` union type, add `'ship'`:

```typescript
export type Phase =
  | 'orchestrator'
  | 'spec'
  | 'adr'
  | 'codegen'
  | 'validate'
  | 'security'
  | 'docs'
  | 'change'
  | 'ship';
```

---

## Dependencies

- Downstream: planifest-ship-agent (framework repo) — must not merge before this is deployed
