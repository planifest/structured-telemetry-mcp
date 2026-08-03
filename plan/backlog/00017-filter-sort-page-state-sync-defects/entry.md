---
title: "Backlog Entry: 00017 - Filter/sort/page state sync defects and misleading error reporting"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "medium"
---
# Backlog Entry: 00017 - Filter/sort/page state sync defects and misleading error reporting

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

A cluster of state-synchronisation defects in `src/ui/index-html.ts`, all individually small but
jointly making the filter/sort/pagination surface untrustworthy.

**1. Sort dropdown does not reset the page; the header click does.** `:449-452` calls
`readFormIntoFilters(...)` then `refresh()` with **no** `currentState.page = 1`, while the header-click
path (`:489-502`) does reset it. Worse, `readFormIntoFilters` (`:211-222`) re-reads every filter input,
so changing the sort dropdown silently applies filter text the user typed but never submitted.

Scenario: user is on page 7, types `agent=planifest-codegen-agent` without applying, then picks
"Agent (A-Z)". The request goes out with `offset = 6 * pageSize` **and** the unsubmitted filter. The
agent has 20 matches, so `total_count = 20` and `events = []`.

**2. `refresh()` never clamps `page` against `totalPages`.** `:374-394` keys its zero-state branch off
`totalCount === 0` rather than `events.length`, so when the page is out of range it falls through to
`:385-388`, blanks `#status`, shows the table, and renders zero rows. Opening `/ui?page=99` — a
bookmarked or shared link, or the state produced by (1) — yields visible headers, an empty body, no
status text and no error: indistinguishable from a broken page.

**3. Unsubmitted typing is silently discarded.** `applyStateToForm` (`:200-204`) overwrites all filter
inputs from `currentState.filters`, and is called by the header-click handler (`:499`) and by each
per-field clear button (`:472`) — neither of which calls `readFormIntoFilters` first. Clicking a column
header, or the `x` next to one field, wipes pending text in all the others.

**4. Every backend 4xx is reported as "backend is down".** The single `catch` at `:363-367` renders
"Can't reach telemetry backend — is the service running?". But `/query` returns HTTP 400 with
`{ok:false, errors:[...]}` for validation errors, which `loadEvents` (`:261-264`) turns into an `Error`
indistinguishable from a network reject. `/ui?pageSize=2000` exceeds `MAX_LIMIT` and tells the user the
service is down while it is healthy — and the real fix is a URL parameter.

**5. Out-of-range `pageSize` silently reverts.** `:206` sets `select.value = '200'`; no such `<option>`
exists, so the select goes blank (`selectedIndex = -1`) and `:221` then evaluates
`parseInt('', 10) || 50`.

## Suggested Action

- Reset `page = 1` on **every** query-shape change (filters, sort field, sort direction, page size) —
  centralise this rather than fixing each handler.
- Clamp `page` to `ceil(totalCount / pageSize)` after each response and re-request if out of range;
  render an explicit "page N is beyond the end" state rather than an empty table.
- Call `readFormIntoFilters` before any `applyStateToForm`, so pending input is never silently lost —
  or make the form the single source of truth and stop round-tripping through `currentState`.
- Distinguish transport failure from an application error: surface the backend's `errors[0]` when the
  response has a body, and reserve the "is the service running?" copy for an actual fetch rejection.
- Validate `pageSize` from the URL against the available options and fall back visibly.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. Individually minor, but they
share one root cause — state split between `currentState` and the DOM with no single owner — so the
fix is a small refactor rather than five patches, and is worth scoping deliberately.
