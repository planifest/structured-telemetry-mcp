---
title: "Backlog Entry: 00007 - docs-agent Gate B ignores continuous_run"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
---
# Backlog Entry: 00007 - docs-agent Gate B ignores continuous_run

**Source feature:** 0000017-log-viewer-enhancements
**Source phase:** P6

**Date filed:** 2026-08-03

---

## Problem

The `planifest-docs-agent` skill's "P6 Gate B" step ("assess whether a docs update is needed") hardcodes "Wait for the human to confirm before proceeding" with no reference to `continuous_run`. This is a skill-internal gate, distinct from the orchestrator's own P6 phase-completion STOP (which the Phase Invocation Table correctly gates on `continuous_run`/zero-drift). In a session where the human already explicitly chose continuous run mode at P0 specifically to avoid exactly this kind of per-step confirmation, hitting a docs-agent-internal "confirm?" prompt is redundant friction — the human had to point out "why ask me? we're in continuous and all seem logical" before the orchestrator proceeded.

This is the same class of issue as backlog #00005 (Scope Lock Challenge's per-question sequencing ignoring the human's stated preference) — a phase/sub-agent skill enforcing its own confirmation step without checking the session-level run-mode the human already set.

## Suggested Action

Update the `planifest-docs-agent` skill's Gate B step (and audit other phase skills — spec-agent, adr-agent, codegen-agent, etc. — for the same pattern) to check `plan/.run-mode` / the orchestrator's `continuous_run` flag before stopping for confirmation. When continuous, present the assessment and recommendation as a statement (not a question), log the auto-accepted decision to the build log, and proceed — mirroring how the orchestrator's own Phase Invocation Table STOP/exception logic already works for phase-completion gates.

## Why Deferred

Out of scope for 0000017 (a telemetry-mcp product feature) — this is a change to the `planifest-framework` docs-agent skill's own behavior, which has its own separate pipeline and versioning sequence per this repo's Framework Update Policy. Not blocking this feature; the human's direct in-session answer ("yes but why ask me?") unblocked P6 immediately without waiting for the framework-level fix.
