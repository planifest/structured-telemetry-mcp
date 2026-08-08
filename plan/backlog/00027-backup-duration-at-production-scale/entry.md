---
title: "Backlog Entry: 00027 - Measure backup export duration at production-realistic data volumes"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "low"
---
# Backlog Entry: 00027 - Measure backup export duration at production-realistic data volumes

**Source feature:** 0000018-telemetry-data-integrity
**Source phase:** P6 (docs)

**Date filed:** 2026-08-08

---

## Problem

req-006 (0000018) runs `EXPORT DATABASE` on the daemon's own DuckDB connection during active ingestion (ADR-029 — deliberately in-process, to avoid the single-writer-lock conflict that produced the 2026-08-03 incident's crash loop). This was flagged as a residual risk at P1 (`risk-register.md` R-001: "must not starve ingestion... flagged for P4 measurement") and re-flagged by the P5 security review as a Low-severity finding: backup export duration was never empirically measured against production-realistic data volumes — only small seeded test datasets (a handful to a few dozen rows) were exercised in `tests/integration/backup-service.test.ts` and `tests/integration/server-http-scheduled-backup.test.ts`.

At the current observed scale (~4,100 events over seven weeks pre-incident, ~15–20MB), export duration is almost certainly sub-second and not a practical concern. The risk is unvalidated at meaningfully larger scale, not necessarily real.

## Suggested Action

1. Seed a realistic multi-week (or multi-month) dataset — an order of magnitude or two larger than currently observed, e.g. 100K–1M rows — into a test or scratch DuckDB instance.
2. Run `runBackup()` against it and measure wall-clock duration for the full export → scratch-restore-verify → promote → prune cycle.
3. Compare against this project's existing p95 < 100ms query-latency NFR and the E2E suite's ~5-minute combined-runtime budget — assess whether a backup running on the daemon's single connection measurably delays concurrent `/emit`/`/query` handling during the export window at this scale.
4. If a real degradation is found, this becomes an ADR-029 revisit (e.g. chunked/streaming export, or a brief write-pause window with an explicit bounded-duration guarantee) rather than a silent performance regression discovered in production.

## Why Deferred

Not blocking 0000018 — no degradation has actually been observed, only unmeasured at scale. The feature's own acceptance criteria and current data volumes are satisfied. Filed per docs-agent's P6 backlog-filing convention for a Tech Debt item identified during this feature's own build (`plan/current/recommendations.md` REC-002/TD-002; also `plan/current/security-report.md`'s one remaining Low finding).
