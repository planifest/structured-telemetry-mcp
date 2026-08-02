---
title: "Backlog Entry: 00005 - Scope Lock Challenge should default to drafted answers"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
---
# Backlog Entry: 00005 - Scope Lock Challenge should default to drafted answers

**Source feature:** 0000017-log-viewer-enhancements
**Source phase:** P0

**Date filed:** 2026-08-02

---

## Problem

The `planifest-orchestrator` skill's Scope Lock Challenge protocol (ADR-003) defaults to **never** pre-drafting a suggested answer to any of the four scenario-path questions (happy / first-run / error / cross-session) — it only asks the bare open question, offering a suggestion only if the human explicitly opts in per-question ("Want me to suggest an answer first? yes/no").

During this session's P0 coaching, the human's expectation was the opposite: they want the orchestrator to **always** draft all four answers up front (via the fresh-context `planifest-scope-lock-agent` subagent, per the existing drafting mechanism) and present them for the human to accept/edit/reject — never make them answer from a blank prompt. The human called the current opt-in-only default "a bug."

A second, related request surfaced in the same session: present all four drafted answers **together in one batch**, not one-at-a-time waiting for a per-question response before drafting/showing the next. The current protocol's "ask each of these four questions one at a time, waiting for a human answer before asking the next" sequencing was itself the friction — the human wants to review all four drafts in a single pass and give accept/edit/reject per item within that one review, not four separate round-trips.

This is a friction point in the orchestrator's own coaching UX, not a defect in the telemetry-mcp product — filed here per the human's explicit request, since there's no other established location for orchestrator/framework behavior feedback in this repo.

## Suggested Action

Revisit ADR-003 in the `planifest-orchestrator` skill (or its parent framework repo): consider making "draft all four answers up front via `planifest-scope-lock-agent` (dispatched in parallel, one subagent per item per the skill's existing one-item-at-a-time constraint), then present all four together for a single batch accept/edit/reject pass" the default behavior instead of the current opt-in-per-question, one-at-a-time-sequencing default — possibly gated by a toggle (consistent with the framework's existing toggle pattern for `p0_completeness`, `design_critic`, etc.) so teams that prefer the current blank-prompt, sequential style can keep it. Scope and exact mechanism to be decided at pickup — this entry is a discovered friction point, not a spec.

## Why Deferred

Out of scope for 0000017 (a telemetry-mcp product feature) — this is a change to the `planifest-framework` orchestrator skill's own behavior/ADR, which has its own separate pipeline and versioning sequence per this repo's Framework Update Policy. Not blocking this feature; for this session the human's explicit in-session request (draft all four now) is honored directly without waiting for the framework-level fix.
