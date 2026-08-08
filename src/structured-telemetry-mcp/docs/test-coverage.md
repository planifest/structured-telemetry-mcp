# Test Coverage Summary — structured-telemetry-mcp

Snapshot at 0.15.0 (`0000019-loopback-daemon-hardening`).

## Totals

| Category | Count |
|----------|-------|
| Unit (`tests/unit/`) | 262 |
| Integration (`tests/integration/`) | 145 |
| Regression (`tests/regression/`) | 137 |
| Performance (`tests/performance.test.ts`) | 1 |
| E2E (`tests/e2e/`, `@playwright/test`, Chromium-only) | 25 |
| **Total** | **570** |

545 of the total are Vitest tests (262 + 145 + 137 + 1); the remaining 25 are Playwright E2E (22 from prior features + 3 new XSS-escaping tests, req-010).

Growth this feature (0000019): +54 Vitest and +3 E2E, baseline 491 Vitest / 22 E2E from 0.14.0. New Vitest files: `tests/unit/validate-query.test.ts` (26, req-005), `tests/unit/server-factory-hardening.test.ts` (6, req-005/006/008 on the MCP path), `tests/integration/bounded-result-sets.test.ts` (4, req-007), `tests/integration/server-http-boundary.test.ts` (13, req-001/002/003/004/006 on the HTTP path), `tests/integration/injection-identifiers.test.ts` (4, req-009). New E2E file: `tests/e2e/ui/xss-escaping.spec.ts` (3, req-010). `tests/unit/column-allow-list.test.ts` had its two tautological tests replaced with tests that can fail (net +1); `tests/unit/server-factory.test.ts` had 3 tests updated from the old leaky-error contract to the redacted one (req-006); `tests/unit/ui.test.ts` now imports the allow-list rather than restating it (req-011).

Plus 26 bats tests (`tests/bats/`, was 23 — +3 for req-005's supervision-config key assertions), a separate framework/CI job not counted in the Vitest totals above.

Baseline before this feature: 427 (as of 0.13.0 / `0000017`). Growth this feature: +86 Vitest tests (405→491) across req-001 through req-010 plus the P5 security-fix regression coverage (`sqlPathLiteral()` escaping, backup-timer reentrancy guard). New test files: `tests/unit/checkpoint.test.ts`, `backup-prune.test.ts`, `backup-metadata.test.ts`, `service-manager.test.ts`, `backup-sql-path-literal.test.ts`; `tests/integration/server-http-refuse-to-start.test.ts`, `server-http-wal-safe-migrations.test.ts`, `server-http-periodic-checkpoint.test.ts`, `server-http-graceful-shutdown.test.ts`, `server-http-scheduled-backup.test.ts`, `backup-service.test.ts`, `cli-doctor-backup-staleness.test.ts`. No pre-existing test was modified.

Notably, several of the highest-value tests this feature added are real-execution, not mocked: the poisoned-WAL and lock-held fixtures in `server-http-refuse-to-start.test.ts` reproduce the actual DuckDB failure modes against a real database file; `server-http-scheduled-backup.test.ts` runs a live server process through a real `EXPORT`/`IMPORT DATABASE` cycle; and both P5 security fixes were verified with a genuine RED-before-GREEN cycle (the fix was temporarily reverted, the new test confirmed to fail for the right reason, then restored) rather than review alone.

Performance gate: p95 < 100ms (CI-tolerant; Windows GH runners measured ~28ms p95) — unaffected by 0000018. Backup export duration was measured only at small test scale (P5 finding, tracked as a follow-up) — not yet validated against production-realistic data volumes.

## What's covered by automated tests (0000019)

Every security claim below names the test that backs it — the discipline this feature exists to restore (req-011).

- **Host allow-list (req-001)** — a foreign `Host` is refused with `403` on every route before the body is read; the loopback authority is accepted, compared against the actually-bound ephemeral port — `tests/integration/server-http-boundary.test.ts`
- **Origin rejection (req-002)** — a present, foreign `Origin` is refused with `403` and writes no event; an absent `Origin` (stdio proxy, emission hooks) and the daemon's own origin are accepted; no `Access-Control-Allow-Origin` is emitted — `tests/integration/server-http-boundary.test.ts`, and the whole existing UI E2E suite exercises the accepted same-origin browser path
- **Content-Type required on writes (req-003)** — `text/plain` and a missing type are refused with `415`; `application/json` with a charset param is accepted — `tests/integration/server-http-boundary.test.ts`
- **Body cap + crash safety (req-004)** — an over-cap body is refused with `413` for an honest `Content-Length` and by a streaming counter for a forged/absent one; malformed JSON returns `400`; the daemon process stays alive (`GET /health` still `200`) after every case — `tests/integration/server-http-boundary.test.ts`
- **Shared query validation gate (req-005)** — the full rejected/accepted numeric corpus (including `distinct_values` limit 21 rejected rather than clamped, and `trend`'s limit as a day count) behaves identically as a unit and on the MCP handler — `tests/unit/validate-query.test.ts`, `tests/unit/server-factory-hardening.test.ts`, and the HTTP path in `tests/integration/server-http-boundary.test.ts`
- **Error redaction (req-006)** — a leak probe (binder error embedding SQL, conversion error embedding a stored `session_id`) returns no engine text, no SQL, no stored value, and carries a `correlationId`, on both the MCP handler and the live HTTP path; three prior tests that asserted the old leaky contract were corrected — `tests/unit/server-factory-hardening.test.ts`, `tests/unit/server-factory.test.ts`, `tests/integration/server-http-boundary.test.ts`
- **Bounded result sets (req-007)** — `failure_sequence` and `drill_down` cap rows and report `truncated`/`total_count` (a `COUNT(*)`, not `rows.length`) nested in `json` — `tests/integration/bounded-result-sets.test.ts`
- **MCP tool-result text budget (req-008)** — an oversized result is capped, states truncation, and keeps every JSON block parseable; a normal result is unchanged — `tests/unit/server-factory-hardening.test.ts`
- **Injection-shaped identifiers (req-009)** — a real hostile corpus (quotes, `;`, `--`, `/* */`, `UNION SELECT`, backtick, newline, `timestamp; DROP TABLE events`, and the prototype keys `constructor`/`__proto__`/`prototype`) is rejected against both `sortField` and `distinct_values.field`, with the events table unchanged afterward; verified by a real RED-before-GREEN weakening cycle — `tests/integration/injection-identifiers.test.ts`, `tests/unit/column-allow-list.test.ts`
- **XSS escaping in the rendered UI (req-010)** — a hostile payload corpus in every rendered free-text field executes no script (behavioural: a page dialog handler and pageerror listener, plus injected-element checks), the `product_id` `title` attribute does not break out, and the JSON detail view renders literally; verified by a real RED-before-GREEN cycle replacing `escapeHtml` with identity — `tests/e2e/ui/xss-escaping.spec.ts`
- **Local-only file hygiene (req-012)** — `*.local-only.*` is gitignored and the two previously-tracked files are untracked (verified by git state at commit, not a runtime test)

## What's covered by automated tests (0000018)

- Graceful shutdown checkpoint on SIGTERM/SIGINT (req-001), periodic checkpoint at the 60s/100-write threshold (req-002), checkpoint-immediately-after-migration (req-003) — `tests/integration/server-http-graceful-shutdown.test.ts`, `server-http-periodic-checkpoint.test.ts`, `server-http-wal-safe-migrations.test.ts`, `tests/unit/checkpoint.test.ts`
- Refuse-to-start on a real poisoned-WAL fixture and a real lock-held-by-another-process fixture, exit code 0, WAL left byte-identical — `tests/integration/server-http-refuse-to-start.test.ts`
- Scheduled backup: full verify→promote→prune sequence, zero-row and non-zero-row cases, verification-mismatch and mid-export-interruption failure paths, retention-pruning stability, live timer wiring against a real server — `tests/integration/backup-service.test.ts`, `server-http-scheduled-backup.test.ts`, `tests/unit/backup-prune.test.ts`
- `doctor` backup-staleness reporting: verified/absent/malformed sidecar states, confirmed working even while the daemon holds the DuckDB lock — `tests/integration/cli-doctor-backup-staleness.test.ts`, `tests/unit/backup-metadata.test.ts`
- Deploy build-identity assertion (same-version-mismatch detection, unknown-buildId degrade, live-verified against the real running daemon) and orphan-port detection (managed-PID match, no false positive during normal restart) — `tests/unit/service-manager.test.ts`
- Event-log pagination tiebreaker — duplicate-sort-key completeness across every sortable field and both directions — `tests/integration/query-telemetry.test.ts`
- P5 security fixes: SQL path-literal escaping, backup-timer reentrancy guard — `tests/unit/backup-sql-path-literal.test.ts`, plus dedicated cases in `backup-service.test.ts` and `server-http-scheduled-backup.test.ts`

## What's covered by automated tests (0000017)

- `event_log`'s `sortField` param — allow-listed values sort correctly per column, default (`timestamp`) preserved when omitted, non-allow-listed input rejected — `tests/unit/column-allow-list.test.ts`, `tests/integration/query-telemetry.test.ts`. **(Corrected at 0000019: this line previously read "injection-shaped input rejected", a claim no test backed — the rejection tests used only benign identifiers. Genuine injection-shaped input is now exercised by `tests/integration/injection-identifiers.test.ts`, req-009; see the 0000019 section below.)**
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
