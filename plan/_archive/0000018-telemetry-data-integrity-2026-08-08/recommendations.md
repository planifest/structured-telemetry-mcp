# Recommendations - Telemetry Data Integrity

**Skill:** [docs-agent](../skills/docs-agent-SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Version:** 0.14.0

> These are not blockers - they are opportunities for future work.

## Recommendations

| ID | Category | Priority | Component | Recommendation | Rationale | Effort |
|----|----------|----------|-----------|---------------|-----------|--------|
| REC-001 | testing | medium | structured-telemetry-mcp | Run a live, real-supervision respawn-count drill for req-005's circuit-breaker (install under real launchd/systemd, force repeated failures, count actual respawn attempts over wall-clock time) | Current coverage is config-content-level only (bats asserting the generated plist/unit contain the right keys/values); the primary stay-stopped guarantee (ADR-030's exit(0)) has real behavioral coverage, but this defense-in-depth layer does not | small |
| REC-002 | performance | medium | structured-telemetry-mcp | Measure `EXPORT DATABASE` backup duration against production-realistic data volumes (current tests only exercise small seeded datasets) | risk-register.md R-001's residual concern ("must not starve ingestion") was flagged for P4 measurement but not empirically validated at scale; P5 security review re-flagged it as a Low finding | small |
| REC-003 | maintainability | low | structured-telemetry-mcp | Extract a small shared "spawn a live server with overridable env, capture stderr" test helper — `tests/integration/support/server-lifecycle-harness.ts` (req-001-004) and the pattern used inline in `server-http-scheduled-backup.test.ts` (req-006) are close to identical | Two near-identical live-server test harnesses now exist; a future requirement touching daemon lifecycle will likely want the same pattern a third time | small |
| REC-004 | observability | low | structured-telemetry-mcp | Consider a `doctor` check for backup directory disk headroom, mirroring the "low disk skips the backup with a loud warning" behavior described in the Scope Lock error/sad-path answer (build-log.md P0) | The behavior is described in the confirmed scope and the design's error path, but no explicit low-disk-space test or `doctor` surfacing was verified this feature — worth confirming it's actually implemented as described, not just assumed | small |

## Deferred Items

| Scope Item | Recommendation | When to Address |
|-----------|---------------|-----------------|
| Recovery of the ~4,100 events stranded in the pre-existing unreplayable WAL (backlog 00023) | Attempt in ascending order of effort per the backlog entry's own plan (try alternate DuckDB versions, truncate-before-poison-entry, or a WAL scavenger) | Whenever a future pipeline run picks up backlog 00023 — not blocking, data is safe in two checksum-verified copies |
| Live supervised-respawn drill for req-005 (see REC-001) | Run manually, or automate via a CI job with real launchd/systemd access if one becomes available | Before this feature is considered fully verified end-to-end, or the next time supervision config changes |
| Backup duration at production scale (see REC-002) | Seed a realistic multi-week dataset and measure `EXPORT DATABASE` wall-clock time against the existing query NFRs | Before relying on this feature at meaningfully larger data volumes than currently observed (~15–20MB) |

## Tech Debt

| ID | Component | Description | Impact if Ignored | Suggested Fix |
|----|-----------|-------------|-------------------|--------------|
| TD-001 | structured-telemetry-mcp | req-005's supervision circuit-breaker has no live-execution test, only config-content assertions | A future change to the plist/unit generation logic could silently break the actual respawn-limiting behavior while the bats tests keep passing (they only check the keys/values are present in the generated file) | See REC-001 |
| TD-002 | structured-telemetry-mcp | Backup export duration unmeasured at production scale | A future large telemetry store could see `/emit`/`/query` latency degrade during the daily backup window without any test catching the regression | See REC-002 |
