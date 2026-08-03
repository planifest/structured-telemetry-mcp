---
title: "Scope - log-viewer-enhancements"
summary: "Defines explicit boundaries of what is in scope and out of scope."
status: "active"
version: "0.1.0"
---
# Scope - log-viewer-enhancements

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000017-log-viewer-enhancements
**Wave:** 1 of 2 (Wave 2 — aggregation/dashboard views — deferred to backlog #00004)
**Version:** 0.13.0

## In Scope

- **US-001 — Live auto-refresh / tail mode:** user-toggleable control on the event log; when on, re-queries the existing `/query` endpoint on an interval and merges new rows without losing active filters, sort, or scroll position. Toggle state persists via a URL query param, defaulting off when absent — consistent with filter/sort persistence.
- **US-002 — Filter combobox with suggestions:** free-text input per filterable field (`session_id`, `initiative_id`, `event_type`, `phase`, `agent`, `product_id`) that suggests existing distinct values as the user types, sourced from a new lightweight backend distinct-values lookup against the existing `events` table (no new index).
- **US-003 — Sortable table column headers:** clicking a header sorts by that column and toggles ascending/descending on repeated clicks. Requires a new backend allow-listed sort-field query param — the current backend hardcodes `ORDER BY timestamp` only (`src/query/event-log.ts:41,54`), so this is a real backend change, not a frontend-only reskin of the existing direction toggle.
- **Three-way sync:** the sort-field dropdown/direction control, the column headers, and the URL query params stay synced — changing any one of the three updates the other two.
- **URL-state persistence, extended:** 0000015 already persists filters via URL query params. This feature extends that same mechanism to also cover sort field, sort direction, and the auto-refresh toggle, so a page reload restores filters + sort + auto-refresh together. All persisted params degrade gracefully to their defaults when absent or malformed — never throw or block page load.

## Out of Scope

- Aggregation/dashboard views (bottleneck/failure-rate/token-efficiency charts) — deferred, backlog #00004
- Any change to ADR-018 (static vanilla-JS, no framework, no build step) — this wave stays inside that constraint
- Backfilling `product_id` on historical rows, or framework-side `product_id` emission — backlog #00002; filter-combobox suggestions for `product_id` will surface "unknown"/empty until that lands

## Deferred

- Aggregation/dashboard views — blocked until a future pipeline run revisits ADR-018 (static vanilla-JS UI) and this feature's Wave 1 ships (backlog #00004)
- Quick date-range filter presets (backlog #00006, filed this P0 session) — related to the same UI's filter controls but not part of this feature's confirmed scope; blocked until a future pipeline run picks it up
- `planifest-framework`'s own emitters populating `product_id` — blocked on that product's own pipeline picking up backlog #00002; this feature does not implement it (cross-product boundary, unchanged from 0000015)

> Note: backlog #00005 (Scope Lock default-drafting UX) was also filed this session but is a process/tooling item unrelated to this feature's product scope — not listed here as a deferred product capability.
