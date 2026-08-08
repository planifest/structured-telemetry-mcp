---
title: "Backlog Entry: 00016 - Tail mode destroys expanded rows and does not actually tail"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "high"
---
# Backlog Entry: 00016 - Tail mode destroys expanded rows and does not actually tail

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

Two defects make the auto-refresh feature shipped in 0000017 (req-001) unusable in practice.

**1. Every poll destroys expanded detail rows.** `renderTable` (`src/ui/index-html.ts:297`) does
`tbody.innerHTML = ''` and is reached from `pollForUpdates` (`:434`). The req-001 header comment at
`:396-402` claims a poll tick "only updates rendered row data"; it in fact destroys and rebuilds every
row, its detail row, and its click listener.

A user checks auto-refresh, clicks a row to read its JSON payload, and within 5 seconds the row
collapses under them, losing any text selection inside the `<pre>`. Re-expanding restarts the same
5-second countdown, so **the payload is effectively unreadable while tail mode is on** — and reading
payloads is the primary reason to open an individual event.

**2. Tail mode does not tail.** `pollForUpdates` re-runs whatever query is current. On page 5 sorted
`phase:asc`, the checkbox polls forever and nothing can ever change, because new events do not land on
that page under that sort. Even on page 1 with the default sort, `renderTable` replaces the whole
`<tbody>` with no visual indication that anything arrived, and `#auto-refresh-status` only ever renders
text on *failure* — so a working tail is indistinguishable from a stalled one.

Related: `#auto-refresh-status` is never cleared by a successful manual refresh. `:412` sets
"Auto-refresh failed — retrying...", and only `pollForUpdates` (`:416`) and `stopAutoRefresh` (`:345`)
clear it; `refresh()` (`:348-394`) never touches it. So a failure message can sit alongside freshly
loaded correct data.

## Suggested Action

- **Preserve expansion state across polls.** Key rows by event `id`, diff against the previous render,
  and patch in place instead of clearing `tbody`. At minimum, re-open the rows that were open and
  restore scroll position.
- **Make tail mean tail.** When auto-refresh is enabled, either pin to `timestamp:desc` page 1, or
  keep the current view and surface a "N new events — jump to latest" affordance so the user is never
  silently watching a view that cannot update.
- **Signal liveness.** Flash-highlight rows that arrived since the previous poll and show a
  "updated 3s ago" indicator, so a working tail is visibly working.
- Pause polling when the tab is hidden (see [[00015-log-viewer-async-races]]).
- Clear `#auto-refresh-status` on any successful load, including manual `refresh()`.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. Overlaps heavily with
[[00015-log-viewer-async-races]] — both rewrite the polling path — and the two should probably be
scoped together as a single "make auto-refresh correct" change rather than sequenced separately.
