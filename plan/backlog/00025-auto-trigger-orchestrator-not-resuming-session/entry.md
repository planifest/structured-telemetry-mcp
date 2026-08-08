---
title: "Backlog Entry: 00025 - auto-trigger-orchestrator hook never re-fires for later sessions on an in-flight feature"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "medium"
---
# Backlog Entry: 00025 - auto-trigger-orchestrator hook never re-fires for later sessions on an in-flight feature

**Source feature:** 0000018-telemetry-data-integrity
**Source phase:** session resume, post-P0 (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

`.claude/hooks/enforcement/auto-trigger-orchestrator.mjs` (ADR-003, REQ-002) fires on every
`UserPromptSubmit` and emits the load-orchestrator instruction only when two conditions hold:
`planifest-framework/` exists, and `plan/.orchestrator-active` does **not** exist. The second check
treats the sentinel file's mere presence as proof "the orchestrator is already loaded" — but the file
is written once, when the orchestrator first activates for a feature, and persists across that
feature's entire multi-session lifecycle until archived at P7. It is a per-feature durable marker, not
a per-session one.

A brand-new Claude Code session that resumes an in-flight feature (P0 already gated in a prior session,
`plan/.orchestrator-active` still present from that prior activation) therefore gets zero
auto-trigger instructions, even though the orchestrator skill has never been loaded into *this*
session's context. That is exactly what happened here: this session ran `/planifest-refresh-setup`,
several follow-up prompts, and a "what's next?" question — all answered without the orchestrator ever
being engaged — until the human noticed no P1 work was happening and asked why.

## Suggested Action

Separate the two states the hook currently conflates:

- **Feature-level "orchestrator active"** — correctly the durable, cross-session
  `plan/.orchestrator-active` marker.
- **Session-level "orchestrator loaded this session"** — needs its own signal, since Claude Code
  sessions don't retain live skill-load state across a new invocation.

Options to distinguish them: have the hook additionally compare against a session identifier (a
`plan/.orchestrator-session-loaded-{sessionId}` touch-file, or similar), or have the orchestrator
skill's own resume-detection logic double as the check the hook currently tries to shortcut. The doc
comment on the hook notes a "CLAUDE.md fallback" exists for tools without `UserPromptSubmit` support
(Cursor, Windsurf, etc.) — Claude Code is expected to rely solely on the hook, so the fix belongs in
the hook's re-fire condition, not in relying on the fallback text.

## Why Deferred

This is a bug in `planifest-framework`'s own enforcement hook (ADR-003), not in product feature
0000018 — per this repo's Framework Update Policy it belongs to the framework's own pipeline and
versioning sequence, not this feature's. Not blocking 0000018: the human caught the gap manually this
session and directed an explicit resume. File and defer; fix on the framework's own track.
