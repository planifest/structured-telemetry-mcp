---
title: "Requirement: req-012 - emit_event Tool Argument Rename (event -> envelope)"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-012 - emit_event Tool Argument Rename (event -> envelope)

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000010-macos-launchd-service
**Source:** US-012
**Priority:** should-have

---

## User Story

As a developer reading the tool's argument, I no longer confuse the tool parameter `event` with the envelope's own `event` discriminator field (renamed to `envelope`).

---

## Functional Requirements
- Rename the `emit_event` MCP tool's argument from `event` to `envelope`: `server.tool('emit_event', ..., { envelope: EmitEventEnvelope }, createEmitEventHandler(repo))`.
- Update `createEmitEventHandler`'s destructuring to read `envelope` instead of `event`.
- Update the tool's description string to reflect the new argument name and note it must be a JSON object, not a string.
- Update `README.md`'s `emit_event` usage example to the new argument name.
- This is a naming-clarity improvement, not required to fix R-009 itself, but is done in the same pass since it touches the exact same code (per the RCA spec's own recommendation) and case D (double-wrapping confusion) shows the collision is a real risk worth closing.

## Acceptance Criteria
- [ ] `emit_event({ envelope: {...} })` is the only accepted call shape; the old `{ event: {...} }` top-level argument name is no longer valid (this is the intentional breaking change reflected in the 0.10.0 version bump)
- [ ] `README.md`'s `### emit_event` tool section shows a complete, correctly-shaped example call using `envelope`
- [ ] No remaining reference to the old `{ event: ... }` argument shape anywhere in `README.md` or `docs/usage-guide.md`

## Dependencies
- req-009 (Zod tool schema) — implemented together in the same `server-factory.ts` change.
