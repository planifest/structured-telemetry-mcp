---
title: "Backlog Entry: 00006 - Quick date-range filters"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
---
# Backlog Entry: 00006 - Quick date-range filters

**Source feature:** 0000017-log-viewer-enhancements
**Source phase:** P0

**Date filed:** 2026-08-03

---

## Problem

0000015 shipped a full timestamp-range filter (from/to) on the event log, and 0000017 (this feature) adds a free-text combobox with value suggestions for the categorical filters (session_id, initiative_id, event_type, phase, agent, product_id). Neither covers a quick, one-click way to scope the time range to a common preset — a developer wanting "just today" or "the last 7 days" currently has to hand-enter exact from/to timestamps every time.

## Suggested Action

Add quick date-range filter presets to the event log UI: Today, Yesterday, Last 7 days, Last 30 days, Last 60 days. Each preset sets the existing from/to timestamp filter fields directly, so it composes with the existing filter/sort/URL-persistence mechanism rather than requiring a new state model. Scope and exact UI placement (buttons vs. dropdown) to be decided at pickup.

## Why Deferred

Out of scope for 0000017 Wave 1, which is scoped to auto-refresh, the filter-value combobox, and sortable/URL-synced headers — not new filter capabilities. Small enough to likely fold into a future Change Pipeline run rather than needing its own Feature Pipeline wave.
