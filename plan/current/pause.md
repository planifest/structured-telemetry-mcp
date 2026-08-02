---
phase: "P0"
active_task: "Coaching Q&A for 0000017-log-viewer-enhancements — procedural pre-flight confirmed, substantive coaching (problem statement, acceptance criteria, stack, scope, NFRs) and Scope Lock Challenge still outstanding"
last_artifact: "plan/backlog/00004-aggregation-dashboard-views/entry.md"
---
# Pause Record - 0000017-log-viewer-enhancements

**Paused:** 2026-08-02T00:00:00Z
**Phase:** P0 — Assess & Coach

## In-Progress State

Feature: 0000017-log-viewer-enhancements — Wave 1 of a two-wave follow-on to 0000015-telemetry-log-viewer-ui.

**Confirmed so far (all recorded in `plan/current/build-log.md` P0 exchanges):**
- Adoption mode: Standard Iterative
- Version bump: 0.12.0 → 0.13.0 (minor, Feature Pipeline)
- Feature ID / branch: `0000017-log-viewer-enhancements` / `feat/0000017-log-viewer-enhancements`
- Backlog #00001 (Linux hardware verification) and #00002 (framework product_id emission): both left untouched, no pickup
- Wave split confirmed:
  - **Wave 1 (this feature, this pipeline run):** live auto-refresh/tail mode, filter dropdown/free-text combobox (suggests existing values as the user types), sortable table column headers (click to toggle asc/desc, right-aligned arrow only on the sorted column, two-way sync with the existing sort-field dropdown + direction control)
  - **Wave 2 (deferred):** aggregation/dashboard views (bottleneck/failure/token-efficiency charts) — filed as `plan/backlog/00004-aggregation-dashboard-views/entry.md` per explicit human request. Needs its own future pipeline run and an ADR-018 revisit.
- The list's blank 5th bullet was human error — disregard, not part of scope.
- Human is separately committing `planifest-framework/` updates under the framework-update-policy override, in parallel with this feature branch — explicitly out of scope for this feature's run docs, nothing to track here.

**Not yet done — resume here:**
1. Substantive P0 coaching, in priority order, for the 3 Wave 1 items:
   - Problem statement / user stories (As a / I / so that) for each of: live refresh, filter combobox, sortable headers
   - Acceptance criteria per item
   - Stack declaration — almost certainly inherited as-is from 0000015 (single component `structured-telemetry-mcp`, vanilla JS/DOM `/ui` page served in-process by `server-http.ts`, no new dependencies expected) but must be explicitly confirmed, not assumed
   - Scope boundaries doc (in / out / deferred) — note aggregation views are OUT (deferred to backlog #00004)
   - NFRs (at least one measurable target)
   - Component design — likely no new components, all within existing `structured-telemetry-mcp`
   - Risks — note the `product_id` combobox-suggestion risk (values still show "unknown" until backlog #00002 lands, per ADR-017/ADR-019)
2. Scope Lock Challenge — all 4 scenario paths (happy / first-run / error / cross-session) not yet asked
3. Run-mode question (interactive vs continuous run) — not yet asked; `plan/.run-mode` not yet written
4. Produce Skill Map and `plan/current/design.md` (read `design.template.md` first), present for human confirmation
5. Once confirmed: commit `design.md` + `feature-brief.md` (feature-brief.md itself also not yet written — should be authored from this pause record + the original human scope list before/during resumed coaching), then proceed to P1

**Git state:** branch `feat/0000017-log-viewer-enhancements` created off `main` (which was reset back to match `origin/main` — the P0 discovery commit that had briefly landed on `main` now lives only on this feature branch). Working tree on this branch has the P0 artifacts below, not yet committed as of this pause.

## Resume Instructions

On next session start, the orchestrator will detect this file and open with:

```
P0: Resuming — Coaching Q&A for 0000017-log-viewer-enhancements — procedural pre-flight confirmed, substantive coaching and Scope Lock Challenge still outstanding
```

After re-reading this file, continue from the in-progress state above — go straight to problem statement / user stories coaching for the 3 Wave 1 items, one question at a time. Delete this file once the interrupted task has been re-engaged.
