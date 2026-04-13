---
title: "Requirement: REQ-001 - emit-event"
summary: "MCP tool that ingests a validated telemetry event into DuckDB."
status: "active"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
stories: ["S1", "S2", "S3"]
---

# REQ-001 — emit_event Tool

## Description

The `emit_event` MCP tool is the single ingestion point for all telemetry. Any Planifest-compliant agent calls this tool to record a structured event. The server validates the payload, writes it to DuckDB, and returns a confirmation.

## Inputs

The tool accepts a single JSON argument conforming to the common event envelope:

```json
{
  "schema_version": "1.0",
  "event": "<event_type>",
  "session_id": "<uuid>",
  "initiative_id": "<string>",
  "phase": "<phase_name>",
  "agent": "<skill_name>",
  "tool": "<tool_name>",
  "model": "<model_identifier>",
  "mcp_mode": "none | workspace | context | workspace+context",
  "timestamp": "<ISO 8601>",
  "data": {}
}
```

Valid `event` values: `phase_start`, `phase_end`, `spec_gap`, `validation_failure`, `deviation`, `migration_proposal`, `context_pressure`, `mcp_impact`, `self_correction`.

## Behaviour

1. Validate the envelope against `schemas/telemetry-event.schema.json`.
2. Validate the `data` payload against the type-specific sub-schema for the given `event` value.
3. On validation failure: return a structured error response with the validation errors. Do NOT write to DuckDB.
4. On validation success: write the event as a single row to the `events` table in DuckDB.
5. Return `{ "ok": true, "id": "<row_id>" }` on success.

## Acceptance Criteria

- [ ] All 9 event types are accepted and stored.
- [ ] Invalid envelope (missing required field) returns a validation error and nothing is written.
- [ ] Invalid `data` payload for a given event type returns a validation error.
- [ ] p95 write latency is < 5ms (measured by performance test).
- [ ] Concurrent calls do not corrupt the DuckDB file (single-writer, WAL mode).

## Error Cases

| Condition | Response |
|-----------|----------|
| Missing required envelope field | `{ "ok": false, "errors": [...] }` |
| Unknown event type | `{ "ok": false, "errors": ["unknown event type"] }` |
| Data payload fails type-specific schema | `{ "ok": false, "errors": [...] }` |
| DuckDB write failure | `{ "ok": false, "errors": ["storage error"] }` — logged to stderr |
