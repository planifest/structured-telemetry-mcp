---
title: "Backlog Entry: 00021 - Surface the existing aggregate query modes in the UI"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "improvement"
---
# Backlog Entry: 00021 - Surface the existing aggregate query modes in the UI

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

The core question this product exists to answer — *why was this run slow, where did it fail, what did
it cost* — **cannot be answered end-to-end in the UI today.** The only path is to filter to a session,
hand-expand every `phase_end` row, and mentally sum `duration_ms`.

The striking part is that the backend already does all of it. Three aggregate families are implemented
and already routed over HTTP via `dispatchQuery` (`src/server-factory.ts:55-120`), and the UI **never
calls any of them**:

| Mode | Capability |
|---|---|
| `bottlenecks` | `group_by` phase / agent / tool / run_id / content_type / mcp_mode / initiative_id -> avg + p95 duration, success_rate_pct, total_events |
| `failures` | `retry_summary`, `loop_candidates`, `failure_sequence`, `failure_cluster` |
| `token_efficiency` | `context_pressure`, `mcp_impact`, `request_volume`, `trend`, `drill_down` |

Every one is reachable from the browser today with a `POST /query`. The gap is purely presentational.

This overlaps [[00004-aggregation-dashboard-views]], which is already filed — but that entry frames the
work as charts and states that the aggregation query layer needs designing and that ADR-018 (vanilla
JS, no framework) should be revisited first. **Both premises are heavier than the facts require.** The
query layer exists and is routed; and plain sorted tables answer all four user questions without
reversing ADR-018 at all.

## Suggested Action

Re-scope rather than duplicate: treat this entry as a correction to
[[00004-aggregation-dashboard-views]] and fold the two together at pickup.

Add a run-scoped diagnostic panel built as plain sorted tables — no charts, no framework:

- `bottlenecks group_by=phase|agent|tool` scoped to the selected `run_id` / `session_id`
- `failures mode=retry_summary`
- `token_efficiency mode=context_pressure`

Reach it from the existing event log by selecting a session, so it composes with the filters already
there. Defer charts until the tables prove insufficient — that is an evidence question, not a
foundational one.

**Precondition:** `failure_sequence` and `drill_down` currently have no `LIMIT`
([[00014-unbounded-result-sets]]). Those modes become reachable from the browser for the first time
under this entry, so that fix should land first or together.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. Sized M and UI-only, but it
should be sequenced behind the correctness and durability work in this batch — an aggregate view built
on pagination that drops 26-45% of rows ([[00009-event-log-pagination-drops-rows]]) would inherit those
wrong answers and present them with more authority.
