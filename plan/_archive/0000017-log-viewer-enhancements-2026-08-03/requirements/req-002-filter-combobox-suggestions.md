---
title: "Requirement: req-002 - Filter Combobox with Suggestions"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-002 - Filter Combobox with Suggestions

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000017-log-viewer-enhancements
**Source:** US-002
**Priority:** should-have

## User Story

As a developer, I get suggested values as I type into a filter field, so that I can filter accurately without memorizing exact session/event-type/agent strings.

## Functional Requirements

### Backend — distinct-values lookup

- Add a new query family reached via the existing `POST /query` endpoint with `mode: 'distinct_values'` — reuses the same dispatch mechanism `event_log` already uses (`src/server-factory.ts:81-83`, `if (q['mode'] === 'event_log') return qs.eventLog(...)`), rather than adding a dedicated REST route on `server-http.ts`. Justification: no new route/handler wiring in `server-http.ts` is needed (`POST /query` already forwards any body to `dispatchQuery`), it stays consistent with the one existing precedent for a `mode`-keyed query family, and the frontend already has a working `fetch('/query', ...)` helper (`loadEvents()` in `src/ui/index-html.ts:168-186`) to extend rather than duplicate.
- New branch in `dispatchQuery` (`src/server-factory.ts`), checked immediately after the existing `event_log` branch (before the `retry_summary`/`loop_candidates`/... branch at line 85):
  ```ts
  if (q['mode'] === 'distinct_values') {
    return qs.distinctValues(q as unknown as DistinctValuesQuery);
  }
  ```
- New shared allow-list module `src/query/filterable-fields.ts`, exporting:
  ```ts
  export const FILTER_FIELD_COLUMNS: Readonly<Record<string, string>> = {
    session_id: 'session_id',
    initiative_id: 'initiative_id',
    event_type: 'event',
    phase: 'phase',
    agent: 'agent',
    product_id: 'product_id',
  };
  ```
  This maps the six existing filter-field *names* (as already used in `EventLogQuery`/the filter form) to their real DuckDB column names — `event_type` maps to the `event` column, matching `buildWhereClause`'s existing `AND event = $event_type` (`src/query/event-log.ts:117`). All other five names are 1:1 with column names.
- New query module `src/query/distinct-values.ts`:
  ```ts
  export interface DistinctValuesQuery {
    readonly mode: 'distinct_values';
    readonly field: string;
    readonly q?: string;
    readonly limit?: number;
  }

  export async function queryDistinctValues(db: DuckDBInstance, query: DistinctValuesQuery): Promise<QueryResponse>
  ```
  - **Field validation (SQL-injection prevention):** `query.field` MUST be looked up in `FILTER_FIELD_COLUMNS` before any SQL is built. If `query.field` is not a key of `FILTER_FIELD_COLUMNS`, throw `Error('Invalid field: "${query.field}". Valid values: ${Object.keys(FILTER_FIELD_COLUMNS).join(', ')}')` — mirroring the existing `Invalid group_by` validation pattern in `dispatchQuery` (`src/server-factory.ts:110-115`) — and never interpolate `query.field` (or any other user-supplied string) directly into the SQL column position. Only the *resolved column name from the allow-list* (`FILTER_FIELD_COLUMNS[query.field]`) is interpolated into the SQL text; the user-typed substring (`query.q`) is always passed as a bound parameter, never concatenated into SQL text.
  - **SQL shape** (column name resolved from the allow-list, substituted into the template; everything else bound):
    ```sql
    SELECT DISTINCT {column} AS value
    FROM events
    WHERE {column} IS NOT NULL
      AND {column} ILIKE $q
    ORDER BY {column}
    LIMIT {limit}
    ```
    where `{column}` = `FILTER_FIELD_COLUMNS[query.field]` (never `query.field` itself), and the `AND {column} ILIKE $q` clause is omitted entirely when `query.q` is absent/empty (so an empty/focus-triggered lookup returns the top N distinct values unfiltered).
  - **Match strategy:** case-insensitive **prefix** match. `$q` is bound as `` `${query.q}%` `` (the `%` suffix appended in application code, not by string-concatenating into the SQL). Prefix match is chosen over substring match because: (a) it matches conventional autocomplete/combobox UX — users type from the start of a known value, (b) it produces a stable, predictable suggestion order (`ORDER BY {column}` naturally clusters on the typed prefix), and (c) it avoids the pathological "everything matches" noise a bare substring match produces on short 1–2 character queries against UUID-like `session_id`/`initiative_id` values.
  - **Limit:** `{limit}` = `Math.min(Math.max(1, Number(query.limit ?? 20)), 20)` computed in application code (never a raw string) — default and hard cap of **20 suggestions per field**, matching `queryEventLog`'s existing pattern of computing `limit`/`offset` in code before interpolating a validated number (`src/query/event-log.ts:36-38`).
  - **Response shape**, built via the existing `buildQueryResponse` helper (`src/query/format-results.ts:26-38`) so it matches every other query family's `{markdown, json, rawSample}` envelope:
    - `headers`: `['Value']`, `rows`: `values.map(v => [v])`
    - `rawSample`: `values.slice(0, 5).map(v => ({ value: v }))`
    - `aggregation` (→ `json`): `{ mode: 'distinct_values', field: query.field, values }`
- `IQueryService` (`src/query/query-service.ts:16-21`) gains a fourth method:
  ```ts
  distinctValues(query: DistinctValuesQuery): Promise<QueryResponse>;
  ```
  implemented on `DuckDbQueryService` (`src/query/query-service.ts:23-41`) as `distinctValues(query) { return queryDistinctValues(this.db, query); }`, following the exact same one-line delegation pattern as `eventLog()`.

### Frontend — combobox UI

- Convert each of the six existing plain `<input>` filter fields in `<form id="filters">` (`src/ui/index-html.ts:45-62`: `f-session_id`, `f-initiative_id`, `f-event_type`, `f-phase`, `f-agent`, `f-product_id`) into a combobox using the native `<datalist>` element — **not** a hand-built dropdown. Justification: `<datalist>` requires no new dependency (ADR-018), no custom focus/keyboard/ARIA management code (the browser supplies all of that natively), and needs only one new attribute (`list="dl-{field}"`) plus a sibling `<datalist id="dl-{field}">` per field — the smallest possible diff against the existing plain-`<input>` markup. Trade-off accepted: `<datalist>` suggestion-list styling and exact match-highlighting behavior are browser-controlled and not customizable; this is acceptable for an internal single-developer tool.
- `from`/`to` (`f-from`, `f-to`, `datetime-local` inputs) are explicitly **excluded** — they are date/time pickers, not text comboboxes, and are not in `FILTER_FIELD_COLUMNS`.
- For each of the six fields, add a `<datalist id="dl-{field}"></datalist>` sibling next to the input, and add `list="dl-{field}"` to the corresponding `<input id="f-{field}">`.
- Suggestion fetch is triggered on two events per field, both calling a shared `fetchSuggestions(field, q)` helper that POSTs `{ mode: 'distinct_values', field, q }` to `/query` and repopulates that field's `<datalist>` with `<option value="...">` elements from the response `json.values`:
  - `focus` — fires immediately with `q: ''` (empty), so a field that's empty on focus shows the top 20 distinct values before the user types anything.
  - `input` — **debounced 200ms** (clear/reset a per-field `setTimeout` on every keystroke), fires with `q` = the input's current trimmed value.
- A response with zero `values` (e.g. `product_id` before backlog #00002 lands, or any field with no matching prefix) simply leaves that field's `<datalist>` empty — the underlying `<input>` remains a fully-functional plain free-text field. This is expected behavior, not an error state; no banner, no console error.
- A failed suggestion fetch (network error, non-2xx response) is caught and silently ignored (leaves the previous `<datalist>` contents, or empty, in place) — it must never throw, block typing, or interfere with the existing `showBanner`/filter-submit error path used for the main `/query` event-log fetch (`src/ui/index-html.ts:237-243`). Suggestion lookups and the main event-log query are independent fetches; a suggestion-fetch failure has no effect on the table/banner state.
- No new frontend dependency, build step, or bundler is introduced (ADR-018 unchanged) — `fetchSuggestions` is added as a plain function in the existing `<script type="module">` block (`src/ui/index-html.ts:105` onward), using the same `fetch('/query', { method: 'POST', ... })` shape already used by `loadEvents()`.

## Acceptance Criteria

- [ ] `POST /query` with `{ mode: 'distinct_values', field: 'agent' }` returns up to 20 distinct non-null `agent` values, alphabetically ordered, in `json.values`
- [ ] `POST /query` with `{ mode: 'distinct_values', field: 'session_id', q: 'abc' }` returns only `session_id` values whose value starts with `abc` (case-insensitive)
- [ ] `POST /query` with `{ mode: 'distinct_values', field: 'not_a_real_field' }` throws/returns an error (`{ ok: false, errors: [...] }`, HTTP 400) instead of running any SQL — verifies the allow-list rejects unrecognised field names before query construction
- [ ] `POST /query` with `{ mode: 'distinct_values', field: 'timestamp' }` is also rejected — `timestamp` is not one of the six filterable fields exposed by the filter form, even though it will be a valid sort field for req-003
- [ ] Each of `f-session_id`, `f-initiative_id`, `f-event_type`, `f-phase`, `f-agent`, `f-product_id` has an associated `<datalist>` (`dl-session_id`, etc.) wired via the `list` attribute
- [ ] Focusing an empty filter input populates its `<datalist>` with up to 20 suggested values without the user typing anything
- [ ] Typing into a filter input triggers at most one suggestion fetch per 200ms of pause (debounced), narrowing suggestions to values starting with the typed text
- [ ] `f-from` and `f-to` have no `<datalist>`/suggestion wiring — unaffected by this requirement
- [ ] A field with zero matching/existing suggestions (e.g. `product_id` pre-backlog-#00002) leaves the input fully usable as free text — no error, no blocked typing, no banner shown
- [ ] A suggestion-fetch network failure does not trigger the existing `showBanner` error path and does not affect the event table or pager state
- [ ] Selecting a suggested value from a `<datalist>` and submitting the filter form filters the table exactly as if the same value had been typed manually (no behavioral difference from free text)

## Dependencies

- Shares `index-html.ts` filter-state management functions (`readFormIntoFilters`, `applyStateToForm`, `readStateFromUrl`/`writeStateToUrl`, the `FILTER_KEYS` array) with req-001 (auto-refresh) and req-003 (sortable headers) — all three requirements touch the same `<form id="filters">` and `currentState` object in `src/ui/index-html.ts`; this requirement only adds `list`/`<datalist>` wiring and does not change the shape of `currentState.filters`.
- **Shared allow-list coordination with req-003 (sortable headers, drafted separately):** req-003 needs its own allow-list for the `ORDER BY` field (per `build-log.md` P1 exchange: `timestamp, event, session_id, phase, agent, product_id`) to prevent the same class of SQL-injection-via-column-name risk this requirement addresses for `SELECT DISTINCT`. The two allow-lists are not identical sets (sort includes `timestamp` but not `initiative_id`; suggestions include `initiative_id` but not `timestamp`), but both map a client-supplied field *name* to a trusted DB *column name* for the same six-column `events` table. Both requirements should define/reuse **one shared** field→column map (this requirement proposes it as `FILTER_FIELD_COLUMNS` in `src/query/filterable-fields.ts`) rather than two independently hand-written literal-to-column mappings that could silently drift apart (e.g. one gets updated for a renamed column, the other doesn't). Recommend req-003 either extends `FILTER_FIELD_COLUMNS` with `timestamp` (renaming the module/export to something field-agnostic if needed) or imports it and adds its own `timestamp`-only extension on top — final call belongs to whichever requirement/PR lands first; this is a coordination note, not a blocking dependency (each requirement's allow-list check is independently correct on its own even without sharing the module, just duplicative).
- Depends on `src/query/format-results.ts`'s `buildQueryResponse` (existing, unchanged) for response shaping — no changes needed to that module.

## Input Validation

- [ ] Input source: HTTP POST body fields `field` and `q` on `POST /query` (`mode: 'distinct_values'`) — client-controlled, arriving from browser `fetch()` calls ultimately driven by user keystrokes in the filter inputs
- [ ] Allowed character pattern: `field` — not a character-class pattern but exact membership in the `FILTER_FIELD_COLUMNS` allow-list (`session_id`, `initiative_id`, `event_type`, `phase`, `agent`, `product_id`); `q` — no character stripping, since `q` is only ever used as a bound SQL parameter (never string-concatenated into SQL text) and only ever rendered into `<option value="...">` via safe DOM property assignment (never `innerHTML`), so both injection surfaces (SQL and DOM/XSS) are closed structurally rather than by input filtering
- [ ] Maximum length: `q` truncated to 200 characters before use (guards against pathologically large request bodies feeding into the bound parameter); `field` has no length limit beyond the allow-list membership check itself
- [ ] Failure behaviour: unrecognised `field` → thrown `Error`, caught by the existing `POST /query` handler's try/catch (`src/server-http.ts:120-129`), returned as HTTP 400 `{ ok: false, errors: [...] }` — never a 500 or an unhandled crash, consistent with every other query-family validation error (e.g. the existing `Invalid group_by` and `event_log limit must not exceed` errors)
- [ ] Logging policy: raw `field`/`q` values are not logged — this endpoint has no dedicated logging path beyond the existing top-level `uncaughtException`/`unhandledRejection` stderr handlers (`src/server-http.ts:47-54`), which are unaffected by this requirement
