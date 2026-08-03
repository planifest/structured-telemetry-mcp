---
title: "Backlog Entry: 00004 - Aggregation/Dashboard Views"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
---
# Backlog Entry: 00004 - Aggregation/Dashboard Views

**Source feature:** 0000017-log-viewer-enhancements
**Source phase:** P0
**Date filed:** 2026-08-02

---

## Problem

The telemetry log-viewer UI (0000015) ships raw event browsing only — filters, pagination, four confirmed views. Aggregation/dashboard-style views (bottleneck charts, failure-rate charts, token-efficiency charts) were deliberately out of scope for that wave (see `plan/_archive/0000015-telemetry-log-viewer-ui-2026-08-01/recommendations.md`, Deferred Items table, and `ADR-018-static-vanilla-js-ui-in-process`).

When scoping 0000017 (a follow-on UI wave covering live auto-refresh, a filter combobox, and sortable column headers), the human asked for this item to be picked up too, but it is materially bigger than the other three: it needs new aggregation query endpoints on the backend, and it directly revisits ADR-018's "no framework, vanilla JS" decision — that ADR's own authors flagged it for reconsideration if the UI's scope ever grew meaningfully beyond the original 4 views (REC-003 in the 0000015 recommendations).

## Suggested Action

In a future pipeline run (after 0000017 Wave 1 ships): design the aggregation query layer (bottleneck/failure/token-efficiency), and explicitly revisit ADR-018 before codegen — decide whether the growing UI surface still justifies vanilla JS/DOM string concatenation or warrants a lightweight framework. Reuse 0000017's established filter/sort/refresh patterns rather than inventing new ones.

## Why Deferred

Out of scope for 0000017 (Wave 1) — that wave is confined to incremental UI-interaction work on the existing shell (no architecture change). This item needs its own design decision (ADR-018 revisit, new query endpoints) and is large enough to warrant its own pipeline run rather than being folded into Wave 1.
