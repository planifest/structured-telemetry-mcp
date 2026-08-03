---
title: "Backlog Entry: 00014 - Unbounded result sets in failure_sequence and drill_down"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "medium"
---
# Backlog Entry: 00014 - Unbounded result sets in failure_sequence and drill_down

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

Two query modes have no `LIMIT` and materialise every matching row — including the full `data` JSON —
into `aggregation.events`:

- `src/query/failures.ts:158-165` (`failure_sequence`)
- `src/query/token-efficiency.ts:211-218` (`drill_down`)

`{"mode":"failure_sequence","session_id":"<busy-session>"}` against a large session builds the whole
array in memory and JSON-stringifies it in `json()`. Over the MCP path, `src/server-factory.ts:196-198`
stringifies it **twice more**, pretty-printed, into the tool-result text — so a single request can
produce several multiples of the raw row bytes in peak memory, then push all of it into an agent's
context window.

Every other mode is bounded: `event_log` caps at 1000, `distinct_values` at 20, and the aggregate modes
are bounded by group cardinality.

This also feeds the OOM path in [[00013-unbounded-request-body-kills-daemon]] from the *response*
side: memory exhaustion there reaches the same `uncaughtException -> process.exit(1)` handler.

## Suggested Action

- Add an explicit `LIMIT` with a documented default to both modes, consistent with `event_log`'s
  `MAX_LIMIT`, and surface a `truncated: true` flag plus `total_count` so callers can tell a capped
  result from a complete one.
- For the MCP path, cap what is serialised into the tool-result text independently of what the HTTP
  API returns — an agent's context window is the tighter constraint.
- Review whether `failure_sequence` and `drill_down` need the full `data` payload per row at all, or
  whether a projection would serve the actual use case.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. Lower severity than the other
items in this batch because it needs an unusually large single session to bite, and neither mode is
currently reachable from the log viewer UI — but that changes if
[[00021-surface-aggregate-modes-in-ui]] is picked up, so it should be fixed before or with that entry.
