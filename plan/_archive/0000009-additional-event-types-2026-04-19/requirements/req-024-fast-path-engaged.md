---
title: "Requirement: REQ-024 - fast_path_engaged event type"
summary: "New event type emitted by the orchestrator when it routes to fast path instead of the full pipeline."
status: "active"
version: "0.1.0"
---
# Requirement: REQ-024 — fast_path_engaged event type

**Skill:** change-agent
**Feature:** 0000009-ship-phase-enum
**Priority:** must-have

---

## Context

The orchestrator has two routes: full pipeline (Phases 0–7) and fast path (direct fix → validate → changelog). Fast-path engagement is currently invisible in telemetry. Over time, the ratio of fast-path to full-pipeline runs is a useful signal for understanding feature complexity distribution and whether the fast-path criteria are being applied correctly.

---

## Functional Requirements

- The schema accepts `event: "fast_path_engaged"` with a `FastPathEngagedData` payload.
- `FastPathEngagedData` requires:
  - `change_type` (string, minLength: 1) — category of the fast-path change (e.g. `"bug-fix"`, `"styling"`, `"copy"`, `"dependency-bump"`)
  - `reason` (string, minLength: 1) — brief rationale for fast-path routing
- `additionalProperties: false` on `FastPathEngagedData`.
- TypeScript interface `FastPathEngagedData` added to `src/types/events.ts`.
- `EVENT_REQUIRED_DATA_FIELDS` maps `fast_path_engaged` → `['change_type', 'reason']`.

---

## Acceptance Criteria

- [ ] `POST /emit` with `event: "fast_path_engaged"`, `data: { change_type: "bug-fix", reason: "isolated pure-function fix, no schema or dep changes" }` returns `ok: true`.
- [ ] Missing either required field returns `ok: false`.
- [ ] Unit test covers valid and invalid payloads.
