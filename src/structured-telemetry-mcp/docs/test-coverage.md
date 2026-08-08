# Test Coverage Summary — structured-telemetry-mcp

Snapshot at 0.14.0 (`0000018-telemetry-data-integrity`).

## Totals

| Category | Count |
|----------|-------|
| Unit (`tests/unit/`) | 229 |
| Integration (`tests/integration/`) | 124 |
| Regression (`tests/regression/`) | 137 |
| Performance (`tests/performance.test.ts`) | 1 |
| E2E (`tests/e2e/`, `@playwright/test`, Chromium-only) | 22 |
| **Total** | **513** |

491 of the total are Vitest tests (229 + 124 + 137 + 1); the remaining 22 are Playwright E2E, unchanged this feature — no new HTTP/UI surface was added (deploy/backup/doctor are CLI/daemon-lifecycle, outside the E2E suites' scope).

Plus 26 bats tests (`tests/bats/`, was 23 — +3 for req-005's supervision-config key assertions), a separate framework/CI job not counted in the Vitest totals above.

Baseline before this feature: 427 (as of 0.13.0 / `0000017`). Growth this feature: +86 Vitest tests (405→491) across req-001 through req-010 plus the P5 security-fix regression coverage (`sqlPathLiteral()` escaping, backup-timer reentrancy guard). New test files: `tests/unit/checkpoint.test.ts`, `backup-prune.test.ts`, `backup-metadata.test.ts`, `service-manager.test.ts`, `backup-sql-path-literal.test.ts`; `tests/integration/server-http-refuse-to-start.test.ts`, `server-http-wal-safe-migrations.test.ts`, `server-http-periodic-checkpoint.test.ts`, `server-http-graceful-shutdown.test.ts`, `server-http-scheduled-backup.test.ts`, `backup-service.test.ts`, `cli-doctor-backup-staleness.test.ts`. No pre-existing test was modified.

Notably, several of the highest-value tests this feature added are real-execution, not mocked: the poisoned-WAL and lock-held fixtures in `server-http-refuse-to-start.test.ts` reproduce the actual DuckDB failure modes against a real database file; `server-http-scheduled-backup.test.ts` runs a live server process through a real `EXPORT`/`IMPORT DATABASE` cycle; and both P5 security fixes were verified with a genuine RED-before-GREEN cycle (the fix was temporarily reverted, the new test confirmed to fail for the right reason, then restored) rather than review alone.

Performance gate: p95 < 100ms (CI-tolerant; Windows GH runners measured ~28ms p95) — unaffected by 0000018. Backup export duration was measured only at small test scale (P5 finding, tracked as a follow-up) — not yet validated against production-realistic data volumes.

## What's covered by automated tests (0000018)

- Graceful shutdown checkpoint on SIGTERM/SIGINT (req-001), periodic checkpoint at the 60s/100-write threshold (req-002), checkpoint-immediately-after-migration (req-003) — `tests/integration/server-http-graceful-shutdown.test.ts`, `server-http-periodic-checkpoint.test.ts`, `server-http-wal-safe-migrations.test.ts`, `tests/unit/checkpoint.test.ts`
- Refuse-to-start on a real poisoned-WAL fixture and a real lock-held-by-another-process fixture, exit code 0, WAL left byte-identical — `tests/integration/server-http-refuse-to-start.test.ts`
- Scheduled backup: full verify→promote→prune sequence, zero-row and non-zero-row cases, verification-mismatch and mid-export-interruption failure paths, retention-pruning stability, live timer wiring against a real server — `tests/integration/backup-service.test.ts`, `server-http-scheduled-backup.test.ts`, `tests/unit/backup-prune.test.ts`
- `doctor` backup-staleness reporting: verified/absent/malformed sidecar states, confirmed working even while the daemon holds the DuckDB lock — `tests/integration/cli-doctor-backup-staleness.test.ts`, `tests/unit/backup-metadata.test.ts`
- Deploy build-identity assertion (same-version-mismatch detection, unknown-buildId degrade, live-verified against the real running daemon) and orphan-port detection (managed-PID match, no false positive during normal restart) — `tests/unit/service-manager.test.ts`
- Event-log pagination tiebreaker — duplicate-sort-key completeness across every sortable field and both directions — `tests/integration/query-telemetry.test.ts`
- P5 security fixes: SQL path-literal escaping, backup-timer reentrancy guard — `tests/unit/backup-sql-path-literal.test.ts`, plus dedicated cases in `backup-service.test.ts` and `server-http-scheduled-backup.test.ts`

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
