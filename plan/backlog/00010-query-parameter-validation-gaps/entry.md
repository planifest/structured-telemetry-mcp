---
title: "Backlog Entry: 00010 - Query parameter validation gaps, including a silent wrong answer in trend mode"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "high"
---
# Backlog Entry: 00010 - Query parameter validation gaps, including a silent wrong answer in trend mode

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

`POST /query` parses arbitrary JSON and passes it straight to `dispatchQuery`
(`src/server-factory.ts:77`) with no type coercion or range validation. The MCP path's `QueryShape`
zod gate (`src/server-factory.ts:61-69`) is **bypassed entirely over HTTP**, which is the path the log
viewer uses.

All of the following were reproduced against a live 0.13.0 daemon:

| Payload | Actual result |
|---|---|
| `{"mode":"event_log","limit":"abc"}` | `Number("abc")` -> `NaN`; `NaN > MAX_LIMIT` is **false**, so the cap at `event-log.ts:40` never fires -> `LIMIT NaN` reaches DuckDB -> full SQL text returned to caller |
| `{"mode":"event_log","limit":-5}` | `LIMIT/OFFSET cannot be negative` — no server-side guard (`event-log.ts:39`) |
| `{"mode":"event_log","limit":1.5}` | **Accepted**, returns rows — non-integer limits silently round |
| `{"mode":"event_log","offset":1e21}` | Conversion error; `offset` (`event-log.ts:43`) has **no cap and no validation at all** |
| `{"mode":"loop_candidates","loop_threshold":"abc"}` | `failures.ts:121` -> `WHERE consecutive_count >= NaN` |
| `{"mode":"trend","limit":-5}` | **HTTP 200, `{"mode":"trend","limit_days":-5,"results":[]}`** |

The `trend` case is the most serious. `token-efficiency.ts:172` builds `now() - INTERVAL '-5 days'`,
which is a **future** cutoff, so the endpoint reports "no context-pressure trend data" while data
exists — a wrong answer returned with a success status and no error anywhere. That is the worst
failure class in this backlog after the two criticals: nothing signals that the result is untrue.

`{"mode":"trend","limit":"abc"}` is similar but noisier: `INTERVAL 'NaN days'` errors only when rows
match the filter, and returns a clean empty result otherwise.

## Suggested Action

Validate and coerce at the HTTP boundary, before any query builder runs, so both the MCP and HTTP paths
share one gate:

- `limit` / `offset` / `loop_threshold`: require `Number.isInteger`, reject `< 0`, clamp `limit` to
  `MAX_LIMIT`, and apply a sane `offset` ceiling.
- Reject `NaN` explicitly rather than relying on comparisons, which silently pass for `NaN`.
- `trend.limit` (days): require a positive integer.
- Reuse the existing `QueryShape` zod schema on the HTTP path instead of maintaining two levels of
  rigour for the same surface.

Return a structured `{ok:false, errors:[...]}` naming the offending field — never the DuckDB message
(see [[00011-query-errors-leak-sql-and-data]]).

Regression tests must cover the boundary values in the table above, in particular asserting that
`trend` with a non-positive limit is **rejected** rather than returning an empty success.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. Naturally pairs with
[[00011-query-errors-leak-sql-and-data]] — both are HTTP-boundary hardening on the same handler and
should likely be scoped into one change.
