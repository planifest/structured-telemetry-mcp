---
title: "Requirement: REQ-005 - schema-validation"
summary: "JSON Schema validation of all events at the point of ingestion."
status: "active"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
stories: ["S1", "S2", "S3"]
---

# REQ-005 — Schema Validation

## Description

All events must be validated against a central JSON Schema at the point of ingestion. Invalid events are rejected with a structured error response. Nothing invalid is written to DuckDB.

## Schema Structure

`schemas/telemetry-event.schema.json` defines:
1. **Common envelope** — required fields present on every event: `schema_version`, `event`, `session_id`, `initiative_id`, `phase`, `agent`, `tool`, `model`, `mcp_mode`, `timestamp`.
2. **Typed payloads** — a `data` sub-schema per event type, using JSON Schema `discriminator` on the `event` field.

## Event Type Payloads

| Event Type | Required `data` Fields |
|------------|----------------------|
| `phase_start` | `phase_name` |
| `phase_end` | `phase_name`, `status` (`pass` \| `fail`), `duration_ms`, `content_type` (optional) |
| `spec_gap` | `question`, `phase_name` |
| `validation_failure` | `failure_type`, `phase_name`, `attempt_number`, `action_id` |
| `deviation` | `component_id`, `description`, `severity` |
| `migration_proposal` | `component_id`, `proposal_path`, `destructive` (boolean) |
| `context_pressure` | `context_fill_pct`, `unused_sources` (array), `trigger` |
| `mcp_impact` | `mcp_mode`, `avg_token_delta`, `peak_fill_pct` |
| `self_correction` | `phase_name`, `attempt_number`, `action_id`, `correction_type` |

## Acceptance Criteria

- [ ] `schemas/telemetry-event.schema.json` is the single source of truth for all event shapes.
- [ ] All 9 event types have a defined `data` sub-schema.
- [ ] Validation runs synchronously before any DuckDB write.
- [ ] A missing required envelope field returns a rejection with the field name(s) listed.
- [ ] An unknown `event` value returns a rejection.
- [ ] A valid envelope with an invalid `data` payload returns a rejection with the path and constraint violated.
- [ ] Schema is versioned via `schema_version: "1.0"` and stored alongside the server.
- [ ] Schema version is stored with every event row in DuckDB to support future migrations.
