---
title: "Backlog Entry: 00009 - Event log pagination silently drops and duplicates rows"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "critical"
---
# Backlog Entry: 00009 - Event log pagination silently drops and duplicates rows

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

`src/query/event-log.ts:62` orders results with no unique tiebreaker:

```sql
ORDER BY ${sortColumn} ${sortDirection}
LIMIT ${limit}
OFFSET ${offset}
```

Every field in `SORTABLE_FIELDS` is non-unique (`timestamp`, `event`, `session_id`, `phase`, `agent`,
`product_id`), and DuckDB's parallel sort is not stable across separate query executions. Each page is
therefore computed from an **independently ordered** result set, so rows shift between pages.

Measured over 2,005 rows, paging `limit:50` through `offset:0..2000` — exactly the access pattern the
log viewer uses (`src/ui/index-html.ts:250-253`):

| sortField | unique rows seen | duplicated | never shown |
|---|---|---|---|
| `timestamp` (default) | 1480 / 2005 | 525 | **525 (26%)** |
| `event` | 1147 / 2005 | 858 | **858 (43%)** |
| `session_id` | 1216 / 2005 | 789 | 789 |
| `phase` | 1168 / 2005 | 837 | 837 |
| `agent` | 1211 / 2005 | 794 | 794 |
| `product_id` | 1104 / 2005 | 901 | **901 (45%)** |

The failure is silent and actively misleading: `total_count` is correct, the pager renders the right
number of pages, and no error is shown. A user paging through the log to find a `validation_failure`
can be told with full confidence that it does not exist.

This affects the default view. ADR-025 (per-column sort, shipped in 0000017) did not introduce the
instability — the default `timestamp` sort was already affected — but it multiplied the exposure across
six sort fields, and the worst-affected column (`product_id`, 45%) is one of the new ones.

Confirmed by direct code reading; the measurements above were produced against a DuckDB instance
loaded with representative data.

## Suggested Action

Append a unique tiebreaker to every ORDER BY in `queryEventLog`, e.g.:

```sql
ORDER BY ${sortColumn} ${sortDirection}, id ASC
```

`id` is the primary key, so this makes the total order deterministic for every sort field and both
directions.

Consider keyset (cursor) pagination as a follow-on: it is immune to this class of bug, avoids
`OFFSET`'s cost on deep pages, and is stable when new events arrive mid-paging — which matters
because the viewer polls a live, growing table.

Audit the other query modes for the same pattern before closing.

**Regression test must assert ordering, not markup.** Seed rows with duplicate values in the sort
column, page through the full set, and assert the union of pages equals the source set exactly with no
duplicates. The current e2e sort tests (`tests/e2e/ui/log-viewer.spec.ts:98-131`) assert URL params and
the arrow glyph only, and would pass even if the backend ignored `sortField` entirely.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. Small, well-understood fix,
but it is a silent-wrong-answer defect in a shipped feature and warrants its own change with a proper
regression test rather than being bundled opportunistically.
