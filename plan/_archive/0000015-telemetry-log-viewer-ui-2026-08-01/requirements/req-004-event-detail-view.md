---
title: "Requirement: req-004 - Event Detail View"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-004 - Event Detail View

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Source:** US-004
**Priority:** should-have

## User Story

As a developer, I click a row to see the event's full JSON (envelope + typed data payload), so that I can inspect fields not shown in the table.

## Functional Requirements

- Clicking any row in the event table opens an in-page detail view (expand-in-place or modal — implementer's choice, no new page navigation) showing the complete raw JSON for that event.
- The detail view uses the full-row data already returned per event by req-002's expanded `event_log` SELECT (`schema_version`, `event`, `session_id`, `initiative_id`, `phase`, `agent`, `tool`, `model`, `mcp_mode`, `timestamp`, `model_config`, `data`, `product_id`, `inserted_at`) — no new backend endpoint or request is needed to fetch detail data.
- JSON is pretty-printed (indented) for readability.
- Closing the detail view returns to the table in its exact prior state (filters/page/sort unchanged).

## Acceptance Criteria

- [ ] Clicking a row shows all envelope fields and the full `data` payload as pretty-printed JSON
- [ ] No additional network request is made to open the detail view — the data was already fetched with the table page
- [ ] Closing the detail view leaves the table's filters, page, and sort exactly as they were

## Dependencies

- Depends on req-001 (product_id should appear in the detail JSON once it exists)
- Depends on req-002 (the expanded SELECT that returns full row data is what this requirement's detail view reads)
