---
title: "Backlog Entry: 00022 - Event detail column and severity encoding in the log table"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "improvement"
---
# Backlog Entry: 00022 - Event detail column and severity encoding in the log table

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

All six columns in the log table (timestamp, event, session_id, phase, agent, product_id) are
**envelope metadata**. Every field that distinguishes one event from another — `data.status`
(pass/fail), `data.duration_ms`, `data.severity`, `data.failure_type`, `data.attempt_number` — lives
inside the `data` JSON and is invisible until the row is clicked.

The practical consequence: **a failed `phase_end` renders identically to a passing one.** Finding the
failure in a 50-row page means 50 clicks and 50 raw-JSON reads. Scanning — the thing a log viewer
exists for — does not work.

This was identified as the single highest-leverage improvement available, on the grounds that it is the
only change that improves every page load for every user with no backend work, and that it is a
precondition for the aggregate views in [[00021-surface-aggregate-modes-in-ui]]: a run-summary view
that drills back into an undifferentiated wall of rows has only moved the problem.

## Suggested Action

Add a **Detail** column rendering a per-event-type one-liner derived from `data`, plus a status colour
on the row:

| Event | Rendered detail |
|---|---|
| `phase_end` | `pass · 42.1s` / `fail · 8.3s` |
| `validation_failure` | `lint_error · attempt 3` |
| `security_finding` | `high · <title>` |
| `context_pressure` | `87% fill` |

Row colour: red for `status:fail` and high/critical severity, amber for retries / medium severity /
high `context_fill_pct`, green for pass, neutral otherwise. Colour must not be the only signal — pair
it with a text or glyph indicator for accessibility and for colour-blind users.

`queryEventLog` already returns the full parsed `data` object on every row (`rowToRaw`), so this is
**UI-only with no backend change**. Sized S-M.

Keep the mapping data-driven (a small per-event-type formatter table) so adding an event type does not
mean touching render code, and fall back to a generic summary for unknown types rather than rendering
nothing.

Related smaller wins from the same review, worth folding in if scope allows:

- **Timestamp readability** — the raw DuckDB `timestamp::VARCHAR` (25-29 chars) is the widest column on
  every row and repeats an identical date. Relative time with full value on hover, compact absolute
  once a range is filtered. Note a latent correctness question: `from`/`to` are `datetime-local` inputs
  (no timezone) cast server-side to `TIMESTAMPTZ`, while rendered timestamps carry a zone.
- **Deep-link a single event** — `?event=<id>` to auto-expand and scroll to one event. URL state
  already works for filters/page/sort, but there is no way to share *one* event, which is the unit
  people paste into an issue. Also switch filter/page/sort transitions from `replaceState` to
  `pushState` so Back undoes a filter instead of leaving the app.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. Pure improvement rather than a
defect, so it sits behind the correctness work in this batch — but it is cheap, has no backend
dependency, and is the item most likely to change how the tool feels day to day.
