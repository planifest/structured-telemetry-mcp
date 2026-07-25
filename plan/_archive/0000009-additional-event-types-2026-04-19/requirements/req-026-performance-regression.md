---
title: "Requirement: REQ-026 - performance_regression event type"
summary: "New event type for when a measured metric exceeds its NFR target during validate phase."
status: "active"
version: "0.1.0"
---
# Requirement: REQ-026 — performance_regression event type

**Skill:** change-agent
**Feature:** 0000009-ship-phase-enum
**Priority:** must-have

---

## Context

NFR targets (latency, bundle size, memory) are declared in the execution plan. When the validate-agent measures a metric that exceeds its target, this is currently captured only as a `validation_failure` with no structured data about which metric failed or by how much. `performance_regression` provides structured, queryable data for performance trend analysis across features and sessions.

---

## Functional Requirements

- The schema accepts `event: "performance_regression"` with a `PerformanceRegressionData` payload.
- `PerformanceRegressionData` requires:
  - `metric` (string, minLength: 1) — metric name (e.g. `"p95_latency_ms"`, `"bundle_size_bytes"`, `"memory_mb"`)
  - `threshold` (number) — the NFR target value
  - `actual` (number) — the measured value that exceeded the threshold
  - `phase_name` (string, minLength: 1) — phase active when measurement was taken
- `additionalProperties: false` on `PerformanceRegressionData`.
- TypeScript interface `PerformanceRegressionData` added to `src/types/events.ts`.
- `EVENT_REQUIRED_DATA_FIELDS` maps `performance_regression` → `['metric', 'threshold', 'actual', 'phase_name']`.

---

## Acceptance Criteria

- [ ] `POST /emit` with `event: "performance_regression"`, `data: { metric: "p95_latency_ms", threshold: 50, actual: 73.4, phase_name: "validate" }` returns `ok: true`.
- [ ] Missing any required field returns `ok: false`.
- [ ] Unit test covers valid and invalid payloads.
