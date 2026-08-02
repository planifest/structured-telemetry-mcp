---
title: "Backlog Entry: 00002 - Framework product_id Emission"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
---
# Backlog Entry: 00002 - Framework product_id Emission

**Source feature:** 0000015-telemetry-log-viewer-ui
**Source phase:** P0
**Date filed:** 2026-08-01

---

## Problem

`structured-telemetry-mcp`'s telemetry event schema (`schemas/telemetry-event.schema.json`) is gaining a new optional envelope field, `product_id` (the emitting repo's root path, via `git rev-parse --show-toplevel`, falling back to `cwd`), as part of feature 0000015. This lets the new log-viewer UI distinguish events across the multiple projects that share one telemetry backend ($HOME/.planifest/telemetry.db).

The field is only useful if it's actually populated at emission time. That code lives in `planifest-framework/hooks/telemetry/emit-phase-start.mjs`, `emit-phase-end.mjs`, and `context-pressure.mjs` (all under `planifest-framework/`, a different product from `structured-telemetry-mcp`, with its own independent version/feature sequence — currently mid an unrelated WIP, feature 0000021-framework-context-bloat-audit). Each of these hooks already resolves `cwd` from the hook input (see `emit-phase-start.mjs` lines ~150-160) — the missing piece is just adding a `product_id` field to the outgoing event object, derived the same way.

Agent-driven `emit_event` calls (made inline by phase skills, documented in the orchestrator's "Telemetry" section and the `planifest-orchestrator`/other skill SKILL.md files) would also need to start including `product_id` in the envelopes they construct.

Until this is done, every event emitted going forward will still have `product_id` as null/absent — same as all historical data — and will display as "unknown" in the new UI, same as legacy rows.

## Suggested Action

In a future `planifest-framework` pipeline run: add `product_id` derivation (git root, fallback cwd) to the three telemetry hook scripts and to the orchestrator's/phase skills' inline `emit_event` envelope construction. Small, additive, low-risk — no schema change needed on the framework side since the field already exists in `structured-telemetry-mcp`'s schema by the time this is picked up.

## Why Deferred

Cross-product boundary: `planifest-framework` and `structured-telemetry-mcp` are separate products with independent versioning, even though the framework is vendored into this same repo as build tooling. Editing the framework's hook scripts as part of the telemetry-mcp feature would tangle two unrelated in-flight efforts (the framework's files are currently dirty with uncommitted 0000021 changes to these same hooks). This is the framework product's own pipeline to pick up, on its own schedule.

## Implementation Reference

See [handoff-report.md](handoff-report.md) (2026-08-02) for file-by-file specifics — exact line numbers in the 3 hook scripts, the canonical envelope template location, and a suggested P1 requirements shape. Ready to hand to the framework product's own P0.
