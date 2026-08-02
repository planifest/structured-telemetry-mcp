---
title: "Requirement: req-001 - Auto-Refresh / Tail Mode"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-001 - Auto-Refresh / Tail Mode

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000017-log-viewer-enhancements
**Source:** US-001
**Priority:** should-have

## User Story

As a developer, I toggle live auto-refresh on the event log, so that new events appear without me manually re-running the query.

## Functional Requirements

- Add a checkbox toggle `<input type="checkbox" id="auto-refresh" name="autoRefresh">` (with a `<label for="auto-refresh">`) to `<form id="filters">` in `src/ui/index-html.ts` (the form currently ends at the `#pageSize` field, index-html.ts:81-88) — placed as a new `.field` block after the page-size selector.
- Add a new element `<span id="auto-refresh-status"></span>` (or similar, hidden/empty by default) near `#status` (index-html.ts:91) to hold the non-blocking poll-failure indicator. This element is distinct from `#banner` (index-html.ts:42), which remains reserved for the existing initial-load-unreachable case.
- Extend `readStateFromUrl()` (index-html.ts:108-121): read a new `autoRefresh` query param and set `state.autoRefresh = params.get('autoRefresh') === '1'`. Any absent value or any value other than the literal string `'1'` (e.g. `true`, `0`, `xyz`) resolves to `false` — never throws, matching the existing degrade-gracefully pattern used for `page`/`pageSize`/`sort`.
- Extend `writeStateToUrl()` (index-html.ts:123-132): set `params.set('autoRefresh', '1')` only when `state.autoRefresh` is `true`; omit the param entirely when `false`, mirroring how filter keys are conditionally written (index-html.ts:125-127) rather than the always-written pattern used for `page`/`pageSize`/`sort`. This keeps the default (no param) semantically identical to explicit-off.
- Extend `applyStateToForm()` (index-html.ts:134-141): set `document.getElementById('auto-refresh').checked = !!state.autoRefresh;`.
- Add a module-level `let autoRefreshTimer = null;` and a named interval constant `const AUTO_REFRESH_INTERVAL_MS = 5000;` (5 seconds — justified by the inherited p95 < 300ms per-query NFR and single local-developer data volume from design.md; frequent enough to feel "live," infrequent enough not to add meaningful load to the local DuckDB process).
- Add `startAutoRefresh()` / `stopAutoRefresh()` functions: `startAutoRefresh()` is a no-op if `autoRefreshTimer` is already set, otherwise sets `autoRefreshTimer = setInterval(pollForUpdates, AUTO_REFRESH_INTERVAL_MS)`; `stopAutoRefresh()` calls `clearInterval(autoRefreshTimer)`, sets it back to `null`, and clears any visible content in `#auto-refresh-status`.
- Add a `change` listener on `#auto-refresh`: sets `currentState.autoRefresh = checkbox.checked`, calls `writeStateToUrl(currentState)`, then calls `startAutoRefresh()` or `stopAutoRefresh()` accordingly. Turning the toggle on does **not** trigger an immediate extra fetch — the visible table is already current from the most recent `refresh()`/`pollForUpdates()` call; the first automatic re-fetch happens after one full `AUTO_REFRESH_INTERVAL_MS` elapses (standard `setInterval` semantics).
- After the existing bootstrap (`applyStateToForm(currentState); refresh();`, index-html.ts:316-317), if `currentState.autoRefresh` is `true`, call `startAutoRefresh()` so a reloaded URL containing `autoRefresh=1` resumes polling without the user re-toggling it.
- Add a new `pollForUpdates()` function, separate from `refresh()` (index-html.ts:225-270), that reuses `loadEvents(currentState)` and `renderTable(events)` but differs from `refresh()` in error/rendering behavior:
  - It must **not** set `table.style.display = 'none'` / `pager.style.display = 'none'` before or during the fetch — the currently rendered rows stay visible throughout the poll, with no blank/flicker frame.
  - It must **not** call `applyStateToForm()` at any point, so any text a user has typed into a filter `<input>` (e.g. `#f-session_id`) but not yet submitted via "Apply filters" is never overwritten by a poll tick.
  - It must **not** call `writeStateToUrl(currentState)` — polling does not itself change `currentState`, so no URL rewrite is needed on every tick.
  - It must not introduce any `scrollTo`, `scrollIntoView`, `.focus()`, or scroll-position-resetting call anywhere in its execution path, so the user's current scroll position in the page is left untouched by a poll tick.
  - On a successful response: hide/clear `#auto-refresh-status`, call `renderTable(events)`, and update the pager label / prev-next disabled state exactly as `refresh()` does today (index-html.ts:266-269), using the response's `total_count` and `currentState.page`/`currentState.pageSize` at tick time.
  - On a failed response (fetch rejects, or `res.ok` is falsy from `loadEvents`): leave `#events-body`'s existing rows and `#pager` state completely unchanged, set a short message (e.g. `"Auto-refresh failed — retrying…"`) into `#auto-refresh-status`, do **not** touch `#banner`, and do **not** call `stopAutoRefresh()` — the existing interval keeps firing and the next tick retries automatically.
- Each poll tick (success or failure) uses whatever `currentState.filters` / `currentState.sort` / `currentState.page` / `currentState.pageSize` are current at that moment — no separate "auto-refresh query" is constructed, so a filter, sort, or page change made by the user via the normal form/header controls while auto-refresh is on is naturally picked up by the next tick without extra wiring.

## Acceptance Criteria

- [ ] `#auto-refresh` checkbox exists inside `<form id="filters">`; it is unchecked on a bare `/ui` load (no `autoRefresh` param)
- [ ] Checking `#auto-refresh` begins issuing a `POST /query` (`mode: 'event_log'`) request roughly every 5 seconds (`AUTO_REFRESH_INTERVAL_MS`); unchecking it stops further requests
- [ ] Checking `#auto-refresh` updates the URL to include `autoRefresh=1` (via `writeStateToUrl`); unchecking it removes the `autoRefresh` param from the URL
- [ ] Loading `/ui?autoRefresh=1` (alone or combined with filter/sort/page params) renders with `#auto-refresh` pre-checked and polling already active, with no further user action required
- [ ] Loading `/ui` with no `autoRefresh` param, or with any value other than exactly `1` (e.g. `autoRefresh=true`, `autoRefresh=0`, `autoRefresh=xyz`), leaves the toggle off — page load never throws and never blocks
- [ ] While auto-refresh is on, typing into a filter input (e.g. `#f-session_id`) without clicking "Apply filters" is not reverted or overwritten by an intervening poll tick
- [ ] While auto-refresh is on, scrolling the page/table and waiting through at least one poll interval leaves the scroll position unchanged
- [ ] While auto-refresh is on, `currentState.filters` / `currentState.sort` / `currentState.page` are unchanged by a poll tick — only rendered row data and pager labels update
- [ ] Simulating a poll failure (non-2xx response or rejected fetch) leaves the previously rendered rows in `#events-body` visible and unchanged, and displays a message in `#auto-refresh-status` without showing/activating `#banner`
- [ ] After a simulated poll failure, the interval keeps running and a subsequent successful poll clears `#auto-refresh-status` and resumes normal row/pager updates
- [ ] A poll failure never calls `stopAutoRefresh()` — auto-refresh is never silently turned off by an error
- [ ] No new frontend build step, bundler, or dependency is introduced; all changes remain inside the `src/ui/index-html.ts` template literal

## Dependencies

- Shares `src/ui/index-html.ts`'s state-management functions (`readStateFromUrl`, `writeStateToUrl`, `applyStateToForm`, `readFormIntoFilters`, the module-level `currentState`, and `<form id="filters">` markup) with req-002 (filter combobox) and req-003 (sortable headers/URL sync). All three requirements extend the same functions (e.g. req-003 adds sort-field handling to `readStateFromUrl`/`writeStateToUrl` per the P1 spec_gap resolution in `plan/current/build-log.md`) — implement/merge these edits in a coordinated pass rather than three independent diffs, so additions don't clobber each other.
- No backend change required for this requirement: reuses the existing `POST /query` (`mode: 'event_log'`) endpoint and `src/query/event-log.ts` builder unchanged (per design.md's Integration Points — polling only, no push/websocket mechanism). Each poll tick automatically picks up whatever sort field req-003 introduces via `currentState`, without this requirement needing to know its shape.
