---
title: "Requirement: req-001 - product_id Tagging"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-001 - product_id Tagging

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Source:** US-001
**Priority:** should-have

## User Story

As a developer, I see which repo/project emitted each event, so that I can distinguish events across the multiple projects sharing one telemetry DB.

## Functional Requirements

- Add an optional `product_id` string field to the `TelemetryEvent` envelope schema (`schemas/telemetry-event.schema.json`), following the same pattern as the existing optional `initiative_id` field.
- Add a nullable `product_id VARCHAR` column to the `events` table via a written migration proposal at `src/structured-telemetry-mcp/docs/migrations/proposed-add-product-id.md` (Hard Limit: no direct schema modification — STOP for human approval before applying).
- `emit_event` and `POST /emit` accept events with or without `product_id` — both validate and store correctly.
- `event_log` queries accept an optional `product_id` filter (exact match).
- Rows with a NULL `product_id` (all historical rows, and any future event from an emitter that hasn't been updated yet — see cross-product dependency below) are treated as a distinct, stable value for filtering/display purposes: "unknown". No backfill is performed or attempted.
- Update `src/structured-telemetry-mcp/docs/data-contract.md`'s `events` table definition and `## Schema Invariants` to document the new column once the migration is applied.

## Acceptance Criteria

- [ ] An event with `product_id` set validates and stores the value; an event without it validates and stores NULL
- [ ] A migration proposal document exists and is approved by the human before the `product_id` column is added to the live schema
- [ ] `event_log` query accepts `product_id` as an optional filter and returns only matching rows
- [ ] Rows with NULL `product_id` are not excluded by default (no filter applied) and display/report as "unknown" rather than blank or erroring, wherever product_id is shown
- [ ] No migration or code path attempts to backfill `product_id` on pre-existing rows

## Dependencies

- Blocks req-003 (Event Filtering) — the `product_id` filter cannot be implemented before the column and query support exist.
- Blocks req-004 (Event Detail View) — the detail view's full-JSON payload should include `product_id` once it exists.
- Cross-product dependency (not built in this feature, tracked separately): `planifest-framework`'s telemetry emission hooks need to start populating `product_id` on the events they send. See `plan/backlog/00002-framework-product-id-emission/entry.md`. Until that lands, every newly-emitted event (not just historical ones) will also show "unknown" — this is expected and acceptable per the confirmed design.
