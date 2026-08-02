# Test Coverage Summary — structured-telemetry-mcp

Snapshot at 0.12.0 (`0000016-e2e-playwright-test-suites`).

## Totals

| Category | Count |
|----------|-------|
| Unit (`tests/unit/`) | 146 |
| Integration (`tests/integration/`) | 78 |
| Regression (`tests/regression/`) | 137 |
| Performance (`tests/performance.test.ts`) | 1 |
| E2E (`tests/e2e/`, `@playwright/test`, Chromium-only) | 17 |
| **Total** | **379** |

Baseline before this feature: 362 (as of 0.11.0 / `0000015`). Growth this feature: +17 — 9 backend E2E tests (`tests/e2e/backend/emit-query-health.spec.ts`) and 8 UI E2E tests (`tests/e2e/ui/log-viewer.spec.ts`), all against a real running server + ephemeral DuckDB per run. No existing test was modified.

Performance gate: p95 < 100ms (CI-tolerant; Windows GH runners measured ~28ms p95) — unaffected by this feature. E2E suite runtime (NFR-001, p95 < 5 min for both suites combined): measured at ~2.8s combined during P4, far under budget.

## What's covered by automated tests (this feature)

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
