---
title: "Requirement: req-009 - emit_event Tool Argument Object Schema"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-009 - emit_event Tool Argument Object Schema

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000010-macos-launchd-service
**Source:** US-009
**Priority:** must-have

---

## User Story

As a Planifest agent calling `emit_event`, I get a real object-shaped tool schema (not `z.unknown()`), so a tool-calling model has a structural scaffold instead of guessing and serializing the envelope to a string.

---

## Functional Requirements
- Replace `z.unknown()` in `src/server-factory.ts`'s `emit_event` tool registration with an `EmitEventEnvelope` Zod object mirroring `schemas/telemetry-event.schema.json`'s top-level shape: `schema_version` (literal `"1.0"`), `event` (enum of all 25 types — see req-011), `session_id`, `initiative_id` (optional), `phase` (enum), `agent`, `tool`, `model`, `mcp_mode` (enum), `timestamp`, `model_config` (optional record), `data` (record) — `.strict()`.
- `zodToJsonSchema` (or equivalent introspection of the registered tool) on the new argument produces `type: "object"` with `properties` covering every envelope field — this is what an MCP-aware client renders to the calling model.
- Zod rejects a wrong shape before `validateEvent()`/ajv ever runs, giving a clearer error than ajv's opaque root-level message. `validateEvent()`/ajv remains the source of truth for cross-field rules — Zod is an argument-shape gate, not a replacement.
- Do not silently `JSON.parse()` a string argument as a fallback — this would mask the real client-side bug and let malformed shapes slip through unnoticed.

## Acceptance Criteria
- [ ] `tests/unit/server-factory.test.ts` asserts the registered `emit_event` argument schema produces `type: "object"` with `properties` including every envelope field — this is the regression guard against reverting to `z.unknown()`
- [ ] A minimally-valid envelope for all 25 event types (21 existing + 4 from req-011) round-trips successfully through the real MCP tool handler in an integration test
- [ ] `EVENT_REQUIRED_DATA_FIELDS`, the schema `$defs`, the schema `event` enum, and this Zod schema's `event` enum are in sync for all 25 types — no drift between them

## Dependencies
- req-011 (four new event types) — the Zod `event` enum must include all 25 types, landed in the same change.
- req-012 (argument rename) — implemented together with this schema replacement.
