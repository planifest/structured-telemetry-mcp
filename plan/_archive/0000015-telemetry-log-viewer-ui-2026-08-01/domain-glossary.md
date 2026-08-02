---
title: "Domain Glossary - telemetry-log-viewer-ui"
summary: "Definitions of domain terms used within this feature."
status: "active"
version: "0.1.0"
---
# Domain Glossary - telemetry-log-viewer-ui

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md) (updated by any agent that introduces a new domain term)
**Feature:** 0000015-telemetry-log-viewer-ui
**Version:** 0.11.0

## Terms

| Term | Definition | Aliases | Used In |
|------|-----------|---------|---------|
| Event Log Viewer | The browser page served at `GET /ui`; the human-facing feature this whole build delivers | Log Viewer, the UI | structured-telemetry-mcp |
| product_id | New optional envelope/column field identifying which repo emitted an event — the git repo root path (via `git rev-parse --show-toplevel`), falling back to the raw `cwd` from hook input if not a git repo | repo/project field (informal, pre-decision name — do not use in code or docs) | structured-telemetry-mcp |
| Unknown product_id | The display/filter value used for any row where `product_id` is NULL — both historical rows and rows from emitters not yet updated to populate it. Permanent for historical rows; not a defect | — | structured-telemetry-mcp |
| Scope filter | Existing term (pre-0000015) for `session_id` / `initiative_id` / `event_type` on an `event_log` query. Previously mandatory (ADR-010); this feature removes that requirement | — | structured-telemetry-mcp |
| Bounded query | An `event_log` query constrained solely by its `limit`/`offset`, independent of whether any scope filter is supplied — the replacement concept for the removed "scope filter required" rule | — | structured-telemetry-mcp |
| total_count | The count of all rows matching an `event_log` query's filters, independent of the current page's `limit`/`offset` — used to compute "page X of Y" | — | structured-telemetry-mcp |
| Zero-result scope hint | Existing term (0000014) for the `hint` field/note surfaced when a scoped query matches zero rows, naming what event types were actually found for that scope. Reused by req-003's "No matching events" state where applicable | scope hint | structured-telemetry-mcp |
