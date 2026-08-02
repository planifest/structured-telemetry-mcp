---
title: "Build Log - {{feature-id}}"
summary: "Working telemetry file maintained by the orchestrator throughout the pipeline run."
---
# Build Log - {{feature-id}}

> Created at P0. Appended by the orchestrator at each phase boundary. Survives session changes.

## Header

| Field | Value |
|-------|-------|
| Feature ID | `{{feature-id}}` |
| Pipeline start | `{{start-timestamp}}` |
| Tool | `{{tool-name}}` |
| Primary model | `{{primary-model-name}}` |
| Cheaper model | `{{cheaper-model-name}}` |

---

## Phase Log

### P0 — Assess & Coach

| Field | Value |
|-------|-------|
| Start | `{{timestamp}}` |
| Model tier | primary / cheaper |
| Skills loaded | planifest-orchestrator |
| Agents spawned | `{{count}}` |
| MCP calls | `{{count}}` |
| Parallel task batches | `{{count}}` |
| Telemetry | emitted / failed-with-recorded-choice / confirmed-disabled |
| Notes | `{{free text or "none"}}` |

---

<!-- Copy and fill in this block at each phase boundary:

### Px — {Phase Name}

| Field | Value |
|-------|-------|
| Start | `{{timestamp}}` |
| Model tier | primary / cheaper |
| Skills loaded | `{{skill names}}` |
| Agents spawned | `{{count}}` |
| MCP calls | `{{count}}` |
| Parallel task batches | `{{count}}` |
| Telemetry | emitted / failed-with-recorded-choice / confirmed-disabled |
| Notes | `{{free text or "none"}}` |

-->

---

## Summary (filled at P7)

| Metric | Value |
|--------|-------|
| Total phases completed | `{{count}}` |
| Total agents spawned | `{{count}}` |
| Total MCP calls | `{{count}}` |
| Phases using parallelism | `{{count}}` |
| Primary tier agent calls | `{{count}}` |
| Cheaper tier agent calls | `{{count}}` |
| Self-corrections | `{{count}}` |
| Phases skipped | `{{list or "none"}}` |
| Phases with a recorded telemetry gap | `{{count — phases where Telemetry was failed-with-recorded-choice, or "0"}}` |
