# Test Coverage Summary — structured-telemetry-mcp

Snapshot at 0.13.0 (`0000017-log-viewer-enhancements`).

## Totals

| Category | Count |
|----------|-------|
| Unit (`tests/unit/`) | 179 |
| Integration (`tests/integration/`) | 88 |
| Regression (`tests/regression/`) | 137 |
| Performance (`tests/performance.test.ts`) | 1 |
| E2E (`tests/e2e/`, `@playwright/test`, Chromium-only) | 22 |
| **Total** | **427** |

405 of the total are Vitest tests (179 + 88 + 137 + 1); the remaining 22 are Playwright E2E — 9 backend (`tests/e2e/backend/emit-query-health.spec.ts`, unchanged this feature) + 13 UI (`tests/e2e/ui/log-viewer.spec.ts`).

Baseline before this feature: 379 (as of 0.12.0 / `0000016`). Growth this feature: +48 — new unit/integration coverage for the shared allow-list (`tests/unit/column-allow-list.test.ts`, ADR-024), `event_log`'s `sortField` (`tests/integration/query-telemetry.test.ts`, ADR-025), and the new `distinct_values` mode (`tests/integration/distinct-values.test.ts`, ADR-026), plus 5 new Playwright UI E2E tests covering auto-refresh, filter suggestions, and sortable headers — including a post-implementation-review fix (`pollForUpdates()` not revealing the table on a zero-to-nonzero transition). No pre-existing test was modified.

Performance gate: p95 < 100ms (CI-tolerant; Windows GH runners measured ~28ms p95) — unaffected by 0000016/0000017. `event_log`'s new `sortField` and the new `distinct_values` mode (NFR-001, p95 < 300ms per poll/query) measured well within budget at P4 against local DuckDB. E2E suite runtime (NFR-001 of 0000016, p95 < 5 min for both suites combined): measured at ~2.8s combined during P4, far under budget.

## What's covered by automated tests (0000017)

- `event_log`'s `sortField` param — allow-listed values sort correctly per column, default (`timestamp`) preserved when omitted, non-allow-listed/injection-shaped input rejected — `tests/unit/column-allow-list.test.ts`, `tests/integration/query-telemetry.test.ts`
- `distinct_values` query mode — allow-listed field lookup, prefix-match `q` param, rejection of non-allow-listed fields — `tests/integration/distinct-values.test.ts`
- Log Viewer UI auto-refresh (start/stop, URL-persisted toggle, no table blank/scroll loss, poll-failure degradation), filter-combobox suggestions, and clickable sortable headers (three-way sync with dropdown + URL) — `tests/unit/ui.test.ts`, `tests/e2e/ui/log-viewer.spec.ts`

## What's covered by automated tests (0000016)

- `POST /emit` — valid envelope accepted and retrievable via `POST /query`; schema-invalid envelope rejected (400) and not persisted — `tests/e2e/backend/emit-query-health.spec.ts`
- `POST /query` (`event_log` mode) — filtering by phase/agent/product_id/from-to, pagination (limit/offset/total_count), sort asc/desc — `tests/e2e/backend/emit-query-health.spec.ts`
- `GET /health` — liveness check over real HTTP — `tests/e2e/backend/emit-query-health.spec.ts`
- `GET /ui` — page load/render, every filter (phase/agent/product_id/date range) narrows results and updates URL state, pagination controls, zero-result state, row-click JSON detail expansion with no new network request — `tests/e2e/ui/log-viewer.spec.ts`, real Chromium browser

## What changed from "manual verification only" (0000015 → 0000016)

- **Resolved:** "The Log Viewer UI's actual `GET /ui` route wiring and end-to-end browser behavior" was previously verified manually only (0000015). It is now covered by automated, CI-blocking E2E tests (`tests/e2e/ui/log-viewer.spec.ts`) — see `quirks.md` for the full before/after.
- **Resolved:** "`server-http.ts` has no HTTP-level test coverage anywhere in this project" (0000015 quirk) — now covered for `/emit`, `/query`, `/health` by `tests/e2e/backend/emit-query-health.spec.ts`, which starts the real process and issues real HTTP requests.

## What's still covered by manual verification only (unchanged by this feature)

- `scripts/service-macos.sh` — `launchctl list`, `curl /health`, reboot/logout survival (per `plan/_archive/0000010-macos-launchd-service-2026-07-19/design.md`'s declared testing strategy; no shell-script test harness exists in this repo).
- `scripts/service-linux.sh` — same manual strategy, **and additionally untested against any real systemd hardware** (risk-register R-002) — the highest-priority open item from `0000010`, out of scope for this feature.
