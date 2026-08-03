---
title: "Risk Register - log-viewer-enhancements"
summary: "Technical, operational, and security risks with their mitigations."
status: "active"
version: "0.1.0"
---
# Risk Register - log-viewer-enhancements

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md) (updated by any agent that identifies a new risk)
**Feature:** 0000017-log-viewer-enhancements
**Version:** 0.13.0
**Overall Risk Level:** medium

## Risks

| ID | Category | Description | Likelihood | Impact | Mitigation | Status |
|----|----------|------------|------------|--------|-----------|--------|
| R-001 | security | The sort-field change (req-003) is bigger than originally scoped: `queryEventLog` currently hardcodes `ORDER BY timestamp` with only a direction toggle (`src/query/event-log.ts:41,54`) — no field selector exists. Building real per-column sort needs a new sort-field query param, and req-002's new distinct-values suggestion lookup needs a similar per-field `SELECT DISTINCT {field}` construction. DuckDB, like most SQL engines, has no parameterized-identifier binding — only value placeholders (the existing `$session_id`-style params in `buildWhereClause`, `event-log.ts:104-142`, only bind values, not column names). If either the sort-field or the suggestion-field param is string-interpolated into SQL without a strict allow-list, both the new `ORDER BY` construction and the new `DISTINCT` column construction are SQL-injection vectors. | medium | high | Implement one shared, exported allow-list of permitted column identifiers (`timestamp`, `event`, `session_id`, `initiative_id`, `phase`, `agent`, `product_id`) and validate against it before any interpolation, in both the sort-field `ORDER BY` path and the suggestion endpoint's `DISTINCT` column path. Reject (or silently ignore, falling back to default) any value not in the allow-list. Add regression tests asserting rejection of non-allow-listed and injection-shaped input on both endpoints. | open |
| R-002 | technical | All three requirements (req-001 auto-refresh, req-002 filter combobox, req-003 sortable headers) modify the same shared state-management functions in the single `src/ui/index-html.ts` embedded script — `readStateFromUrl` (line 108), `writeStateToUrl` (line 123), `applyStateToForm` (line 134), and `readFormIntoFilters` (line 143) — plus the shared `FILTER_KEYS` array (line 106) and the `currentState` object. Building these independently (e.g. via parallel subagents, per the human's P0 request to parallelize where safe) risks conflicting or silently-overwriting edits to the same functions, since each requirement adds new state fields (`autoRefresh`, `sortField`, suggestion cache) through the same choke points. | high | medium | Treat the four shared state functions as one integrated edit, not three independent parallel edits to the same file. If subagent parallelism is used, split along a seam that doesn't cross these functions (e.g. backend allow-list work vs. frontend UI work), or have a single agent own the full `index-html.ts` state-management integration pass. | open |
| R-003 | operational | Filter-combobox suggestions (req-002) for `product_id` will show "unknown" / no suggestions for historical rows and any emitter not yet updated, until backlog #00002 (framework-side `product_id` emission) lands. Carried forward unchanged from 0000015 (its R-006). | certain | low | Explicitly accepted, documented in scope.md Out of Scope and this risk register; combobox falls back to plain free-text entry when suggestions are empty, per the accepted error-path scenario. Not a defect. | accepted |
| R-004 | technical | Runtime poll-failure behavior during an active auto-refresh session (a transient server/query failure mid-poll) was not part of the feature's originally pre-confirmed scope. It was extended by inference from the "degrade gracefully, never block" principle already confirmed for malformed URL params, drafted by the scope-lock-agent, and accepted by the human without a from-scratch confirmation (build-log.md P0 error/sad-path exchange). | low | low | Implement per the accepted spec: keep last successful results visible (never blank the table), show a small non-blocking failure indicator, keep retrying on the next interval (never silently disable auto-refresh). Add a test simulating a failed poll mid-session to confirm this behavior. | accepted |

## Assumptions Logged as Risks

Documented assumptions from the specification are logged here with likelihood: medium.

| ID | Assumption | Impact if Wrong | Status |
|----|-----------|----------------|--------|
| A-001 | Polling (not WebSocket/SSE push) is sufficient for "live" auto-refresh at local single-developer data volumes | Revisit a push-based approach if poll latency/load becomes noticeable | open |
| A-002 | Distinct filter-value suggestions can be served from the existing `events` table with a lightweight `SELECT DISTINCT` query, without a new index | May need an index or a cached/precomputed values list if suggestion queries are slow at scale | open |
