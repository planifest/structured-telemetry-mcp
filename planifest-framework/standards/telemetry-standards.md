---
title: "Telemetry Standards"
version: "1.0.0"
---
# Telemetry Standards

Shared telemetry rules for all Planifest skills that emit events via `emit_event`.

---

## Emission Gate

**Emission is mandatory when both conditions are met. If either condition fails, skip silently — do not emit.**

1. `emit_event` tool is present in this session.
2. `.claude/telemetry-enabled` exists in the project root.

---

## phase_start and phase_end Ownership

`phase_start` and `phase_end` are emitted by the **orchestrator**, not phase skills. The orchestrator emits `phase_start` before invoking a skill and `phase_end` after it completes. Phase skills must not emit these events themselves.

---

## Event Envelope

Every `emit_event` call must use this envelope. The `data` field carries event-specific payload (defined per-skill).

```json
{
  "schema_version": "1.0",
  "event": "<event_name>",
  "agent": "<skill-name e.g. planifest-validate-agent>",
  "phase": "<phase e.g. validate>",
  "tool": "<tool e.g. claude-code>",
  "model": "<active model id>",
  "mcp_mode": "none | workspace | context | workspace+context",
  "session_id": "<session id>",
  "timestamp": "<ISO 8601 UTC>",
  "data": { }
}
```

The snippets in each skill's `## Telemetry` section show the `data` field content only — the full envelope above always wraps it.

---

## Loop and Reversal Events (feature 0000016)

Emitted by looping agents per `planifest-loop-runner`. Loop events are async and non-blocking — an emission failure is logged once and never stops a loop. `data` payloads:

**`loop_iteration`** — after every loop iteration's RECORD step:
```json
{ "loop_id": "<p0_completeness | design_critic | reversal_protocol | verify_by_execution | cross_model_review>", "iteration": 1, "cap": 3, "decision": "continue | done | escalate", "toggle_level": "report-only | on" }
```

**`phase_reversal_petitioned`** — when a defect report is filed:
```json
{ "report": "<seq>-<slug>", "filing_phase": "<P3–P6>", "binding_artifact": "<path>" }
```

**`phase_reversal_granted`** / **`phase_reversal_denied`** — on the assessor's verdict:
```json
{ "report": "<seq>-<slug>", "classification": "additive | altering", "cascade_size": 2, "budget_remaining": 1 }
```

P8 build assessment queries these to report per-loop iteration counts, reversal outcomes, and attempted-weakening surfacing.
