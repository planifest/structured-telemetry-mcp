---
title: "Requirement: req-003 - Sortable Table Headers (Three-Way Sync)"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-003 - Sortable Table Headers (Three-Way Sync)

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000017-log-viewer-enhancements
**Source:** US-003
**Priority:** should-have

## User Story

As a developer, I click a column header to sort by that field, so that I don't have to use the separate sort-field dropdown for a task the table itself should support. Column header, sort-field dropdown, and URL query params stay three-way synced.

## Background (P1 spec_gap resolution)

`design.md` originally assumed a pre-existing "sort-field dropdown" to sync headers against. The actual code has no field selector: `src/ui/index-html.ts:75-80` renders `<select id="sort" name="sort">` with only two options, `desc` ("Newest first") / `asc` ("Oldest first") — direction only. `src/query/event-log.ts:41` (`const sortDirection = query.sort === 'desc' ? 'DESC' : 'ASC';`) and `:54` (`ORDER BY timestamp ${sortDirection}`) hardcode the sorted column to `timestamp`; there is no field parameter anywhere in `EventLogQuery`. The human confirmed (build-log.md, P1 exchange "spec_gap (sort field)") that this requirement must build real per-column sort — a new backend allow-listed sort-field parameter — not direction-only headers reusing the existing dropdown as-is.

## Functional Requirements

### Backend (`src/query/event-log.ts`)

- Add a new exported constant, `SORTABLE_FIELDS`, a `readonly` allow-list of the 6 sortable column names in table-column order: `['timestamp', 'event', 'session_id', 'phase', 'agent', 'product_id']`. Export both the array and a derived union type (e.g. `export type SortField = typeof SORTABLE_FIELDS[number];`) from `event-log.ts` so it is the single shared source — do not redefine an equivalent list elsewhere (see Dependencies).
- Add `sortField?: SortField` to the `EventLogQuery` interface (`event-log.ts:19-32`), defaulting to `'timestamp'` when omitted — preserves current `ORDER BY timestamp` behavior for every existing caller (MCP `query_telemetry`, REST `/query`, any test) that does not pass it, matching how `sort` itself already defaults (non-breaking, same pattern as req-002's `sort` default).
- In `queryEventLog`, resolve the sort column via the allow-list before building SQL:
  ```ts
  const sortField = query.sortField ?? 'timestamp';
  if (!SORTABLE_FIELDS.includes(sortField)) {
    throw new Error(`Invalid sortField: "${sortField}". Valid values: ${SORTABLE_FIELDS.join(', ')}`);
  }
  ```
  Place this check alongside the existing `limit > MAX_LIMIT` guard (`event-log.ts:37-39`) — same clear-error-on-invalid-input pattern, thrown before any query executes.
- Change `ORDER BY timestamp ${sortDirection}` (`event-log.ts:54`) to `ORDER BY ${sortField} ${sortDirection}`. **`sortField` MUST come only from the validated `SORTABLE_FIELDS` allow-list check above — never interpolate the raw `query.sortField` value into SQL.** DuckDB does not support parameterized identifiers (column/table names), so an un-allow-listed field name is a SQL-injection-via-identifier risk; the allow-list check is the only defense and must run on every call, with no bypass path.
- No change needed to `src/server-factory.ts` or the REST `/query` handler: `dispatchQuery` already passes the raw query object straight through to `qs.eventLog(query as EventLogQuery)` (`server-factory.ts:81-82`), and `EventLogQuery` is re-exported unchanged from `src/query/query-service.ts:14`. A `sortField` key in the JSON request body flows through automatically once the interface and query builder are updated — no additional plumbing.

### Frontend (`src/ui/index-html.ts`)

- Extend the existing `<select id="sort" name="sort">` (`index-html.ts:75-80`) to carry both field and direction as combined option values, rather than adding a second dropdown — this is the simplest three-way-sync surface: one control, one URL param pair, no risk of the two controls disagreeing with each other independently of the headers. Replace the two `<option>`s with one per sortable field × default direction, e.g.:
  ```html
  <select id="sort" name="sort">
    <option value="timestamp:desc">Timestamp (newest first)</option>
    <option value="timestamp:asc">Timestamp (oldest first)</option>
    <option value="event:asc">Event (A-Z)</option>
    <option value="event:desc">Event (Z-A)</option>
    <option value="session_id:asc">Session ID (A-Z)</option>
    <option value="session_id:desc">Session ID (Z-A)</option>
    <option value="phase:asc">Phase (A-Z)</option>
    <option value="phase:desc">Phase (Z-A)</option>
    <option value="agent:asc">Agent (A-Z)</option>
    <option value="agent:desc">Agent (Z-A)</option>
    <option value="product_id:asc">Product (A-Z)</option>
    <option value="product_id:desc">Product (Z-A)</option>
  </select>
  ```
  Default selected value stays `timestamp:desc` (matches current default behavior).
- Make each of the 6 `<th>` elements in `#events-table` (`index-html.ts:94`, currently plain text: Timestamp, Event, Session ID, Phase, Agent, Product) clickable. Wrap each header label in a `<button type="button" class="th-sort" data-field="...">` (or attach a click listener directly to the `<th>` with `data-field` set to its `SortField` value: `timestamp`, `event`, `session_id`, `phase`, `agent`, `product_id` respectively) so no new dependency is introduced (ADR-018) — plain DOM/CSS only.
- Click behavior on a header (standard clickable-header UX):
  - If the clicked field is not the current `sortField`: set `sortField` to that field, set direction to that field's default (`asc` for text fields `event`/`session_id`/`phase`/`agent`/`product_id`; `desc` for `timestamp`, matching the existing "newest first" default) — first click always sorts, it never toggles a field you weren't already sorted by.
  - If the clicked field IS the current `sortField`: toggle direction (`asc` ↔ `desc`).
  - Reset `state.page` to `1` on any header click (new sort order invalidates the current page position, same as existing filter/pageSize submit handlers at `index-html.ts:272-277,284-288`).
- Visual indication of active sort column/direction: append a plain-text arrow glyph (`▲` for ascending, `▼` for descending — no icon font/SVG library, ADR-018) to the currently-sorted `<th>`'s label only; other headers show no glyph. Implemented via a small DOM update function (e.g. `updateSortIndicators(state)`) called after every `refresh()` alongside the existing `applyStateToForm` call — rewrite each `<th>`'s text content, injecting the glyph only on the header whose `data-field` equals `state.sortField`.

### Three-way sync (headers ↔ sort-field control ↔ URL)

- Extend `currentState` (`index-html.ts:223`, produced by `readStateFromUrl`) to carry `sortField` alongside the existing `sort` (direction) value — e.g. rename/repurpose so `state.sort` becomes the direction (`'asc'|'desc'`, unchanged type) and add `state.sortField` (one of the 6 `SortField` values, default `'timestamp'`).
- `readStateFromUrl()` (`index-html.ts:108-121`): read a `sortField` query param; if present and one of the 6 allow-listed values, set `state.sortField`; otherwise default to `'timestamp'` (malformed/unrecognized values silently fall back to default — never throw, matching the design's "degrade gracefully" constraint). Keep existing `sort` (direction) param parsing as-is.
- `writeStateToUrl()` (`index-html.ts:123-132`): add `params.set('sortField', state.sortField)` alongside the existing `params.set('sort', state.sort)`.
- `applyStateToForm()` (`index-html.ts:134-141`): set the combined `<select id="sort">` value from `state.sortField` + `state.sort` (e.g. `document.getElementById('sort').value = state.sortField + ':' + state.sort;`), and call `updateSortIndicators(state)` to sync header glyphs.
- `readFormIntoFilters()` (`index-html.ts:143-152`): parse the combined `<select id="sort">` value back into `state.sortField` and `state.sort` (split on `:`), replacing the current single-value read at line 150.
- `loadEvents()` (`index-html.ts:168-186`): include `sortField: state.sortField` in the POST body alongside the existing `sort: state.sort`.
- Net effect — all three surfaces always agree:
  1. Clicking a `<th>` updates `state.sortField`/`state.sort` → calls `applyStateToForm` (updates the dropdown) → calls `refresh()` (calls `writeStateToUrl`, updating the URL) → `updateSortIndicators` re-renders header glyphs.
  2. Changing the `<select id="sort">` dropdown updates `state.sortField`/`state.sort` via `readFormIntoFilters` → `refresh()` writes the URL and `updateSortIndicators` updates header glyphs.
  3. Loading/reloading a URL with `?sortField=...&sort=...` → `readStateFromUrl` populates `currentState` → `applyStateToForm` sets the dropdown and header glyphs before the first `refresh()` call (`index-html.ts:316-317`).

## Acceptance Criteria

- [ ] `queryEventLog` called with no `sortField` sorts by `timestamp` (unchanged default; existing callers/tests continue to pass unmodified)
- [ ] `queryEventLog` called with `sortField: 'agent'` and `sort: 'asc'` returns rows ordered by `agent` ascending, not `timestamp`
- [ ] `queryEventLog` called with an unrecognized `sortField` (e.g. `'data'` or `'id'`, not in the 6-value allow-list) throws a clear error naming the valid values, before any SQL executes
- [ ] `SORTABLE_FIELDS` is exported from `src/query/event-log.ts` as the single allow-list source (no duplicate list defined elsewhere in the codebase)
- [ ] Clicking the "Timestamp" header when already sorted by `timestamp:desc` re-sorts to `timestamp:asc` (direction toggles); clicking "Agent" while sorted by `timestamp:*` sorts to `agent:asc` (field switches, direction resets to that field's default)
- [ ] After a header click, the `<select id="sort">` dropdown reflects the new field+direction, the clicked `<th>` shows the correct arrow glyph (`▲`/`▼`), and no other `<th>` shows a glyph
- [ ] After changing the `<select id="sort">` dropdown, the corresponding `<th>` shows the matching arrow glyph
- [ ] Loading `/ui?sortField=phase&sort=asc` renders the table sorted by `phase` ascending, with the dropdown and the "Phase" header glyph both reflecting that state on first paint (no extra click/change needed)
- [ ] Loading `/ui?sortField=not_a_column` does not throw or block page load; the page falls back to the `timestamp` default (malformed-param graceful-degradation, per design.md constraints)
- [ ] A header click resets `state.page` to `1` and the resulting `/query` request's `offset` reflects page 1
- [ ] No new frontend build step or dependency is introduced (ADR-018)

## Dependencies

- **Shared allow-list coordination (explicit flag for whoever implements req-002 and req-003 together):** req-002 (filter combobox, drafted separately) needs its own column-name allow-list for its distinct-values suggestion lookup (`session_id`, `initiative_id`, `event_type`, `phase`, `agent`, `product_id`). Do not define two separate allow-list constants in `event-log.ts`. Export one shared constant (or two constants that reference a common base list, since the sortable set and the filterable set differ slightly: `event_type`/`event` and `initiative_id` are filterable but not currently sortable-column candidates per this requirement's 6-column scope) and have both requirements' implementations consume it. Whoever implements req-002 and req-003 should coordinate on the exact shape before either lands, to avoid a duplicate-source-of-truth drift bug.
- Depends on req-002 (Event Log Table, archived under 0000015) for the existing `EventLogQuery` interface, `queryEventLog` SQL builder, and `#events-table` markup this requirement extends — no new component or file is introduced.
- Shares `src/query/event-log.ts` with any future requirement touching `EventLogQuery` — coordinate rather than duplicating the interface or SQL builder.
