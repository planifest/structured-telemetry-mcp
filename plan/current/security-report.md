# Security Report - 0000018-telemetry-data-integrity

## Threat Model (STRIDE)

| Threat | Category | Severity | Mitigation |
|---|---|---|---|
| `EXPORT DATABASE`/`IMPORT DATABASE` path interpolated unescaped into a single-quoted SQL literal (`src/backup/backup-service.ts:91,102` — `` `EXPORT DATABASE '${tmpPath}' (FORMAT PARQUET)` ``, `` `IMPORT DATABASE '${tmpPath}'` ``). `tmpPath` derives from `PLANIFEST_TELEMETRY_BACKUP_DIR` (operator-controlled env var, default `~/.planifest-backups`) plus a regex-safe timestamp. A path containing an apostrophe breaks the statement; in principle this is unescaped-identifier/path injection into a SQL literal (CWE-88-adjacent), scoped to the local trust boundary — the daemon already owns the DB, so this cannot escalate privilege, but it can corrupt the intended single-path semantics or crash the backup routine. This project's own ADR-024 already treats unparameterized DuckDB identifier/path interpolation as a real risk class worth a shared defense. | Tampering | Medium | Not mitigated. Recommend escaping embedded single quotes (SQL literal doubling: `path.replace(/'/g, "''")`) before interpolation, on both the export and import call sites. |
| No reentrancy guard on the in-process backup timer (`src/server-http.ts:144` — `setInterval(() => { void backup(); }, BACKUP_INTERVAL_MS)`). If `runBackup()` takes longer than the configured interval (unlikely at the 24h production default, but real for any overridden/short interval, or a slow-disk/large-DB system), two overlapping invocations can race on `pruneRetainedSet()` and the sidecar-metadata write — risking the sidecar recording a stale/out-of-order "most recent verified backup," or a concurrent prune racing against another run's promote. Notably ironic for a data-integrity feature; no test exercises this path (checked `tests/integration/backup-service.test.ts` and `tests/integration/server-http-scheduled-backup.test.ts` — neither covers overlapping invocations). | Tampering | Medium | Not mitigated. Recommend a simple in-flight boolean guard around the timer callback that skips a tick if the previous run hasn't completed. |
| `EXPORT DATABASE` runs on the daemon's single DuckDB connection during active ingestion (ADR-029) — a sufficiently large export could serialize/delay concurrent `/emit`/`/query` handling for its duration. This is the exact residual concern risk-register.md R-001 flagged for P4 measurement ("export must not starve ingestion"), which was not empirically measured at production-realistic scale during P3/P4 — only small test datasets were exercised. | Denial of Service | Low | Partially open. Not blocking at current data volumes (~15–20MB, sub-second exports observed in tests) — recommend measuring backup duration against the existing p95<100ms query NFR at realistic production volumes before relying on this at scale. |
| Refuse-to-start diagnostic (`src/db/refuse-to-start.ts`) prints the database file path and, when available, a conflicting process's PID to stderr. | Information Disclosure | Low | Already covered by the project's existing accepted posture — local stderr only, never network-reachable, consistent with prior security reports' acceptance of local absolute-path exposure (0000015 security-report.md, `product_id` finding). No new exposure class; no action needed. |
| Additive `buildId` field on `GET /health` (SHA-256 of `server-http.bundle.mjs`) is reachable by anyone with loopback access, same as the rest of `/health`. | Information Disclosure | Low | Not a secret — a build content fingerprint discloses nothing about source code, credentials, or data. No new exposure beyond the existing no-auth/127.0.0.1-only trust boundary, unchanged this feature. |
| `scripts/service-manager.mjs`'s new orphan-port/build-identity logic (`getManagedPid`, `getPortListenerPid`, `computeBuildId`, `verifyBuildIdentity`) shells out via `spawnSync` with argument-array form throughout (`launchctl`, `systemctl`, `lsof`, `ss`) — no `shell: true`, no string-concatenated commands anywhere in the reviewed diff. | Tampering (command injection) | — | Fully mitigated by construction — argument-array `spawnSync` calls are not vulnerable to shell metacharacter injection regardless of `port`/PID content. No finding. |

## Dependency Audit

No new dependencies were added by this feature (`package.json` diff is empty across all of P3 — confirmed at P4). Zero new supply-chain surface. Library audit against `planifest-framework/standards/library-standards/typescript/prefer-avoid.md` is trivially satisfied — the feature uses only Node built-ins (`node:crypto` for SHA-256, `node:fs`/`node:path` for the sidecar file and backup artifacts).

## Secrets Management

No secrets are introduced or handled by this feature. `PLANIFEST_TELEMETRY_BACKUP_DIR` is a filesystem path, not a credential. No hardcoded credentials found in the reviewed diff.

## Authentication & Authorisation Review

No new API endpoint was added — `GET /health` gains one additive field only. No OpenAPI spec exists for this project (established convention, unchanged). Consistent with the project's existing, explicitly-documented no-auth/127.0.0.1-only posture (`component.yml` exceptions), re-confirmed unchanged across 0000015 and 0000017's own security reports and not altered by this feature.

## Input Validation Review

No new externally-triggered HTTP input path was added this feature — the backup routine, refuse-to-start check, deploy verification, and doctor check are all local CLI/daemon-internal, never driven by remote or untrusted HTTP input. The existing `query_telemetry`/`emit_event` HTTP input-validation surface is unchanged by this feature.

## Network Policy

Unchanged. No new listen address or port. The daemon remains bound to `127.0.0.1` only; `scripts/service-manager.mjs`'s new `fetch(http://localhost:${port}/health)` call in `fetchHealthWithRetry` is loopback-only, matching the existing trust boundary.

## Infrastructure as Code Review

Not applicable — no IaC declared in this project's stack (`design.md`: `iac: none`).

## Summary

Overall risk rating: **Medium** — two concrete, fixable Medium findings exist (unescaped SQL path interpolation; missing backup-timer reentrancy guard). Neither is remotely exploitable or crosses the project's existing no-auth/local-only trust boundary; both are local data-integrity robustness gaps in a feature whose entire purpose is data integrity, worth closing before this is considered fully done.

Top actions before production:
1. Escape embedded single quotes in the `EXPORT DATABASE`/`IMPORT DATABASE` path literals (`src/backup/backup-service.ts:91,102`).
2. Add an in-flight guard to the backup timer callback (`src/server-http.ts:144`) to prevent overlapping `runBackup()` invocations.
3. Measure backup export duration against production-realistic data volumes before relying on the "does not starve ingestion" assumption at scale (risk-register.md R-001 residual).
