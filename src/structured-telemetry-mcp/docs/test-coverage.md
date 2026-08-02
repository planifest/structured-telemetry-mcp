# Test Coverage Summary — structured-telemetry-mcp

Snapshot at 0.11.0 (`0000015-telemetry-log-viewer-ui`).

## Totals

| Category | Count |
|----------|-------|
| Unit (`tests/unit/`) | 146 |
| Integration (`tests/integration/`) | 78 |
| Regression (`tests/regression/`) | 137 |
| Performance (`tests/performance.test.ts`) | 1 |
| **Total** | **362** |

Baseline before this feature: 332 (as of 0.10.4 / `0000014`). Growth this feature: +30 — `product_id` schema/repository round-trip tests, expanded `event_log` coverage (offset/sort/total_count/max-limit/new filters), the new `tests/unit/ui.test.ts` (Log Viewer UI content/structure), and the two semantic-coverage gaps closed during P4 (NULL `product_id` display, no-extra-fetch-on-click).

Performance gate: p95 < 100ms (CI-tolerant; Windows GH runners measured ~28ms p95) — unaffected by this feature. Separately, `event_log`'s NFR-001 (p95 < 300ms) was empirically measured during P5 (missed at P4): p95 = 2.28ms unfiltered / 1.26ms filtered, against 5000 seeded rows — see `plan/_archive/0000015-telemetry-log-viewer-ui-2026-08-01/security-report.md`.

## What's covered by automated tests (this feature)

- `product_id` validation/storage with and without a value — `tests/unit/validation.test.ts`, `tests/integration/emit-event.test.ts`
- `event_log`: no-scope-required, offset pagination + `total_count`, sort asc/desc, max-limit rejection, phase/agent/product_id/from-to filters — `tests/integration/query-telemetry.test.ts`
- 3 pre-existing tests updated from the old mandatory-scope-filter contract to the new one — `tests/unit/server-factory.test.ts`, `tests/regression/query-routing.test.ts`, `tests/integration/query-telemetry.test.ts`
- Log Viewer UI structure and behavior (filter controls, URL-state persistence, detail view, empty/error states) — `tests/unit/ui.test.ts` (content-level, since `server-http.ts` has no HTTP-level test coverage anywhere in this project — see `quirks.md`)

## What's covered by manual verification only (documented deviation, see `quirks.md`)

- `scripts/service-macos.sh` — `launchctl list`, `curl /health`, reboot/logout survival (per `plan/_archive/0000010-macos-launchd-service-2026-07-19/design.md`'s declared testing strategy; no shell-script test harness exists in this repo).
- `scripts/service-linux.sh` — same manual strategy, **and additionally untested against any real systemd hardware** (risk-register R-002) — the highest-priority open item from that feature (0000010).
- The Log Viewer UI's actual `GET /ui` route wiring and end-to-end browser behavior (0000015) — verified manually in a real browser against both a dev instance and the esbuild-bundled artifact (`server-http.bundle.mjs`), not via an automated live-server HTTP test. See `plan/_archive/0000015-telemetry-log-viewer-ui-2026-08-01/build-log.md` P3 for the full manual verification checklist.
