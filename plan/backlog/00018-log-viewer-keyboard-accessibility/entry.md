---
title: "Backlog Entry: 00018 - Log viewer is not keyboard operable and exposes no state to assistive tech"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "medium"
---
# Backlog Entry: 00018 - Log viewer is not keyboard operable and exposes no state to assistive tech

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

In `src/ui/index-html.ts`:

**1. Event rows are mouse-only; the JSON payload is unreachable by keyboard.** `:299-323` gives
`<tr class="event-row">` a `cursor: pointer` and a bare `click` listener — no `tabindex`, no `role`, no
key handler, no `aria-expanded`, and the detail row is toggled via `style.display` with no programmatic
association to its trigger. A keyboard-only user can filter, sort and paginate but has **no way at all**
to open an event's payload. Unlike sorting, there is no alternative control.

**2. Sortable headers are mouse-only and expose no sort state.** `:115-120` / `:489-502`:
`<th class="th-sort">` has no `tabindex`, no `role="button"`, no `keydown` handler, and no `aria-sort`.
`updateSortIndicators` (`:224-231`) communicates sort purely by appending a `▲`/`▼` glyph to
`textContent`, so a screen reader announces "Agent black down-pointing triangle" rather than a sort
state. Header sorting is unreachable by keyboard; the `<select>` is the only path.

**3. No live regions.** `#banner` (`:42`) has no `role="alert"`; `#status` (`:110`) and
`#auto-refresh-status` (`:111`) have no `aria-live`. A screen-reader user submits a filter and hears
nothing — not "Loading...", not "No matching events", not the backend-unreachable banner, and none of
the 5-second auto-refresh updates. The page appears inert.

**4. Clear buttons have no accessible name.** The eight `x` buttons (`:46,50,54,58,62,66,70,73`) render
`&times;` with no `aria-label` or `title`, so they are announced as eight identical "multiplication
sign, button" controls.

Note: the filter combobox itself is a native `<datalist>` (req-002, deliberate), so the browser supplies
its ARIA and keyboard behaviour — that part is correct and is not in scope here.

## Suggested Action

- Make rows focusable and operable: `tabindex="0"`, an appropriate role, Enter/Space to toggle,
  `aria-expanded`, and `aria-controls` pointing at the detail row.
- Make headers real buttons: focusable, Enter/Space activated, with `aria-sort` set to
  `ascending`/`descending`/`none` and the glyph marked `aria-hidden` as pure decoration.
- Add `role="alert"` to the banner and `aria-live="polite"` to `#status` /
  `#auto-refresh-status`. Take care that a 5-second poll does not produce continuous announcements —
  announce only on change.
- Give each clear button an `aria-label` naming its field.
- Consider folding in the power-user keyboard shortcuts from the UX review (`j`/`k` to move, Enter to
  expand, `/` to focus filters, `n`/`p` for pages) — the focus management needed for (1) and (2) is
  most of that work.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. Item (1) is a genuine
accessibility defect rather than a nicety — a whole feature is unreachable — but the work is
self-contained and does not block the correctness fixes filed alongside it.
