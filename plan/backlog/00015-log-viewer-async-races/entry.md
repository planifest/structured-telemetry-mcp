---
title: "Backlog Entry: 00015 - Log viewer async races: stale responses overwrite fresh data, polls pile up"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "high"
---
# Backlog Entry: 00015 - Log viewer async races: stale responses overwrite fresh data, polls pile up

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

No request in the log viewer is sequenced, cancelled, or guarded. `loadEvents`
(`src/ui/index-html.ts:247-266`), `refresh` (`:348-394`) and `pollForUpdates` (`:403-440`) use no
`AbortController`, no request-generation counter, and no in-flight check; whichever response resolves
last wins, and all paths call `renderTable` unconditionally.

**1. Stale response overwrites filtered data.** Auto-refresh on, no filters. A poll tick fires request
A (slow). The user then types `phase=P3` and clicks Apply -> request B. B returns first and renders 12
P3 rows. A returns later and calls `renderTable(unfilteredEvents)`, rewriting the page label from the
*new* `currentState`. The user now sees **all** events under a form and URL that say `phase=P3`,
labelled as a filtered result, and it persists until the next tick. The same race occurs between two
rapid `refresh()` calls (double-clicking Next).

**2. Polls pile up.** `setInterval(pollForUpdates, 5000)` (`:337-340`) fires regardless of whether the
previous tick is still awaiting `/query`. With `pageSize=1000` over a large table where a query takes
8s, ticks at 5s/10s/15s accumulate concurrent requests against a single-process DuckDB backend, each
later calling `renderTable` in arbitrary order — compounding (1). Leaving the tab open makes this
monotonically worse.

**3. Suggestion fetches race.** `fetchSuggestions` (`:271-293`) has no cancellation or ordering check,
and `:521-523` fires an **undebounced** fetch with `q:''` on *every* focus — not only when the field is
empty, contrary to req-002's intent. Typing `pl` then `an` can leave the datalist showing the broader
`pl*` set; tabbing away and back replaces a narrowed list with the alphabetically-first 20 values. The
`input` debounce timer is never cleared on blur, so a pending fetch can land after the focus fetch and
flip it back.

## Suggested Action

Introduce one shared request-sequencing mechanism rather than patching each call site:

- Hold an `AbortController` per logical request stream (table, suggestions-per-field); abort the
  previous request before issuing a new one.
- Stamp each request with a monotonically increasing generation id and drop any response whose
  generation is not current — belt and braces, since `abort` does not help a response already in
  flight on the wire.
- Guard `pollForUpdates` with an in-flight flag so a tick is skipped (not queued) while one is
  outstanding.
- Pause polling when `document.hidden`, and resume on visibility.
- Clear the suggestion debounce timer on blur, and only fire the focus fetch when the field is empty.

Regression tests must exercise timing, not markup — the existing `tests/unit/ui.test.ts` polling tests
are all `INDEX_HTML.toContain(...)` string assertions and cannot catch any of this. Use Playwright
route interception to delay request A behind request B and assert the rendered rows match B.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. These are defects in the
auto-refresh and combobox features that shipped in 0000017, and they share one root cause, so they
should be fixed as a single coherent change rather than individually.
