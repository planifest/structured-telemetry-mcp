# Tech Debt — structured-telemetry-mcp

## Resolved in 0000011-defects-and-query-telemetry-fix

- ~~`README.md`'s "Event Payloads" section only documents 9 of 21 pre-0.10.0 event types.~~ Fixed — all 12 missing types (`phase_skip` through `schema_migration_applied`) backfilled.
- ~~`src/structured-telemetry-mcp/docs/data-contract.md`'s sub-schema list has the same gap.~~ Partially applied already (the 5 types from 0.2.0 were already present) — the remaining 7 from `0000009` (`context_reset` through `schema_migration_applied`) are now backfilled too.

## Resolved in 0000010-macos-launchd-service

- ~~`package.json`'s `version` field was stale at `0.1.0`~~ while the true last-shipped version (per git tags and `component.yml`) was `0.3.0`. Fixed via `component.yml`/`product.yml` established as the enforced source of truth.

## Open, filed to backlog at 0000018-telemetry-data-integrity (P6)

- **req-005's supervision circuit-breaker (`ThrottleInterval`/`StartLimitBurst`) has config-content-level bats coverage only** — no test actually installs the service under real launchd/systemd, forces repeated failures, and counts respawn attempts over real wall-clock time. The primary "stay stopped" guarantee (ADR-030's `exit(0)`) does have real behavioral coverage via `tests/integration/server-http-refuse-to-start.test.ts`'s poisoned-WAL/lock-held reproduction; this gap is specifically in the defense-in-depth layer. Deliberately not run destructively against the live daemon backing this session's own telemetry (see `plan/current/build-log.md`'s P4 section). Filed as backlog entry (see `plan/backlog/`).
- **Backup export duration was never measured against production-realistic data volumes** — only small test datasets were exercised (risk-register.md R-001's residual "must not starve ingestion" concern, noted for P4 measurement but not empirically done). Not blocking at current scale (~15–20MB). Filed as backlog entry (see `plan/backlog/`).
