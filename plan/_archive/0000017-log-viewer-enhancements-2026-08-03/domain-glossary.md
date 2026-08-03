---
title: "Domain Glossary - log-viewer-enhancements"
summary: "Definitions of domain terms used within this feature."
status: "active"
version: "0.1.0"
---
# Domain Glossary - log-viewer-enhancements

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md) (updated by any agent that introduces a new domain term)
**Feature:** 0000017-log-viewer-enhancements
**Version:** 0.13.0

## Terms

| Term | Definition | Aliases | Used In |
|------|-----------|---------|---------|
| Auto-Refresh / Tail Mode | User-toggleable UI state that, when on, re-polls the existing `/query` endpoint on an interval and merges newly-arrived rows into the table without disturbing active filters, sort, or scroll position | Live auto-refresh, polling mode | structured-telemetry-mcp |
| Three-way sync | The invariant that the sort-field/direction dropdown, the clickable table column headers, and the URL query params always reflect the same sort state — changing any one of the three updates the other two | — | structured-telemetry-mcp |
| Sort field | The `events` column currently used in `ORDER BY` (e.g. `timestamp`, `event`, `session_id`, `phase`, `agent`, `product_id`), selected by clicking a column header or the dropdown. New concept for this feature — the pre-existing backend only supported a hardcoded `ORDER BY timestamp` | — | structured-telemetry-mcp |
| Sort direction | Existing term (0000015): ascending vs. descending order applied to the current sort field. Previously the only sort control; now paired with the new Sort field concept | asc/desc toggle | structured-telemetry-mcp |
| Allow-listed field | A column identifier restricted to a fixed, validated set (`timestamp`, `event`, `session_id`, `initiative_id`, `phase`, `agent`, `product_id`) before being interpolated into SQL for either `ORDER BY` (sort field) or `SELECT DISTINCT` (suggestion lookup) — since DuckDB does not support parameterized column identifiers, this allow-list is the SQL-injection boundary for both new code paths | Sortable-field allow-list, suggestible-field allow-list | structured-telemetry-mcp |
| Distinct-values lookup | The new lightweight backend query (`SELECT DISTINCT {allow-listed field} FROM events`) that powers filter-combobox suggestions for a given filterable field | Suggestion lookup | structured-telemetry-mcp |
| Filter combobox | A free-text filter input (per filterable field) that additionally surfaces suggested values sourced from the field's distinct-values lookup as the user types, falling back to plain free-text entry if suggestions are empty or unavailable | Suggestion combobox | structured-telemetry-mcp |
| product_id | Existing term (0000015): the git-repo-root path (or raw `cwd` fallback) identifying which repo emitted an event | repo/project field (informal, do not use) | structured-telemetry-mcp |
| Unknown product_id | Existing term (0000015): the display/suggestion value for any row or field where `product_id` is NULL — permanent for historical rows until backlog #00002 lands | — | structured-telemetry-mcp |
